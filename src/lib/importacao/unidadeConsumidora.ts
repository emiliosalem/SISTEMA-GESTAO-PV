import { supabase } from "../supabase";
import { campoEnumOpcional, campoObrigatorio } from "./csv";
import { buscarMapaClientesPorDocumento } from "./cliente";
import { buscarMapaUsinasPorNomeMonitoramento } from "./usina";
import type { LinhaCsv, LinhaValidada } from "./tipos";

const tiposValidos = ["geradora", "beneficiaria"] as const;

export const colunasModeloUnidadeConsumidora = [
  "numero_uc",
  "cliente_documento",
  "usina_nome_monitoramento",
  "tipo",
  "grupo_tarifario",
  "modalidade_compensacao",
  "endereco",
];

export async function validarLinhasUnidadeConsumidora(
  linhas: LinhaCsv[]
): Promise<LinhaValidada[]> {
  const [clientesPorDocumento, usinasPorNome] = await Promise.all([
    buscarMapaClientesPorDocumento(),
    buscarMapaUsinasPorNomeMonitoramento(),
  ]);

  return linhas.map((linha, indice) => {
    const erros: string[] = [];
    const numeroUc = campoObrigatorio(linha, "numero_uc", erros);
    const clienteDocumento = campoObrigatorio(linha, "cliente_documento", erros);
    const tipo = campoEnumOpcional(linha, "tipo", tiposValidos, erros);
    const usinaNome = (linha.usina_nome_monitoramento ?? "").trim();

    if (!tipo) erros.push('coluna "tipo" é obrigatória');

    const clienteId = clientesPorDocumento.get(clienteDocumento);
    if (clienteDocumento && !clienteId) {
      erros.push(`cliente com documento "${clienteDocumento}" não encontrado; importe os clientes primeiro`);
    }

    let usinaId: string | null = null;
    if (usinaNome) {
      usinaId = usinasPorNome.get(usinaNome) ?? null;
      if (!usinaId) {
        erros.push(`usina "${usinaNome}" não encontrada; importe as usinas primeiro`);
      }
    }

    if (erros.length > 0) {
      return { linha: indice + 2, status: "erro", mensagem: erros.join("; ") };
    }

    return {
      linha: indice + 2,
      status: "valida",
      tabela: "unidade_consumidora",
      onConflict: "numero_uc",
      registro: {
        numero_uc: numeroUc,
        cliente_id: clienteId,
        usina_id: usinaId,
        tipo,
        grupo_tarifario: (linha.grupo_tarifario ?? "").trim() || null,
        modalidade_compensacao: (linha.modalidade_compensacao ?? "").trim() || null,
        endereco: (linha.endereco ?? "").trim() || null,
      },
    };
  });
}

export async function buscarMapaUcsPorNumero(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("unidade_consumidora").select("id, numero_uc");
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.numero_uc, u.id as string]));
}
