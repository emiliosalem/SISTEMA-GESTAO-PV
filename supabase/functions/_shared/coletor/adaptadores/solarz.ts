// a cabugi já usa a open api do solarz no comercial, mas não está confirmado
// se o módulo de monitoramento entrega geração por dispositivo ou só o total
// da usina (seção 4 do pedido). por isso a granularidade é configurável por
// variável de ambiente, com valor inicial "usina" — a hipótese conservadora.
// fonte de cobertura para os fabricantes cuja api própria ainda não estiver
// liberada.

import type {
  AdaptadorFabricante,
  CapacidadesAdaptador,
  DispositivoBruto,
  Granularidade,
  LeituraBruta,
  UsinaColeta,
} from "../tipos.ts";
import { IntegracaoNaoConfigurada } from "../tipos.ts";

function granularidadeConfigurada(): Granularidade {
  const valor = Deno.env.get("SOLARZ_GRANULARIDADE");
  return valor === "dispositivo" ? "dispositivo" : "usina";
}

export const adaptadorSolarz: AdaptadorFabricante = {
  fabricante: "solarz",

  capacidades(): CapacidadesAdaptador {
    return {
      granularidade: granularidadeConfigurada(),
      temHistorico: false,
      limiteChamadasDia: null,
    };
  },

  disponivel(): boolean {
    return Boolean(Deno.env.get("SOLARZ_API_KEY"));
  },

  async listarDispositivos(_usina: UsinaColeta): Promise<DispositivoBruto[]> {
    // TODO: endpoint do módulo de monitoramento do solarz não confirmado.
    // quando confirmado, respeitar a granularidade real que a api entrega —
    // se for só total da usina, não listar dispositivos individuais aqui.
    throw new IntegracaoNaoConfigurada("solarz");
  },

  async buscarGeracaoDiaria(_usina: UsinaColeta, _de: Date, _ate: Date): Promise<LeituraBruta[]> {
    // TODO: endpoint de geração diária do solarz não confirmado.
    throw new IntegracaoNaoConfigurada("solarz");
  },
};
