import { campoEnumOpcional, campoNumericoOpcional, campoObrigatorio } from "./csv";
import { buscarMapaUsinasPorNomeMonitoramento } from "./usina";
import type { LinhaCsv, LinhaValidada } from "./tipos";

const fabricantesValidos = [
  "hoymiles",
  "apsystems",
  "growatt",
  "sungrow",
  "solis",
  "huawei",
] as const;

const tiposValidos = ["microinversor", "string_mppt"] as const;

export const colunasModeloDispositivo = [
  "usina_nome_monitoramento",
  "fabricante",
  "tipo",
  "identificador_fabricante",
  "numero_serie",
  "potencia_w",
  "quantidade_modulos_atendidos",
];

export async function validarLinhasDispositivo(linhas: LinhaCsv[]): Promise<LinhaValidada[]> {
  const usinasPorNome = await buscarMapaUsinasPorNomeMonitoramento();

  return linhas.map((linha, indice) => {
    const erros: string[] = [];
    const usinaNome = campoObrigatorio(linha, "usina_nome_monitoramento", erros);
    const fabricante = campoEnumOpcional(linha, "fabricante", fabricantesValidos, erros);
    const tipo = campoEnumOpcional(linha, "tipo", tiposValidos, erros);
    const identificador = campoObrigatorio(linha, "identificador_fabricante", erros);
    const potenciaW = campoNumericoOpcional(linha, "potencia_w", erros);
    const quantidadeModulosAtendidos = campoNumericoOpcional(linha, "quantidade_modulos_atendidos", erros);

    if (!fabricante) erros.push('coluna "fabricante" é obrigatória');
    if (!tipo) erros.push('coluna "tipo" é obrigatória');

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
      tabela: "dispositivo",
      onConflict: "usina_id,identificador_fabricante",
      registro: {
        usina_id: usinaId,
        fabricante,
        tipo,
        identificador_fabricante: identificador,
        numero_serie: (linha.numero_serie ?? "").trim() || null,
        potencia_w: potenciaW,
        quantidade_modulos_atendidos: quantidadeModulosAtendidos,
      },
    };
  });
}
