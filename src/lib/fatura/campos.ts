// lista dos campos extraíveis de uma fatura, na ordem em que aparecem na
// conferência. as chaves precisam bater com o input_schema da tool
// "registrar_campos_fatura" na edge function (supabase/functions/extrair-fatura)
// e com as colunas correspondentes na tabela fatura.
export type TipoCampoFatura = "texto" | "numero" | "data";

export interface DefinicaoCampoFatura {
  campo: string;
  rotulo: string;
  tipo: TipoCampoFatura;
}

export const CAMPOS_FATURA: DefinicaoCampoFatura[] = [
  { campo: "periodo_inicio", rotulo: "período, início", tipo: "data" },
  { campo: "periodo_fim", rotulo: "período, fim", tipo: "data" },
  { campo: "consumo_kwh", rotulo: "consumo (kwh)", tipo: "numero" },
  { campo: "injetada_kwh", rotulo: "energia injetada (kwh)", tipo: "numero" },
  { campo: "creditos_usados_kwh", rotulo: "créditos usados (kwh)", tipo: "numero" },
  { campo: "saldo_creditos_kwh", rotulo: "saldo de créditos (kwh)", tipo: "numero" },
  { campo: "percentual_rateio_aplicado", rotulo: "percentual de rateio aplicado (%)", tipo: "numero" },
  { campo: "bandeira", rotulo: "bandeira tarifária", tipo: "texto" },
  { campo: "contribuicao_iluminacao_publica", rotulo: "contribuição de iluminação pública (r$)", tipo: "numero" },
  { campo: "custo_disponibilidade", rotulo: "custo de disponibilidade (r$)", tipo: "numero" },
  { campo: "valor_total", rotulo: "valor total (r$)", tipo: "numero" },
];

export function bucketConfianca(confianca: number | null): "alta" | "media" | "baixa" | "sem_extracao" {
  if (confianca === null) return "sem_extracao";
  if (confianca >= 0.8) return "alta";
  if (confianca >= 0.5) return "media";
  return "baixa";
}
