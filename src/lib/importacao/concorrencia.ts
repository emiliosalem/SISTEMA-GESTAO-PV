// roda uma tarefa por item com um limite de execuções simultâneas, para não
// disparar centenas de requisições ao supabase de uma vez em importações grandes
export async function executarComLimite<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T, indice: number) => Promise<R>,
  aoProgredir?: (feitos: number, total: number) => void
): Promise<R[]> {
  const resultados: R[] = new Array(itens.length);
  let proximoIndice = 0;
  let feitos = 0;

  async function trabalhador() {
    while (proximoIndice < itens.length) {
      const indice = proximoIndice++;
      resultados[indice] = await tarefa(itens[indice], indice);
      feitos++;
      aoProgredir?.(feitos, itens.length);
    }
  }

  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, trabalhador);
  await Promise.all(trabalhadores);
  return resultados;
}
