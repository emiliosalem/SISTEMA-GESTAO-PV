// último elo da cadeia de resolução (seção 4 do pedido): sempre disponível,
// porque é preenchido por gente, não por api. não busca nada de fora — só
// relê o que a tela de entrada manual já gravou direto em leitura_geracao.
// o motor de coleta não chama buscarGeracaoDiaria deste adaptador (não há
// nada nele para "coletar"); ele existe para a cadeia de resolução sempre
// ter um fallback com disponivel() = true.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type {
  AdaptadorFabricante,
  CapacidadesAdaptador,
  DispositivoBruto,
  LeituraBruta,
  UsinaColeta,
} from "../tipos.ts";

export function criarAdaptadorManual(supabase: SupabaseClient): AdaptadorFabricante {
  return {
    fabricante: "manual",

    capacidades(): CapacidadesAdaptador {
      // a granularidade real depende do que a pessoa digitou (usina ou
      // dispositivo específico); "usina" é o piso garantido
      return { granularidade: "usina", temHistorico: true, limiteChamadasDia: null };
    },

    disponivel(): boolean {
      return true;
    },

    async listarDispositivos(usina: UsinaColeta): Promise<DispositivoBruto[]> {
      const { data, error } = await supabase
        .from("dispositivo")
        .select("identificador_fabricante, numero_serie, fabricante, tipo, potencia_w")
        .eq("usina_id", usina.id);
      if (error) throw error;
      return (data ?? []).map((d) => ({
        identificadorFabricante: d.identificador_fabricante,
        numeroSerie: d.numero_serie,
        fabricante: d.fabricante,
        tipo: d.tipo,
        potenciaW: d.potencia_w,
      }));
    },

    async buscarGeracaoDiaria(usina: UsinaColeta, de: Date, ate: Date): Promise<LeituraBruta[]> {
      const { data, error } = await supabase
        .from("leitura_geracao")
        .select("dispositivo:dispositivo_id(identificador_fabricante), data, energia_kwh")
        .eq("usina_id", usina.id)
        .eq("fonte", "manual")
        .gte("data", de.toISOString().slice(0, 10))
        .lte("data", ate.toISOString().slice(0, 10));
      if (error) throw error;
      return (data ?? []).map((l: Record<string, unknown>) => ({
        dispositivoIdentificador:
          (l.dispositivo as { identificador_fabricante?: string } | null)?.identificador_fabricante ?? null,
        data: l.data as string,
        energiaKwh: l.energia_kwh as number,
      }));
    },
  };
}
