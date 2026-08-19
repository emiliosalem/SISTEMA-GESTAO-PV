import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { AdaptadorFabricante, Fabricante } from "./tipos.ts";
import { adaptadorHoymiles } from "./adaptadores/hoymiles.ts";
import { adaptadorApsystems } from "./adaptadores/apsystems.ts";
import { adaptadorGrowatt } from "./adaptadores/growatt.ts";
import { adaptadorSungrow } from "./adaptadores/sungrow.ts";
import { adaptadorSolis } from "./adaptadores/solis.ts";
import { adaptadorHuawei } from "./adaptadores/huawei.ts";
import { adaptadorSolarz } from "./adaptadores/solarz.ts";
import { criarAdaptadorManual } from "./adaptadores/manual.ts";

export const ADAPTADORES_FABRICANTE: Record<Fabricante, AdaptadorFabricante> = {
  hoymiles: adaptadorHoymiles,
  apsystems: adaptadorApsystems,
  growatt: adaptadorGrowatt,
  sungrow: adaptadorSungrow,
  solis: adaptadorSolis,
  huawei: adaptadorHuawei,
};

export type FonteDados = "api_fabricante" | "solarz" | "manual";

export interface FonteResolvida {
  fonte: FonteDados;
  adaptador: AdaptadorFabricante;
}

// cadeia de resolução da fonte de dados de uma usina (seção 4 do pedido):
// 1. adaptador do próprio fabricante, se disponível — fonte preferida,
//    porque entrega dispositivo individual e não depende de terceiro
// 2. solarz, cobertura para os fabricantes cuja api ainda não estiver liberada
// 3. entrada manual, sempre disponível como último recurso
export function resolverFonteAutomatica(
  fabricantePrincipal: Fabricante | null,
  supabase: SupabaseClient
): FonteResolvida {
  if (fabricantePrincipal) {
    const adaptador = ADAPTADORES_FABRICANTE[fabricantePrincipal];
    if (adaptador?.disponivel()) {
      return { fonte: "api_fabricante", adaptador };
    }
  }
  if (adaptadorSolarz.disponivel()) {
    return { fonte: "solarz", adaptador: adaptadorSolarz };
  }
  return { fonte: "manual", adaptador: criarAdaptadorManual(supabase) };
}

// respeita a escolha manual gravada na ficha da usina (editável, seção 4),
// sem cair de volta para a cadeia automática — se a fonte escolhida não
// estiver disponível, a coleta desta usina simplesmente é pulada nesta
// rodada, e não silenciosamente trocada para outra fonte
export function resolverFonteFixada(
  fonteFixada: FonteDados,
  fabricantePrincipal: Fabricante | null,
  supabase: SupabaseClient
): AdaptadorFabricante | null {
  if (fonteFixada === "manual") return criarAdaptadorManual(supabase);
  if (fonteFixada === "solarz") return adaptadorSolarz;
  if (fonteFixada === "api_fabricante" && fabricantePrincipal) {
    return ADAPTADORES_FABRICANTE[fabricantePrincipal] ?? null;
  }
  return null;
}
