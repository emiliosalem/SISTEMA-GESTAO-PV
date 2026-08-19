import type { AlertaGerado } from "./tipos";

// frases em linguagem sem termo técnico, uma por causa. o rascunho nunca
// sai sem aprovação humana — isso é reforçado na tela, não aqui.
const FRASE_POR_CAUSA: Record<string, string> = {
  divergencia_medicao:
    "verificamos a geração da sua usina no período e notamos uma diferença entre o que os equipamentos mediram e o que aparece na fatura. vamos apurar isso e te damos um retorno.",
  ciclo_descasado:
    "o ciclo de leitura da sua usina fechou alguns dias depois do ciclo desta unidade, então parte dos créditos gerados aparece só na próxima fatura, não nesta.",
  dispositivo_parado:
    "identificamos que um dos equipamentos da sua usina ficou parado durante parte do período, o que reduziu a geração. já estamos providenciando a verificação.",
  sem_dado_periodo:
    "não conseguimos confirmar a geração completa da sua usina neste período por falta de dados de alguns dias. estamos regularizando o monitoramento.",
  rateio_insuficiente:
    "o consumo desta unidade cresceu nos últimos meses e o percentual de créditos recebido pode não cobrir mais essa demanda. podemos simular um ajuste, se desejar.",
  rateio_divergente:
    "percebemos que o percentual de créditos aplicado pela distribuidora nesta fatura está diferente do combinado. vamos entrar em contato com a distribuidora para corrigir.",
  consumo_aumentou:
    "a geração da sua usina está normal para o período. o valor da conta subiu porque o consumo de energia da unidade foi maior que o habitual nos últimos ciclos.",
  credito_expirado:
    "notamos que parte do saldo de créditos pode ter atingido o prazo de validade. vamos confirmar isso com a distribuidora.",
};

export function gerarRascunhoResposta(nomeCliente: string, alertasOrdenadosPorImpacto: AlertaGerado[]): string {
  const saudacao = `olá, ${nomeCliente}, tudo bem?`;

  if (alertasOrdenadosPorImpacto.length === 0) {
    return `${saudacao}\n\nconferimos a fatura e a geração da sua usina no período e não identificamos nenhuma inconsistência. qualquer dúvida, estamos à disposição.`;
  }

  const principais = alertasOrdenadosPorImpacto.slice(0, 2);
  const corpo = principais
    .map((a) => FRASE_POR_CAUSA[a.causa] ?? a.descricao)
    .join("\n\n");

  return `${saudacao}\n\n${corpo}\n\nqualquer dúvida, estamos à disposição.`;
}
