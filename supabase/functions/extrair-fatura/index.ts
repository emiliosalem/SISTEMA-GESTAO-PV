// extrai campos de uma fatura de energia (pdf ou foto) usando a api de
// visão da anthropic, com tool use forçado para obter json estruturado com
// confiança por campo. se ANTHROPIC_API_KEY não estiver configurada, devolve
// { semChave: true } e quem chamou cai automaticamente na digitação manual
// sem quebrar (seção 6 do pedido).
//
// segredo necessário: supabase secrets set ANTHROPIC_API_KEY=...
// opcional: ANTHROPIC_MODEL (padrão claude-opus-5)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const CABECALHOS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// mesma lista de src/lib/fatura/campos.ts; duplicada porque a função roda
// num runtime deno separado do bundle do frontend
const CAMPOS = [
  "periodo_inicio",
  "periodo_fim",
  "consumo_kwh",
  "injetada_kwh",
  "creditos_usados_kwh",
  "saldo_creditos_kwh",
  "percentual_rateio_aplicado",
  "bandeira",
  "contribuicao_iluminacao_publica",
  "custo_disponibilidade",
  "valor_total",
] as const;

const ESQUEMA_CAMPO = {
  type: "object",
  properties: {
    valor: {
      type: "string",
      description: "valor do campo como está no documento, texto puro, sem unidade. vazio se não encontrado.",
    },
    confianca: {
      type: "number",
      description: "confiança de 0 a 1 na leitura deste campo",
    },
  },
  required: ["valor", "confianca"],
};

const FERRAMENTA_EXTRACAO = {
  name: "registrar_campos_fatura",
  description: "Registra os campos extraídos de uma fatura de energia elétrica brasileira.",
  input_schema: {
    type: "object",
    properties: {
      campos: {
        type: "object",
        properties: Object.fromEntries(CAMPOS.map((campo) => [campo, ESQUEMA_CAMPO])),
        required: [...CAMPOS],
      },
    },
    required: ["campos"],
  },
};

const PROMPT_EXTRACAO = `Você está lendo uma fatura de energia elétrica brasileira (conta de luz), possivelmente com compensação de energia solar (geração distribuída).

Extraia estes campos e chame a ferramenta registrar_campos_fatura:
- periodo_inicio / periodo_fim: datas do período de leitura, formato AAAA-MM-DD.
- consumo_kwh: consumo faturado em kWh.
- injetada_kwh: energia injetada na rede pela usina, em kWh (pode aparecer como "energia injetada" ou similar).
- creditos_usados_kwh: créditos de energia usados/compensados no período, em kWh.
- saldo_creditos_kwh: saldo de créditos acumulado ao final do período, em kWh.
- percentual_rateio_aplicado: percentual de rateio aplicado a esta unidade consumidora, se aparecer na fatura.
- bandeira: bandeira tarifária do período (ex: verde, amarela, vermelha patamar 1, vermelha patamar 2).
- contribuicao_iluminacao_publica: contribuição de iluminação pública (COSIP), em reais.
- custo_disponibilidade: custo de disponibilidade do sistema, em reais.
- valor_total: valor total da fatura, em reais.

Para cada campo, informe o valor como texto simples (só o número ou texto, sem unidade nem símbolo de moeda) e uma confiança de 0 a 1. Se não encontrar o campo no documento, use valor vazio e confiança 0. Não invente valores.`;

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CABECALHOS_CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CABECALHOS_CORS });
  }

  try {
    const { caminho_arquivo, mime_type } = await req.json();
    if (!caminho_arquivo || !mime_type) {
      return json({ erro: "caminho_arquivo e mime_type são obrigatórios" }, 400);
    }

    const autorizacao = req.headers.get("Authorization");
    if (!autorizacao) {
      return json({ erro: "não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseCliente = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: autorizacao } },
    });

    const { data: dadosUsuario } = await supabaseCliente.auth.getUser();
    if (!dadosUsuario.user) {
      return json({ erro: "não autenticado" }, 401);
    }

    const chaveAnthropic = Deno.env.get("ANTHROPIC_API_KEY");
    if (!chaveAnthropic) {
      return json({ semChave: true });
    }

    const { data: arquivo, error: erroDownload } = await supabaseCliente.storage
      .from("faturas")
      .download(caminho_arquivo);

    if (erroDownload || !arquivo) {
      return json({ erro: "não foi possível ler o arquivo enviado" });
    }

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const dadosBase64 = encodeBase64(bytes);

    const blocoDocumento =
      mime_type === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: dadosBase64 } }
        : { type: "image", source: { type: "base64", media_type: mime_type, data: dadosBase64 } };

    const respostaAnthropic = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chaveAnthropic,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-opus-5",
        max_tokens: 2048,
        output_config: { effort: "low" },
        tools: [FERRAMENTA_EXTRACAO],
        tool_choice: { type: "tool", name: "registrar_campos_fatura" },
        messages: [
          {
            role: "user",
            content: [blocoDocumento, { type: "text", text: PROMPT_EXTRACAO }],
          },
        ],
      }),
    });

    if (!respostaAnthropic.ok) {
      return json({ erro: `falha na extração (código ${respostaAnthropic.status})` });
    }

    const corpoResposta = await respostaAnthropic.json();
    const blocoFerramenta = (corpoResposta.content ?? []).find(
      (bloco: { type: string; name?: string }) =>
        bloco.type === "tool_use" && bloco.name === "registrar_campos_fatura"
    );

    if (!blocoFerramenta) {
      return json({ erro: "a extração não retornou os campos esperados" });
    }

    return json({ campos: blocoFerramenta.input.campos });
  } catch (erro) {
    return json({ erro: erro instanceof Error ? erro.message : "falha inesperada na extração" });
  }
});
