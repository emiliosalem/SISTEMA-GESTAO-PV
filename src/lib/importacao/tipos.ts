export interface LinhaCsv {
  [coluna: string]: string;
}

export type StatusLinhaImportacao = "valida" | "erro" | "gravada" | "falhou_ao_gravar";

export interface LinhaValidada {
  linha: number;
  status: StatusLinhaImportacao;
  mensagem?: string;
  registro?: Record<string, unknown>;
  onConflict?: string;
  tabela?: string;
}
