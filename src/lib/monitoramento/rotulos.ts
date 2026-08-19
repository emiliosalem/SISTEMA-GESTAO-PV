export const ROTULO_ESTADO_DISPOSITIVO: Record<string, string> = {
  normal: "normal",
  abaixo_dos_pares: "abaixo dos pares",
  parado: "parado",
  sem_comunicacao: "sem comunicação",
};

export const COR_ESTADO_DISPOSITIVO: Record<string, string> = {
  normal: "bg-verde-bg text-verde",
  abaixo_dos_pares: "bg-ambar-bg text-ambar",
  parado: "bg-vermelho-bg text-vermelho",
  sem_comunicacao: "bg-metrica-bg text-tinta-suave",
};

export const ROTULO_COBERTURA: Record<string, string> = {
  completa: "completa",
  parcial: "parcial",
  sem_monitoramento: "sem monitoramento",
};

export const COR_COBERTURA: Record<string, string> = {
  completa: "bg-verde-bg text-verde",
  parcial: "bg-ambar-bg text-ambar",
  sem_monitoramento: "bg-vermelho-bg text-vermelho",
};

export const ROTULO_FONTE: Record<string, string> = {
  api_fabricante: "api do fabricante",
  solarz: "solarz",
  manual: "entrada manual",
};

// ordem de severidade para "dispositivos com problema sobem para o topo"
// (seção 7 do pedido): parado é dinheiro saindo, sem comunicação é
// visibilidade perdida, abaixo dos pares é o sinal mais leve.
export const PRIORIDADE_ESTADO: Record<string, number> = {
  parado: 0,
  sem_comunicacao: 1,
  abaixo_dos_pares: 2,
  normal: 3,
};
