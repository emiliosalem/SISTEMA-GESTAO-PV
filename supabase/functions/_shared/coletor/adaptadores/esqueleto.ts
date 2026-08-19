// fábrica comum aos seis adaptadores de fabricante. nenhum deles tem
// credencial confirmada ainda (seção 4 do pedido), então todos nascem
// indisponíveis e lançando IntegracaoNaoConfigurada. quando a integração de
// um fabricante for liberada, o arquivo daquele fabricante troca disponivel()
// para checar a credencial de verdade e implementa os dois métodos —
// listarDispositivos e buscarGeracaoDiaria — com o endpoint e o modelo de
// autenticação reais, que hoje não temos confirmados e por isso não
// inventamos aqui.

import type {
  AdaptadorFabricante,
  CapacidadesAdaptador,
  DispositivoBruto,
  Fabricante,
  LeituraBruta,
  UsinaColeta,
} from "../tipos.ts";
import { IntegracaoNaoConfigurada } from "../tipos.ts";

interface ConfiguracaoEsqueleto {
  fabricante: Fabricante;
  variavelAmbienteCredencial: string;
}

export function criarAdaptadorEsqueleto(config: ConfiguracaoEsqueleto): AdaptadorFabricante {
  return {
    fabricante: config.fabricante,

    capacidades(): CapacidadesAdaptador {
      return {
        // microinversor/string mppt é o ponto inteiro de ter um adaptador por
        // fabricante — sem isso o motor de diagnóstico não pega o caso do
        // micro parado no meio de um conjunto que continua gerando
        granularidade: "dispositivo",
        // não confirmado com o fabricante ainda; conservador até saber
        temHistorico: false,
        limiteChamadasDia: null,
      };
    },

    disponivel(): boolean {
      // gate mínimo: só verifica se alguém já começou a configurar a
      // credencial. o formato real (api key, oauth, id de estação, etc) não
      // está confirmado, então não modelamos os campos ainda.
      return Boolean(Deno.env.get(config.variavelAmbienteCredencial));
    },

    async listarDispositivos(_usina: UsinaColeta): Promise<DispositivoBruto[]> {
      // TODO quando a integração for liberada: chamar o endpoint de
      // listagem de dispositivos do fabricante e normalizar para
      // DispositivoBruto. endpoint e formato de resposta não confirmados.
      throw new IntegracaoNaoConfigurada(config.fabricante);
    },

    async buscarGeracaoDiaria(
      _usina: UsinaColeta,
      _de: Date,
      _ate: Date
    ): Promise<LeituraBruta[]> {
      // TODO quando a integração for liberada: chamar o endpoint de geração
      // diária por dispositivo e normalizar para LeituraBruta. endpoint e
      // formato de resposta não confirmados.
      throw new IntegracaoNaoConfigurada(config.fabricante);
    },
  };
}
