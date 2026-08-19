import { supabase } from "../supabase";
import { campoObrigatorio } from "./csv";
import type { LinhaCsv, LinhaValidada } from "./tipos";

export const colunasModeloCliente = ["nome", "documento", "telefone", "email"];

export async function validarLinhasCliente(linhas: LinhaCsv[]): Promise<LinhaValidada[]> {
  return linhas.map((linha, indice) => {
    const erros: string[] = [];
    const nome = campoObrigatorio(linha, "nome", erros);
    const documento = campoObrigatorio(linha, "documento", erros);
    const telefone = (linha.telefone ?? "").trim() || null;
    const email = (linha.email ?? "").trim() || null;

    if (erros.length > 0) {
      return { linha: indice + 2, status: "erro", mensagem: erros.join("; ") };
    }

    return {
      linha: indice + 2,
      status: "valida",
      tabela: "cliente",
      onConflict: "documento",
      registro: { nome, documento, telefone, email },
    };
  });
}

export async function buscarMapaClientesPorDocumento(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("cliente").select("id, documento");
  if (error) throw error;
  return new Map((data ?? []).map((c) => [c.documento, c.id as string]));
}
