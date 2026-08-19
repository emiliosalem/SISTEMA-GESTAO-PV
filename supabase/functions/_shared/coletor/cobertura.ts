export type Cobertura = "completa" | "parcial" | "sem_monitoramento";

// classifica a cobertura de monitoramento de uma usina a partir do que
// realmente existe em leitura_geracao (seção 4 do pedido):
// completa = leitura por dispositivo, todas as regras do motor rodam;
// parcial = só o total da usina, não detecta dispositivo parado sozinho;
// sem_monitoramento = nada recente, diagnóstico depende só da fatura.
export function classificarCobertura(
  temLeituraRecentePorDispositivo: boolean,
  temLeituraRecenteAgregada: boolean
): Cobertura {
  if (temLeituraRecentePorDispositivo) return "completa";
  if (temLeituraRecenteAgregada) return "parcial";
  return "sem_monitoramento";
}
