// rotina diária de coleta (seção 2 e 4 do pedido). agendada via supabase
// cron chamando esta edge function. para cada usina ativa:
//   1. resolve a fonte de dados (cadeia fabricante -> solarz -> manual, ou
//      respeita a escolha fixada manualmente na ficha da usina)
//   2. tenta coletar a geração do dia anterior pela fonte resolvida
//   3. recalcula a cobertura de monitoramento a partir do que existe de fato
//      em leitura_geracao (nunca por presunção)
//   4. quando há leitura do fabricante e do solarz no mesmo dia, registra a
//      divergência entre as duas fontes (alerta interno, nunca visível ao
//      cliente)
//
// nenhum dos seis adaptadores de fabricante nem o solarz têm credencial
// confirmada ainda, então hoje esta rotina majoritariamente só recalcula
// cobertura a partir de leituras manuais — e isso é o comportamento correto,
// não um bug: quando as credenciais saírem, a coleta liga sozinha.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { IntegracaoNaoConfigurada } from "../_shared/coletor/tipos.ts";
import type { AdaptadorFabricante, Fabricante } from "../_shared/coletor/tipos.ts";
import { resolverFonteAutomatica, resolverFonteFixada } from "../_shared/coletor/resolucao.ts";
import { classificarCobertura } from "../_shared/coletor/cobertura.ts";
import { compararEntrePares, detectarSemComunicacao } from "../_shared/coletor/deteccao.ts";

const DIAS_JANELA_COBERTURA = 3; // sem leitura nos últimos 3 dias conta como "não recente"

