import { campoDataOpcional, campoNumericoOpcional, campoObrigatorio } from "./csv";
import { buscarMapaUcsPorNumero } from "./unidadeConsumidora";
import { buscarMapaUsinasPorNomeMonitoramento } from "./usina";
import type { LinhaCsv, LinhaValidada } from "./tipos";

export const colunasModeloRateio = [
  "unidade_consumidora_numero_uc",
  "usina_nome_monitoramento",
  "percentual",
  "vigencia_inicio",
  "vigencia_fim",
];

export async function validarLinhasRateio(linhas: LinhaCsv[]): Promise<LinhaValidada[]> {
  const [ucsPorNumero, usinasPorNome] = await Promise.all([
    buscarMapaUcsPorNumero(),
    buscarMapaUsinasPorNomeMonitoramento(),
  ]);

  return linhas.map((linha, indice) => {
    const erros: string[] = [];
    const ucNumero = campoObrigatorio(linha, "unidade_consumidora_numero_uc", erros);
    const usinaNome = campoObrigatorio(linha, "usina_nome_monitoramento", erros);
    const percentual = campoNumericoOpcional(linha, "percentual", erros);
    const vigenciaInicio = campoDataOpcional(linha, "vigencia_inicio", erros);
    const vigenciaFim = campoDataOpcional(linha, "vigencia_fim", erros);

    if (percentual === null) {
      erros.push('coluna "percentual" é obrigatória');
    } else if (percentual < 0 || percentual > 100) {
      erros.push('coluna "percentual" precisa estar entre 0 e 100');
    }
    if (!vigenciaInicio) erros.push('coluna "vigencia_inicio" é obrigatória');

    const ucId = ucsPorNumero.get(ucNumero);
    if (ucNumero && !ucId) {
      erros.push(`unidade consumidora "${ucNumero}" não encontrada; importe as UCs primeiro`);
    }
    const usinaId = usinasPorNome.get(usinaNome);
    if (usinaNome && !usinaId) {
      erros.push(`usina "${usinaNome}" não encontrada; importe as usinas primeiro`);
    }

    if (erros.length > 0) {
      return { linha: indice + 2, status: "erro", mensagem: erros.join("; ") };
    }

    return {
      linha: indice + 2,
      status: "valida",
      tabela: "rateio",
      onConflict: "unidade_consumidora_id,vigencia_inicio",
      registro: {
        unidade_consumidora_id: ucId,
        usina_id: usinaId,
        percentual,
        vigencia_inicio: vigenciaInicio,
        vigencia_fim: vigenciaFim,
      },
    };
  });
}
