import { supabase } from "../supabase";
import { executarComLimite } from "./concorrencia";
import type { LinhaValidada } from "./tipos";

// grava só as linhas marcadas como válidas na fase de validação; linhas com
// erro nunca chegam aqui, então uma importação com problema em parte do
// arquivo ainda grava o resto (importação parcial, seção 8 do pedido)
export async function gravarLinhasValidas(
  linhas: LinhaValidada[],
  aoProgredir?: (feitos: number, total: number) => void
): Promise<LinhaValidada[]> {
  const validas = linhas.filter((l) => l.status === "valida");
  if (validas.length === 0) return linhas;

  await executarComLimite(
    validas,
    4,
    async (linha) => {
      const { error } = await supabase
        .from(linha.tabela as string)
        .upsert(linha.registro as Record<string, unknown>, { onConflict: linha.onConflict });

      if (error) {
        linha.status = "falhou_ao_gravar";
        linha.mensagem = error.message;
      } else {
        linha.status = "gravada";
      }
    },
    aoProgredir
  );

  return linhas;
}
