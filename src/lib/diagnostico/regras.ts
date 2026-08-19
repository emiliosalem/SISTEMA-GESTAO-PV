import type { AlertaGerado, ContextoDiagnostico, ResultadoDiagnostico } from "./tipos";

// tarifa média implícita da própria fatura (valor total / consumo faturado).
// não é número inventado nem norma da aneel: é derivado dos valores reais
// desta fatura, usado só para converter diferenças em kwh em impacto
// estimado em reais. sem consumo ou valor, fica nulo e os alertas que
// dependem dele mostram impacto sem valor em reais, nunca um número chutado.
function tarifaImplicitaPorKwh(consumoKwh: number | null, valorTotal: number | null): number | null {
  if (!consumoKwh || consumoKwh <= 0 || !valorTotal) return null;
  return valorTotal / consumoKwh;
}

export function calcularAgregados(
  ctx: ContextoDiagnostico
): Pick<ResultadoDiagnostico, "geracaoPeriodoKwh" | "injecaoEsperadaKwh" | "diferencaMedidorKwh" | "diasSemDado"> {
  const porDia = new Map(ctx.leiturasPorDia.map((l) => [l.data, l.energiaKwh]));
  let geracaoPeriodoKwh = 0;
  let diasSemDado = 0;
  for (const dia of ctx.diasNoPeriodo) {
    const energia = porDia.get(dia);
    if (energia === undefined) {
      diasSemDado++;
    } else {
      geracaoPeriodoKwh += energia;
    }
  }

  const autoconsumoPct = ctx.usina.autoconsumoEstimadoPct ?? 0;
  const injecaoEsperadaKwh = geracaoPeriodoKwh * (1 - autoconsumoPct / 100);
  const injetadaFatura = ctx.fatura.injetadaKwh ?? 0;
  const diferencaMedidorKwh = injecaoEsperadaKwh - injetadaFatura;

  return { geracaoPeriodoKwh, injecaoEsperadaKwh, diferencaMedidorKwh, diasSemDado };
}

export function regraDivergenciaMedicao(
  ctx: ContextoDiagnostico,
  injecaoEsperadaKwh: number,
  diferencaMedidorKwh: number
): AlertaGerado | null {
  const limite = ctx.parametros.limiteDivergenciaMedidorPct;
  if (limite === null) return null; // parâmetro ausente, regra não roda
  if (injecaoEsperadaKwh <= 0) return null;

  const diferencaPct = (Math.abs(diferencaMedidorKwh) / injecaoEsperadaKwh) * 100;
  if (diferencaPct <= limite) return null;

  const tarifa = tarifaImplicitaPorKwh(ctx.fatura.consumoKwh, ctx.fatura.valorTotal);
  return {
    causa: "divergencia_medicao",
    confianca: "alta",
    impactoEstimadoReais: tarifa ? Math.abs(diferencaMedidorKwh) * tarifa : null,
    titulo: "divergência entre medição e fatura",
    descricao: `a geração medida pelos inversores no período aponta ${injecaoEsperadaKwh.toFixed(1)} kwh injetados (já descontado o autoconsumo estimado), mas a fatura registra ${(ctx.fatura.injetadaKwh ?? 0).toFixed(1)} kwh — diferença de ${diferencaPct.toFixed(1)}%, acima do limite configurado de ${limite}%.`,
  };
}

export function regraCicloDescasado(ctx: ContextoDiagnostico): AlertaGerado | null {
  if (ctx.unidadeConsumidora.tipo !== "beneficiaria") return null;
  if (!ctx.faturaGeradoraProximaPeriodo) return null;

  const fimBeneficiaria = new Date(ctx.fatura.periodoFim);
  const fimGeradora = new Date(ctx.faturaGeradoraProximaPeriodo.periodoFim);
  const defasagemDias = Math.round((fimGeradora.getTime() - fimBeneficiaria.getTime()) / 86400000);

  if (defasagemDias <= 3) return null;

  return {
    causa: "ciclo_descasado",
    confianca: "media",
    impactoEstimadoReais: null,
    titulo: "ciclos de leitura descasados",
    descricao: `a leitura da unidade geradora fecha ${defasagemDias} dias depois da leitura desta unidade beneficiária. os créditos gerados nesse intervalo só aparecem na fatura seguinte, não nesta.`,
  };
}

