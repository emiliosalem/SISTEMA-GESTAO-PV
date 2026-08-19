// 82 usinas nesta marca — prioridade 1 de implementação (seção 4 do pedido)
// quando a credencial sair, porque é a maior carteira em microinversor.
import { criarAdaptadorEsqueleto } from "./esqueleto.ts";

export const adaptadorHoymiles = criarAdaptadorEsqueleto({
  fabricante: "hoymiles",
  variavelAmbienteCredencial: "HOYMILES_API_KEY",
});