function ontem(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function formatarData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, chaveServico);

  const resumo = { usinasProcessadas: 0, leiturasGravadas: 0, divergenciasRegistradas: 0, erros: [] as string[] };

  const { data: usinas, error: erroUsinas } = await supabase
    .from("usina")
    .select("id, nome_monitoramento, fonte_dados_geracao, dispositivo(fabricante)")
    .eq("ativa", true);

  if (erroUsinas || !usinas) {
    return new Response(JSON.stringify({ erro: erroUsinas?.message ?? "falha ao listar usinas" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dataOntem = formatarData(ontem());

  for (const usina of usinas) {
    try {
      const fabricantePrincipal = fabricantePredominante(
        (usina.dispositivo ?? []) as { fabricante: Fabricante }[]
      );

      let fonte: "api_fabricante" | "solarz" | "manual";
      let adaptador: AdaptadorFabricante | null = null;

      if (usina.fonte_dados_geracao) {
        fonte = usina.fonte_dados_geracao;
        adaptador = resolverFonteFixada(fonte, fabricantePrincipal, supabase);
      } else {
        const resolvida = resolverFonteAutomatica(fabricantePrincipal, supabase);
        fonte = resolvida.fonte;
        adaptador = resolvida.adaptador;
        await supabase.from("usina").update({ fonte_dados_geracao: fonte }).eq("id", usina.id);
      }

      if (adaptador && fonte !== "manual" && adaptador.disponivel()) {
        try {
          const leituras = await adaptador.buscarGeracaoDiaria(
            { id: usina.id, nomeMonitoramento: usina.nome_monitoramento },
            ontem(),
            ontem()
          );
          for (const leitura of leituras) {
            await gravarLeitura(supabase, usina.id, fonte, leitura);
            resumo.leiturasGravadas++;
          }
        } catch (erroColeta) {
          if (!(erroColeta instanceof IntegracaoNaoConfigurada)) {
            resumo.erros.push(`${usina.nome_monitoramento}: ${(erroColeta as Error).message}`);
          }
        }
      }

      await recalcularCobertura(supabase, usina.id);
      const divergenciaRegistrada = await registrarDivergenciaSeHouver(supabase, usina.id, dataOntem);
      if (divergenciaRegistrada) resumo.divergenciasRegistradas++;

      // detecção contínua (seção 5): comparação entre pares se auto-guarda
      // para só ter efeito quando há leitura por dispositivo no dia; sem
      // comunicação só faz sentido em fonte automática, não em entrada manual
      await compararEntrePares(supabase, usina.id, dataOntem);
      if (fonte !== "manual") {
        const { data: dispositivosParaChecar } = await supabase
          .from("dispositivo")
          .select("id")
          .eq("usina_id", usina.id)
          .eq("ativo", true);
        await detectarSemComunicacao(supabase, dispositivosParaChecar ?? []);
      }

      resumo.usinasProcessadas++;
    } catch (erro) {
      resumo.erros.push(`${usina.nome_monitoramento}: ${(erro as Error).message}`);
    }
  }

  return new Response(JSON.stringify(resumo), { headers: { "Content-Type": "application/json" } });
});

function fabricantePredominante(dispositivos: { fabricante: Fabricante }[]): Fabricante | null {
  if (dispositivos.length === 0) return null;
  const contagem = new Map<Fabricante, number>();
  for (const d of dispositivos) {
    contagem.set(d.fabricante, (contagem.get(d.fabricante) ?? 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// deno-lint-ignore no-explicit-any
async function gravarLeitura(supabase: any, usinaId: string, fonte: string, leitura: { dispositivoIdentificador: string | null; data: string; energiaKwh: number }) {
  let dispositivoId: string | null = null;
  if (leitura.dispositivoIdentificador) {
    const { data: dispositivo } = await supabase
      .from("dispositivo")
      .select("id")
      .eq("usina_id", usinaId)
      .eq("identificador_fabricante", leitura.dispositivoIdentificador)
      .maybeSingle();
    dispositivoId = dispositivo?.id ?? null;
  }

  let consulta = supabase.from("leitura_geracao").select("id").eq("usina_id", usinaId).eq("data", leitura.data);
  consulta = dispositivoId ? consulta.eq("dispositivo_id", dispositivoId) : consulta.is("dispositivo_id", null);
  const { data: existente } = await consulta.maybeSingle();

  const linha = {
    usina_id: usinaId,
    dispositivo_id: dispositivoId,
    data: leitura.data,
    energia_kwh: leitura.energiaKwh,
    fonte,
    granularidade: dispositivoId ? "dispositivo" : "usina",
    coletado_em: new Date().toISOString(),
  };

  if (existente) {
    await supabase.from("leitura_geracao").update(linha).eq("id", existente.id);
  } else {
    await supabase.from("leitura_geracao").insert(linha);
  }
}

// deno-lint-ignore no-explicit-any
async function recalcularCobertura(supabase: any, usinaId: string) {
  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate() - DIAS_JANELA_COBERTURA);

  const { data: leiturasRecentes } = await supabase
    .from("leitura_geracao")
    .select("dispositivo_id")
    .eq("usina_id", usinaId)
    .gte("data", formatarData(desde));

  const linhas = (leiturasRecentes ?? []) as { dispositivo_id: string | null }[];
  const temPorDispositivo = linhas.some((l) => l.dispositivo_id !== null);
  const temAgregada = linhas.some((l) => l.dispositivo_id === null);

  const cobertura = classificarCobertura(temPorDispositivo, temAgregada);
  await supabase.from("usina").update({ cobertura_monitoramento_atual: cobertura }).eq("id", usinaId);
}

// deno-lint-ignore no-explicit-any
async function registrarDivergenciaSeHouver(supabase: any, usinaId: string, data: string): Promise<boolean> {
  const { data: leiturasUsina } = await supabase
    .from("leitura_geracao")
    .select("fonte, energia_kwh, dispositivo_id")
    .eq("usina_id", usinaId)
    .eq("data", data)
    .is("dispositivo_id", null);

  const linhas = (leiturasUsina ?? []) as { fonte: string; energia_kwh: number }[];
  const doFabricante = linhas.find((l) => l.fonte === "api_fabricante");
  const doSolarz = linhas.find((l) => l.fonte === "solarz");
  if (!doFabricante || !doSolarz) return false;

  const { data: jaRegistrada } = await supabase
    .from("divergencia_fonte")
    .select("id")
    .eq("usina_id", usinaId)
    .eq("data", data)
    .maybeSingle();
  if (jaRegistrada) return false;

  const maior = Math.max(doFabricante.energia_kwh, doSolarz.energia_kwh);
  const diferencaPct = maior === 0 ? 0 : (Math.abs(doFabricante.energia_kwh - doSolarz.energia_kwh) / maior) * 100;

  const { data: parametro } = await supabase
    .from("parametro")
    .select("valor")
    .eq("chave", "limite_divergencia_fontes_pct")
    .maybeSingle();
  const limite = parametro?.valor ? Number(parametro.valor) : null;
  const sinalizado = limite !== null && !Number.isNaN(limite) && diferencaPct > limite;

  await supabase.from("divergencia_fonte").insert({
    usina_id: usinaId,
    data,
    energia_fabricante_kwh: doFabricante.energia_kwh,
    energia_solarz_kwh: doSolarz.energia_kwh,
    diferenca_pct: diferencaPct,
    sinalizado,
  });
  return true;
}