export function regraDispositivoParadoNoPeriodo(ctx: ContextoDiagnostico): AlertaGerado | null {
  if (ctx.eventosDispositivo.length === 0) return null;

  const tarifa = tarifaImplicitaPorKwh(ctx.fatura.consumoKwh, ctx.fatura.valorTotal);
  let energiaPerdidaTotal = 0;
  const nomes: string[] = [];

  for (const evento of ctx.eventosDispositivo) {
    if (evento.estado !== "parado") continue;
    nomes.push(evento.identificadorFabricante);

    if (evento.energiaPerdidaEstimadaKwh !== null) {
      energiaPerdidaTotal += evento.energiaPerdidaEstimadaKwh;
      continue;
    }

    const inicio = new Date(Math.max(new Date(evento.inicio).getTime(), new Date(ctx.fatura.periodoInicio).getTime()));
    const fim = new Date(
      Math.min(evento.fim ? new Date(evento.fim).getTime() : Date.now(), new Date(ctx.fatura.periodoFim).getTime())
    );
    const diasParado = Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 86400000));
    const medianaIrmaos = ctx.medianaDiariaIrmaos.get(evento.dispositivoId) ?? 0;
    energiaPerdidaTotal += diasParado * medianaIrmaos;
  }

  if (nomes.length === 0 || energiaPerdidaTotal <= 0) return null;

  return {
    causa: "dispositivo_parado",
    confianca: "alta",
    impactoEstimadoReais: tarifa ? energiaPerdidaTotal * tarifa : null,
    titulo: "dispositivo parado durante o período",
    descricao: `${nomes.join(", ")} ficou parado parte do período. estimativa de energia perdida pela mediana dos dispositivos irmãos: ${energiaPerdidaTotal.toFixed(1)} kwh.`,
  };
}

export function regraSemDadoNoPeriodo(diasSemDado: number): AlertaGerado | null {
  if (diasSemDado <= 0) return null;
  return {
    causa: "sem_dado_periodo",
    confianca: "baixa",
    impactoEstimadoReais: null,
    titulo: "faltam dias de leitura no período",
    descricao: `${diasSemDado} dia(s) do período da fatura não têm leitura de geração registrada. o diagnóstico está marcado como parcial — nenhuma lacuna foi preenchida com estimativa.`,
  };
}

const LIMIAR_CRESCIMENTO_CONSUMO_PCT = 20;

export function regraRateioInsuficiente(ctx: ContextoDiagnostico): AlertaGerado | null {
  const historico = ctx.historicoFaturas.filter((f) => f.consumoKwh !== null);
  if (historico.length < 4) return null;

  const recentes = historico.slice(0, 3).map((f) => f.consumoKwh as number);
  const anteriores = historico.slice(3, 6).map((f) => f.consumoKwh as number);
  if (anteriores.length === 0) return null;

  const mediaRecente = media(recentes);
  const mediaAnterior = media(anteriores);
  if (mediaAnterior <= 0) return null;

  const crescimentoPct = ((mediaRecente - mediaAnterior) / mediaAnterior) * 100;
  const consumoNaoCompensado = Math.max(0, (ctx.fatura.consumoKwh ?? 0) - (ctx.fatura.creditosUsadosKwh ?? 0));

  if (crescimentoPct < LIMIAR_CRESCIMENTO_CONSUMO_PCT || consumoNaoCompensado <= 0) return null;

  const tarifa = tarifaImplicitaPorKwh(ctx.fatura.consumoKwh, ctx.fatura.valorTotal);
  return {
    causa: "rateio_insuficiente",
    confianca: "baixa",
    impactoEstimadoReais: tarifa ? consumoNaoCompensado * tarifa : null,
    titulo: "rateio pode não cobrir mais o consumo",
    descricao: `o consumo desta unidade cresceu cerca de ${crescimentoPct.toFixed(0)}% nos últimos ciclos e parte dele não está sendo coberta pelos créditos. vale simular um aumento no percentual de rateio.`,
  };
}

