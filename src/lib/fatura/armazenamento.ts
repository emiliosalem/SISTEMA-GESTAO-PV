import { supabase } from "../supabase";

export async function enviarArquivoFatura(ucId: string, arquivo: File): Promise<string> {
  const caminho = `${ucId}/${Date.now()}-${arquivo.name}`;
  const { error } = await supabase.storage.from("faturas").upload(caminho, arquivo, {
    contentType: arquivo.type,
  });
  if (error) throw error;
  return caminho;
}

export async function gerarUrlAssinadaFatura(caminho: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("faturas").createSignedUrl(caminho, 300);
  if (error) return null;
  return data.signedUrl;
}
