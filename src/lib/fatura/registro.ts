import { supabase } from "../supabase";
import { CAMPOS_FATURA } from "./campos";
import type { ResultadoExtracao } from "./extracao";

interface ParametrosCriarFatura {
  unidadeConsumidoraId: string;
  origem: "pdf" | "foto" | "digitado";
  arquivoUrl?: string | null;
  extracao?: ResultadoExtracao | null;
}

// cria a fatura e já semeia uma linha em fatura_campo_extraido para cada
// campo extraível, mesmo quando não houve extração (digitação manual ou sem
// chave da anthropic) — é essa semente que sustenta o contador de campos
// pendentes na conferência
export async function criarFatura(params: ParametrosCriarFatura): Promise<string> {
  const { data: fatura, error } = await supabase
    .from("fatura")
    .insert({
      unidade_consumidora_id: params.unidadeConsumidoraId,
      origem: params.origem,
      status: "em_conferencia",
      arquivo_url: params.arquivoUrl ?? null,
    })
    .select("id")
    .single();

  if (error || !fatura) throw error ?? new Error("falha ao criar fatura");

  const camposExtraidos = params.extracao?.campos ?? {};
  const linhas = CAMPOS_FATURA.map((def) => {
    const extraido = camposExtraidos[def.campo];
    return {
      fatura_id: fatura.id,
      campo: def.campo,
      valor_lido: extraido?.valor || null,
      confianca: extraido ? extraido.confianca : null,
    };
  });

  const { error: erroCampos } = await supabase.from("fatura_campo_extraido").insert(linhas);
  if (erroCampos) throw erroCampos;

  return fatura.id as string;
}
