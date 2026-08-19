// marca de string inverter; ordem de implementação entre as quatro marcas de
// string ainda em aberto (seção 4 do pedido) — o solarz cobre o intervalo.
import { criarAdaptadorEsqueleto } from "./esqueleto.ts";

export const adaptadorSolis = criarAdaptadorEsqueleto({
  fabricante: "solis",
  variavelAmbienteCredencial: "SOLIS_API_KEY",
});
