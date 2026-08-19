import { supabase } from "../supabase";

export interface CampoExtraido {
  valor: string;
  confianca: number;
}

export interface ResultadoExtracao {
  campos?: Record<string, CampoExtraido>;
  semChave?: boolean;
  erro?: string;
}

export async function extrairCamposFatura(
  caminhoArquivo: string,
  mimeType: string
): Promise<ResultadoExtracao> {
  const { data, error } = await supabase.functions.invoke("extrair-fatura", {
    body: { caminho_arquivo: caminhoArquivo, mime_type: mimeType },
  });

  if (error) {
    return { erro: error.message };
  }
  return data as ResultadoExtracao;
}
