// 30 usinas nesta marca — prioridade 2 de implementação (seção 4 do pedido)
// quando a credencial sair.
import { criarAdaptadorEsqueleto } from "./esqueleto.ts";

export const adaptadorApsystems = criarAdaptadorEsqueleto({
  fabricante: "apsystems",
  variavelAmbienteCredencial: "APSYSTEMS_API_KEY",
});
