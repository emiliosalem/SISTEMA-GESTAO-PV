import { supabase } from "../supabase";
import type { AlertaGerado, ContextoDiagnostico, EventoDispositivoPeriodo, LeituraDia } from "./tipos";
import {
  calcularAgregados,
  regraCicloDescasado,
  regraConsumoAumentou,
  regraCreditoExpirado,
  regraDispositivoParadoNoPeriodo,
  regraDivergenciaMedicao,
  regraRateioDivergente,
  regraRateioInsuficiente,
  regraSemDadoNoPeriodo,
} from "./regras";
import { gerarRascunhoResposta } from "./resposta";

function diasEntre(inicioIso: string, fimIso: string): string[] {
  const dias: string[] = [];
  const cursor = new Date(inicioIso + "T00:00:00Z");
  const fim = new Date(fimIso + "T00:00:00Z");
  while (cursor.getTime() <= fim.getTime()) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

function diasNoMesDentroDoPeriodo(ano: number, mes: number, inicio: Date, fim: Date): number {
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  const fimMes = new Date(Date.UTC(ano, mes, 0));
  const de = inicio.getTime() > inicioMes.getTime() ? inicio : inicioMes;
  const ate = fim.getTime() < fimMes.getTime() ? fim : fimMes;
  if (de.getTime() > ate.getTime()) return 0;
  return Math.round((ate.getTime() - de.getTime()) / 86400000) + 1;
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}

function parseParametroNumero(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const numero = Number(valor);
  return Number.isNaN(numero) ? null : numero;
}

// monta o diagnóstico completo de uma fatura conferida e o vincula a um
// chamado (seção 5 do pedido). recorta a geração pelo período exato de
// leitura da fatura, nunca por mês calendário. retorna o id do diagnóstico
// criado.
export async function gerarDiagnostico(faturaId: string, chamadoId: string): Promise<string> {
  const { data: fatura, error: erroFatura } = await supabase
    .from("fatura")
    .select("*")
    .eq("id", faturaId)
    .single();
  if (erroFatura || !fatura) throw new Error("fatura não encontrada");
  if (fatura.status !== "conferida") {
    throw new Error("só é possível diagnosticar uma fatura conferida");
  }
  if (!fatura.periodo_inicio || !fatura.periodo_fim) {
    throw new Error("fatura sem período de leitura definido, confira os campos antes de diagnosticar");
  }

  const { data: uc, error: erroUc } = await supabase
    .from("unidade_consumidora")
    .select("id, tipo, usina_id, cliente_id")
    .eq("id", fatura.unidade_consumidora_id)
    .single();
  if (erroUc || !uc) throw new Error("unidade consumidora não encontrada");
  if (!uc.usina_id) {
    throw new Error("esta unidade consumidora não está amarrada a uma usina; ajuste na ficha da usina antes de diagnosticar");
  }

  const { data: usina, error: erroUsina } = await supabase
    .from("usina")
    .select("id, autoconsumo_estimado_pct")
    .eq("id", uc.usina_id)
    .single();
  if (erroUsina || !usina) throw new Error("usina não encontrada");

  const { data: cliente } = await supabase.from("cliente").select("nome").eq("id", uc.cliente_id).maybeSingle();

  const diasNoPeriodo = diasEntre(fatura.periodo_inicio, fatura.periodo_fim);
  const inicioData = new Date(fatura.periodo_inicio + "T00:00:00Z");
  const fimData = new Date(fatura.periodo_fim + "T00:00:00Z");

  // rateio vigente para esta uc/usina na data de fechamento da fatura
  const { data: rateios } = await supabase
    .from("rateio")
    .select("percentual, vigencia_inicio, vigencia_fim")
    .eq("unidade_consumidora_id", uc.id)
    .eq("usina_id", usina.id)
    .lte("vigencia_inicio", fatura.periodo_fim);
  const rateioVigente = (rateios ?? []).find(
    (r) => !r.vigencia_fim || r.vigencia_fim >= fatura.periodo_fim
  );

  // leituras da usina no período, uma linha por dia: prefere o agregado da
  // usina quando existe; senão soma as leituras por dispositivo do dia
  const { data: leiturasBrutas } = await supabase
    .from("leitura_geracao")
    .select("data, dispositivo_id, energia_kwh")
    .eq("usina_id", usina.id)
    .gte("data", fatura.periodo_inicio)
    .lte("data", fatura.periodo_fim);

  const porDiaAgregada = new Map<string, number>();
  const porDiaSomaDispositivos = new Map<string, number>();
  for (const l of leiturasBrutas ?? []) {
    if (l.dispositivo_id === null) {
      porDiaAgregada.set(l.data, (porDiaAgregada.get(l.data) ?? 0) + l.energia_kwh);
    } else {
      porDiaSomaDispositivos.set(l.data, (porDiaSomaDispositivos.get(l.data) ?? 0) + l.energia_kwh);
    }
  }
  const leiturasPorDia: LeituraDia[] = diasNoPeriodo
    .filter((d) => porDiaAgregada.has(d) || porDiaSomaDispositivos.has(d))
    .map((d) => ({
      data: d,
      energiaKwh: porDiaAgregada.get(d) ?? porDiaSomaDispositivos.get(d) ?? 0,
      agregada: porDiaAgregada.has(d),
    }));

  // eventos de dispositivo parado sobrepondo o período, e a mediana diária
  // dos irmãos ativos da mesma usina no período, para estimar energia perdida
  const { data: dispositivosUsina } = await supabase
    .from("dispositivo")
    .select("id, identificador_fabricante")
    .eq("usina_id", usina.id);

  const idsDispositivosUsina = (dispositivosUsina ?? []).map((d) => d.id);
  const eventosBrutos =
    idsDispositivosUsina.length === 0
      ? []
      : (
          await supabase
            .from("evento_dispositivo")
            .select(
              "id, dispositivo_id, estado, inicio, fim, energia_perdida_estimada_kwh, dispositivo:dispositivo_id(identificador_fabricante)"
            )
            .in("dispositivo_id", idsDispositivosUsina)
            .lte("inicio", fatura.periodo_fim)
            .or(`fim.is.null,fim.gte.${fatura.periodo_inicio}`)
        ).data ?? [];

  const eventosDispositivo: EventoDispositivoPeriodo[] = eventosBrutos.map((e: Record<string, unknown>) => ({
    dispositivoId: e.dispositivo_id as string,
    identificadorFabricante:
      (e.dispositivo as { identificador_fabricante?: string } | null)?.identificador_fabricante ?? "dispositivo",
    estado: e.estado as string,
    inicio: e.inicio as string,
    fim: e.fim as string | null,
    energiaPerdidaEstimadaKwh: e.energia_perdida_estimada_kwh as number | null,
  }));

  const dispositivosParadosIds = new Set(
    eventosDispositivo.filter((e) => e.estado === "parado").map((e) => e.dispositivoId)
  );
  const medianaDiariaIrmaos = new Map<string, number>();
  if (dispositivosParadosIds.size > 0) {
    const idsIrmaos = (dispositivosUsina ?? []).map((d) => d.id).filter((id) => !dispositivosParadosIds.has(id));
    if (idsIrmaos.length > 0) {
      const { data: leiturasIrmaos } = await supabase
        .from("leitura_geracao")
        .select("dispositivo_id, energia_kwh")
        .in("dispositivo_id", idsIrmaos)
        .gte("data", fatura.periodo_inicio)
        .lte("data", fatura.periodo_fim);

      const porDispositivo = new Map<string, number[]>();
      for (const l of leiturasIrmaos ?? []) {
        const lista = porDispositivo.get(l.dispositivo_id) ?? [];
        lista.push(l.energia_kwh);
        porDispositivo.set(l.dispositivo_id, lista);
      }
      const medianasIrmaos = [...porDispositivo.values()].map(mediana);
      const medianaGeral = mediana(medianasIrmaos);
      for (const id of dispositivosParadosIds) {
        medianaDiariaIrmaos.set(id, medianaGeral);
      }
    }
  }

  // histórico de faturas conferidas anteriores da mesma uc, mais recente primeiro
  const { data: historicoBruto } = await supabase
    .from("fatura")
    .select("id, periodo_inicio, periodo_fim, consumo_kwh, creditos_usados_kwh, saldo_creditos_kwh")
    .eq("unidade_consumidora_id", uc.id)
    .eq("status", "conferida")
    .neq("id", faturaId)
    .order("periodo_fim", { ascending: false })
    .limit(6);

  const historicoFaturas = (historicoBruto ?? []).map((f) => ({
    id: f.id as string,
    periodoInicio: f.periodo_inicio,
    periodoFim: f.periodo_fim,
    consumoKwh: f.consumo_kwh,
    creditosUsadosKwh: f.creditos_usados_kwh,
    saldoCreditosKwh: f.saldo_creditos_kwh,
  }));

  // fatura mais recente da uc geradora da mesma usina, para a regra de ciclo descasado
  let faturaGeradoraProximaPeriodo: { periodoFim: string } | null = null;
  if (uc.tipo === "beneficiaria") {
    const { data: ucGeradora } = await supabase
      .from("unidade_consumidora")
      .select("id")
      .eq("usina_id", usina.id)
      .eq("tipo", "geradora")
      .maybeSingle();
    if (ucGeradora) {
      const { data: faturaGeradora } = await supabase
        .from("fatura")
        .select("periodo_fim")
        .eq("unidade_consumidora_id", ucGeradora.id)
        .eq("status", "conferida")
        .order("periodo_fim", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (faturaGeradora?.periodo_fim) {
        faturaGeradoraProximaPeriodo = { periodoFim: faturaGeradora.periodo_fim };
      }
    }
  }

  // geração esperada mês a mês, pro-rateada pelos dias do período em cada mês;
  // fica nula se algum mês do período não tiver parâmetro configurado — nunca
  // preenche a lacuna com estimativa silenciosa
  const { data: geracaoEsperadaMensal } = await supabase
    .from("geracao_esperada_mensal")
    .select("mes, energia_esperada_kwh")
    .eq("usina_id", usina.id);
  const esperadaPorMes = new Map((geracaoEsperadaMensal ?? []).map((g) => [g.mes, g.energia_esperada_kwh]));

  const mesesNoPeriodo = new Set<number>();
  for (let m = inicioData.getUTCMonth(); ; m++) {
    const ano = inicioData.getUTCFullYear() + Math.floor(m / 12);
    const mes = (m % 12) + 1;
    mesesNoPeriodo.add(ano * 100 + mes); // chave composta ano*100+mes, ex: 202401 = janeiro/2024
    if (ano > fimData.getUTCFullYear() || (ano === fimData.getUTCFullYear() && mes - 1 >= fimData.getUTCMonth())) break;
  }

  let esperadaAcumulada = 0;
  let esperadaIndisponivel = false;
  for (const chave of mesesNoPeriodo) {
    const ano = Math.floor(chave / 100);
    const mes = chave % 100;
    const esperadaMes = esperadaPorMes.get(mes);
    if (esperadaMes === undefined) {
      esperadaIndisponivel = true;
      break;
    }
    const diasDoMesNoPeriodo = diasNoMesDentroDoPeriodo(ano, mes, inicioData, fimData);
    esperadaAcumulada += (esperadaMes / diasNoMes(ano, mes)) * diasDoMesNoPeriodo;
  }
  const geracaoEsperadaKwhNoPeriodo: number | null = esperadaIndisponivel ? null : esperadaAcumulada;

  const { data: parametrosBrutos } = await supabase
    .from("parametro")
    .select("chave, valor")
    .in("chave", ["limite_divergencia_medidor_pct", "validade_credito_meses"]);
  const parametroPorChave = new Map((parametrosBrutos ?? []).map((p) => [p.chave, p.valor]));

  const ctx: ContextoDiagnostico = {
    fatura: {
      id: fatura.id,
      periodoInicio: fatura.periodo_inicio,
      periodoFim: fatura.periodo_fim,
      consumoKwh: fatura.consumo_kwh,
      injetadaKwh: fatura.injetada_kwh,
      creditosUsadosKwh: fatura.creditos_usados_kwh,
      saldoCreditosKwh: fatura.saldo_creditos_kwh,
      percentualRateioAplicado: fatura.percentual_rateio_aplicado,
      valorTotal: fatura.valor_total,
    },
    unidadeConsumidora: { id: uc.id, tipo: uc.tipo },
    usina: { id: usina.id, autoconsumoEstimadoPct: usina.autoconsumo_estimado_pct },
    rateioVigentePct: rateioVigente?.percentual ?? null,
    leiturasPorDia,
    diasNoPeriodo,
    eventosDispositivo,
    medianaDiariaIrmaos,
    historicoFaturas,
    faturaGeradoraProximaPeriodo,
    geracaoEsperadaKwhNoPeriodo,
    parametros: {
      limiteDivergenciaMedidorPct: parseParametroNumero(parametroPorChave.get("limite_divergencia_medidor_pct")),
      validadeCreditoMeses: parseParametroNumero(parametroPorChave.get("validade_credito_meses")),
    },
  };

  const agregados = calcularAgregados(ctx);

  const alertas: AlertaGerado[] = [
    regraDivergenciaMedicao(ctx, agregados.injecaoEsperadaKwh, agregados.diferencaMedidorKwh),
    regraCicloDescasado(ctx),
    regraDispositivoParadoNoPeriodo(ctx),
    regraSemDadoNoPeriodo(agregados.diasSemDado),
    regraRateioInsuficiente(ctx),
    regraRateioDivergente(ctx, agregados.injecaoEsperadaKwh),
    regraConsumoAumentou(ctx, agregados.geracaoPeriodoKwh),
    regraCreditoExpirado(ctx),
  ].filter((a): a is AlertaGerado => a !== null);

  alertas.sort((a, b) => (b.impactoEstimadoReais ?? 0) - (a.impactoEstimadoReais ?? 0));

  const { data: diagnostico, error: erroDiagnostico } = await supabase
    .from("diagnostico")
    .insert({
      chamado_id: chamadoId,
      fatura_id: faturaId,
      geracao_periodo_kwh: agregados.geracaoPeriodoKwh,
      geracao_esperada_kwh: geracaoEsperadaKwhNoPeriodo,
      injecao_esperada_kwh: agregados.injecaoEsperadaKwh,
      diferenca_medidor_kwh: agregados.diferencaMedidorKwh,
      dias_sem_dado: agregados.diasSemDado,
    })
    .select("id")
    .single();
  if (erroDiagnostico || !diagnostico) throw erroDiagnostico ?? new Error("falha ao gravar diagnóstico");

  if (alertas.length > 0) {
    const { error: erroAlertas } = await supabase.from("alerta").insert(
      alertas.map((a) => ({
        diagnostico_id: diagnostico.id,
        causa: a.causa,
        confianca: a.confianca,
        impacto_estimado_reais: a.impactoEstimadoReais,
        titulo: a.titulo,
        descricao: a.descricao,
      }))
    );
    if (erroAlertas) throw erroAlertas;
  }

  const rascunho = gerarRascunhoResposta(cliente?.nome ?? "cliente", alertas);
  await supabase.from("resposta_cliente").insert({
    chamado_id: chamadoId,
    texto: rascunho,
    status: "rascunho",
  });

  return diagnostico.id as string;
}
