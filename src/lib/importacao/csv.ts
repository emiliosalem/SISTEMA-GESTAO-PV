import Papa from "papaparse";
import type { LinhaCsv } from "./tipos";

export function lerArquivoCsv(arquivo: File): Promise<LinhaCsv[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<LinhaCsv>(arquivo, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (cabecalho) => cabecalho.trim(),
      transform: (valor) => valor.trim(),
      complete: (resultado) => resolve(resultado.data),
      error: (erro: Error) => reject(erro),
    });
  });
}

export function baixarModeloCsv(nomeArquivo: string, colunas: string[]) {
  const conteudo = colunas.join(",") + "\n";
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

export function campoObrigatorio(
  linha: LinhaCsv,
  coluna: string,
  erros: string[]
): string {
  const valor = (linha[coluna] ?? "").trim();
  if (!valor) {
    erros.push(`coluna "${coluna}" é obrigatória`);
  }
  return valor;
}

export function campoNumericoOpcional(
  linha: LinhaCsv,
  coluna: string,
  erros: string[]
): number | null {
  const bruto = (linha[coluna] ?? "").trim();
  if (!bruto) return null;
  const valor = Number(bruto.replace(",", "."));
  if (Number.isNaN(valor)) {
    erros.push(`coluna "${coluna}" precisa ser um número, recebeu "${bruto}"`);
    return null;
  }
  return valor;
}

export function campoDataOpcional(
  linha: LinhaCsv,
  coluna: string,
  erros: string[]
): string | null {
  const bruto = (linha[coluna] ?? "").trim();
  if (!bruto) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto)) {
    erros.push(`coluna "${coluna}" precisa estar no formato AAAA-MM-DD, recebeu "${bruto}"`);
    return null;
  }
  return bruto;
}

export function campoEnumOpcional<T extends string>(
  linha: LinhaCsv,
  coluna: string,
  valoresValidos: readonly T[],
  erros: string[]
): T | null {
  const bruto = (linha[coluna] ?? "").trim().toLowerCase();
  if (!bruto) return null;
  if (!valoresValidos.includes(bruto as T)) {
    erros.push(
      `coluna "${coluna}" precisa ser um de: ${valoresValidos.join(", ")}, recebeu "${bruto}"`
    );
    return null;
  }
  return bruto as T;
}
