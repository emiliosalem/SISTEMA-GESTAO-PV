// marca de string inverter; ordem de implementação entre as quatro marcas de
// string ainda em aberto (seção 4 do pedido) — o solarz cobre o intervalo.
import { criarAdaptadorEsqueleto } from "./esqueleto.ts";

export const adaptadorSungrow = criarAdaptadorEsqueleto({
  fabricante: "sungrow",
  variavelAmbienteCredencial: "SUNGROW_API_KEY",
});
