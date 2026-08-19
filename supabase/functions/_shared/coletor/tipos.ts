// tipos e contrato comuns a todos os adaptadores de fabricante (seção 4 do
// pedido). o motor de coleta e o motor de diagnóstico só conhecem este
// formato normalizado — nunca sabem de qual marca veio o dado.

export type Fabricante =
  | "hoymiles"
  | "apsystems"
  | "growatt"
  | "sungrow"
  | "solis"
  | "huawei";

export type Granularidade = "dispositivo" | "usina";

export interface UsinaColeta {
  id: string;
  nomeMonitoramento: string;
}

export interface DispositivoBruto {
  identificadorFabricante: string;
  numeroSerie: string | null;
  fabricante: Fabricante;
  tipo: "microinversor" | "string_mppt";
  potenciaW: number | null;
}

export interface LeituraBruta {
  dispositivoIdentificador: string | null; // nulo quando a leitura é agregada da usina
  data: string; // AAAA-MM-DD
  energiaKwh: number;
}

export interface CapacidadesAdaptador {
  granularidade: Granularidade;
  temHistorico: boolean;
  limiteChamadasDia: number | null;
}

export interface AdaptadorFabricante {
  fabricante: string;
  capacidades(): CapacidadesAdaptador;
  disponivel(): boolean;
  listarDispositivos(usina: UsinaColeta): Promise<DispositivoBruto[]>;
  buscarGeracaoDiaria(usina: UsinaColeta, de: Date, ate: Date): Promise<LeituraBruta[]>;
}

// lançado por qualquer adaptador cujo disponivel() é falso; o motor de
// coleta captura este erro e segue para o próximo elo da cadeia de
// resolução em vez de derrubar a coleta inteira
export class IntegracaoNaoConfigurada extends Error {
  constructor(fabricante: string) {
    super(`integração com ${fabricante} ainda não está configurada`);
    this.name = "IntegracaoNaoConfigurada";
  }
}
