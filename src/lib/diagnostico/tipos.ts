export type NivelConfianca = "alta" | "media" | "baixa";

export interface AlertaGerado {
  causa: string;
  confianca: NivelConfianca;
  impactoEstimadoReais: number | null;
  titulo: string;
  descricao: string;
}

export interface LeituraDia {
  data: string;
  energiaKwh: number;
  agregada: boolean;
}

export interface EventoDispositivoPeriodo {
  dispositivoId: string;
  identificadorFabricante: string;
  estado: string;
  inicio: string;
  fim: string | null;
  energiaPerdidaEstimadaKwh: number | null;
}

export interface FaturaHistorico {
  id: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  consumoKwh: number | null;
  creditosUsadosKwh: number | null;
  saldoCreditosKwh: number | null;
}

export interface ContextoDiagnostico {
  fatura: {
    id: string;
    periodoInicio: string;
    periodoFim: string;
    consumoKwh: number | null;
    injetadaKwh: number | null;
    creditosUsadosKwh: number | null;
    saldoCreditosKwh: number | null;
    percentualRateioAplicado: number | null;
    valorTotal: number | null;
  };
  unidadeConsumidora: {
    id: string;
    tipo: "geradora" | "beneficiaria";
  };
  usina: {
    id: string;
    autoconsumoEstimadoPct: number | null;
  };
  rateioVigentePct: number | null;
  leiturasPorDia: LeituraDia[];
  diasNoPeriodo: string[];
  eventosDispositivo: EventoDispositivoPeriodo[];
  medianaDiariaIrmaos: Map<string, number>; // dispositivoId -> mediana kwh/dia dos irmãos
  historicoFaturas: FaturaHistorico[]; // ciclos anteriores conferidos, mais recente primeiro
  faturaGeradoraProximaPeriodo: { periodoFim: string } | null;
  geracaoEsperadaKwhNoPeriodo: number | null;
  parametros: {
    limiteDivergenciaMedidorPct: number | null;
    validadeCreditoMeses: number | null;
  };
}

export interface ResultadoDiagnostico {
  geracaoPeriodoKwh: number;
  geracaoEsperadaKwh: number | null;
  injecaoEsperadaKwh: number;
  diferencaMedidorKwh: number;
  diasSemDado: number;
  alertas: AlertaGerado[];
}