export function regraRateioDivergente(ctx: ContextoDiagnostico, injecaoEsperadaKwh: number): AlertaGerado | null {
  if (ctx.rateioVigentePct === null || ctx.fatura.percentualRateioAplicado === null) return null;

  const diferencaPct = ctx.rateioVigentePct - ctx.fatura.percentualRateioAplicado;
  if (Math.abs(diferencaPct) < 0.5) return null;

  const tarifa = tarifaImplicitaPorKwh(ctx.fatura.consumoKwh, ctx.fatura.valorTotal);
  const impactoKwh = (Math.abs(diferencaPct) / 100) * injecaoEsperadaKwh;

  return {
    causa: "rateio_divergente",
    confianca: "alta",
    impactoEstimadoReais: tarifa ? impactoKwh * tarifa : null,
    titulo: "rateio aplicado diverge do cadastrado",
    descricao: `o percentual aplicado nesta fatura foi ${ctx.fatura.percentualRateioAplicado}%, mas o cadastrado para o período é ${ctx.rateioVigentePct}%. isso é erro de faturamento da distribuidora, não do sistema da usina.`,
  };
}

const TOLERANCIA_GERACAO_ESPERADA_PCT = 15;

export function regraConsumoAumentou(
  ctx: ContextoDiagnostico,
  geracaoPeriodoKwh: number
): AlertaGerado | null {
  if (ctx.geracaoEsperadaKwhNoPeriodo === null || ctx.geracaoEsperadaKwhNoPeriodo <= 0) return null;

  const desvioGeracaoPct =
    (Math.abs(geracaoPeriodoKwh - ctx.geracaoEsperadaKwhNoPeriodo) / ctx.geracaoEsperadaKwhNoPeriodo) * 100;
  if (desvioGeracaoPct > TOLERANCIA_GERACAO_ESPERADA_PCT) return null;

  const historico = ctx.historicoFaturas.filter((f) => f.consumoKwh !== null).slice(0, 6);
  if (historico.length < 3) return null;

  const mediaAnterior = media(historico.map((f) => f.consumoKwh as number));
  const consumoAtual = ctx.fatura.consumoKwh ?? 0;
  if (mediaAnterior <= 0) return null;

  const crescimentoPct = ((consumoAtual - mediaAnterior) / mediaAnterior) * 100;
  if (crescimentoPct < LIMIAR_CRESCIMENTO_CONSUMO_PCT) return null;

  const tarifa = tarifaImplicitaPorKwh(ctx.fatura.consumoKwh, ctx.fatura.valorTotal);
  const consumoExtra = consumoAtual - mediaAnterior;

  return {
    causa: "consumo_aumentou",
    confianca: "alta",
    impactoEstimadoReais: tarifa ? consumoExtra * tarifa : null,
    titulo: "conta subiu por consumo, não por falha da usina",
    descricao: `a usina gerou dentro do esperado para o período (desvio de ${desvioGeracaoPct.toFixed(0)}%). o consumo desta fatura, ${consumoAtual.toFixed(0)} kwh, ficou ${crescimentoPct.toFixed(0)}% acima da média dos últimos ciclos.`,
  };
}

export function regraCreditoExpirado(ctx: ContextoDiagnostico): AlertaGerado | null {
  const validadeMeses = ctx.parametros.validadeCreditoMeses;
  if (validadeMeses === null) return null;

  const historico = ctx.historicoFaturas.filter((f) => f.saldoCreditosKwh !== null);
  if (historico.length < validadeMeses + 1) return null;

  const janela = historico.slice(0, validadeMeses + 1);
  const saldoSempreAcumulado = janela.every((f) => (f.saldoCreditosKwh as number) > 0);
  const saldoNaoDiminuiu = (janela[0].saldoCreditosKwh as number) >= (janela[janela.length - 1].saldoCreditosKwh as number);

  if (!saldoSempreAcumulado || !saldoNaoDiminuiu) return null;

  const tarifa = tarifaImplicitaPorKwh(ctx.fatura.consumoKwh, ctx.fatura.valorTotal);
  const saldoAtual = ctx.fatura.saldoCreditosKwh ?? 0;

  return {
    causa: "credito_expirado",
    confianca: "media",
    impactoEstimadoReais: tarifa ? saldoAtual * tarifa : null,
    titulo: "possível crédito vencido",
    descricao: `o saldo de créditos está acumulado sem cair há pelo menos ${validadeMeses} ciclos, o prazo de validade configurado. parte desse saldo pode ter vencido — vale conferir com a distribuidora.`,
  };
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}
