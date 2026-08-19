import { supabase } from "../supabase";
import { campoDataOpcional, campoNumericoOpcional, campoObrigatorio } from "./csv";
import { buscarMapaClientesPorDocumento } from "./cliente";
import type { LinhaCsv, LinhaValidada } from "./tipos";

export const colunasModeloUsina = [
  "cliente_documento",
  "nome_monitoramento",
  "endereco",
  "cidade",
  "potencia_kwp",
  "quantidade_modulos",
  "data_conexao",
  "autoconsumo_estimado_pct",
];

export async function validarLinhasUsina(linhas: LinhaCsv[]): Promise<LinhaValidada[]> {
  const clientesPorDocumento = await buscarMapaClientesPorDocumento();

  return linhas.map((linha, indice) => {
    const erros: string[] = [];
    const clienteDocumento = campoObrigatorio(linha, "cliente_documento", erros);
    const nomeMonitoramento = campoObrigatorio(linha, "nome_monitoramento", erros);
    const potenciaKwp = campoNumericoOpcional(linha, "potencia_kwp", erros);
    const quantidadeModulos = campoNumericoOpcional(linha, "quantidade_modulos", erros);
    const dataConexao = campoDataOpcional(linha, "data_conexao", erros);
    const autoconsumoPct = campoNumericoOpcional(linha, "autoconsumo_estimado_pct", erros);

    if (autoconsumoPct !== null && (autoconsumoPct < 0 || autoconsumoPct > 100)) {
      erros.push(`coluna "autoconsumo_estimado_pct" precisa estar entre 0 e 100`);
    }

    const clienteId = clientesPorDocumento.get(clienteDocumento);
    if (clienteDocumento && !clienteId) {
      erros.push(`cliente com documento "${clienteDocumento}" não encontrado; importe os clientes primeiro`);
    }

    if (erros.length > 0) {
      return { linha: indice + 2, status: "erro", mensagem: erros.join("; ") };
    }

    return {
      linha: indice + 2,
      status: "valida",
      tabela: "usina",
      onConflict: "nome_monitoramento",
      registro: {
        cliente_id: clienteId,
        nome_monitoramento: nomeMonitoramento,
        endereco: (linha.endereco ?? "").trim() || null,
        cidade: (linha.cidade ?? "").trim() || null,
        potencia_kwp: potenciaKwp,
        quantidade_modulos: quantidadeModulos,
        data_conexao: dataConexao,
        autoconsumo_estimado_pct: autoconsumoPct,
      },
    };
  });
}

export async function buscarMapaUsinasPorNomeMonitoramento(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("usina").select("id, nome_monitoramento");
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.nome_monitoramento, u.id as string]));
}
