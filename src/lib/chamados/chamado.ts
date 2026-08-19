import { supabase } from "../supabase";

export const TODOS_TIPOS_CHAMADO = [
  "duvida_fatura",
  "conta_alta",
  "sistema_parado",
  "credito_nao_apareceu",
  "alteracao_rateio",
  "garantia",
] as const;

export type TipoChamado = (typeof TODOS_TIPOS_CHAMADO)[number];

// os quatro tipos que fazem sentido levar à mesa de diagnóstico (giram em
// torno de uma fatura); sistema_parado e garantia não têm fatura para
// diagnosticar
export const TIPOS_CHAMADO_DIAGNOSTICO = [
  "duvida_fatura",
  "conta_alta",
  "credito_nao_apareceu",
  "alteracao_rateio",
] as const;

export type TipoChamadoDiagnostico = (typeof TIPOS_CHAMADO_DIAGNOSTICO)[number];

const ROTULO_TIPO_CHAMADO: Record<TipoChamado, string> = {
  duvida_fatura: "dúvida sobre fatura",
  conta_alta: "conta alta",
  sistema_parado: "sistema parado",
  credito_nao_apareceu: "crédito não apareceu",
  alteracao_rateio: "alteração de rateio",
  garantia: "garantia",
};

export function rotuloTipoChamado(tipo: TipoChamado): string {
  return ROTULO_TIPO_CHAMADO[tipo];
}

// mapeia o tipo de chamado para a chave de sla correspondente na tabela
// parametro. só duvida_fatura e sistema_parado têm chave própria (seção 3);
// os outros tipos não têm sla configurável ainda, então nunca recebem prazo
// calculado — nunca por presunção.
const CHAVE_SLA_POR_TIPO: Partial<Record<TipoChamado, string>> = {
  duvida_fatura: "sla_interno_duvida_fatura",
  sistema_parado: "sla_interno_sistema_parado",
};

async function calcularPrazoSla(tipo: TipoChamado, abertoEm: Date): Promise<string | null> {
  const chave = CHAVE_SLA_POR_TIPO[tipo];
  if (!chave) return null;

  const { data: parametro } = await supabase
    .from("parametro")
    .select("valor, unidade")
    .eq("chave", chave)
    .maybeSingle();

  if (!parametro?.valor || !parametro.unidade) return null;
  const quantidade = Number(parametro.valor);
  if (Number.isNaN(quantidade)) return null;

  const unidade = parametro.unidade.trim().toLowerCase();
  const prazo = new Date(abertoEm);
  if (unidade === "horas" || unidade === "hora") {
    prazo.setHours(prazo.getHours() + quantidade);
  } else if (unidade === "dias" || unidade === "dia") {
    prazo.setDate(prazo.getDate() + quantidade);
  } else {
    return null; // unidade não reconhecida, não presume
  }
  return prazo.toISOString();
}

export async function abrirChamado(params: {
  clienteId: string;
  unidadeConsumidoraId: string | null;
  usinaId: string | null;
  tipo: TipoChamado;
  origem?: "cliente" | "sistema";
}): Promise<string> {
  const abertoEm = new Date();
  const prazoSla = await calcularPrazoSla(params.tipo, abertoEm);

  const { data, error } = await supabase
    .from("chamado")
    .insert({
      cliente_id: params.clienteId,
      unidade_consumidora_id: params.unidadeConsumidoraId,
      usina_id: params.usinaId,
      tipo: params.tipo,
      origem: params.origem ?? "cliente",
      status: "aberto",
      prazo_sla: prazoSla,
      aberto_em: abertoEm.toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("falha ao abrir chamado");
  return data.id as string;
}

// usado pela mesa de diagnóstico (passo 6): abre o chamado que a fatura
// conferida precisa para o motor de diagnóstico rodar (seção 5 do pedido:
// "roda quando uma fatura conferida é vinculada a um chamado")
export async function abrirChamadoParaDiagnostico(params: {
  clienteId: string;
  unidadeConsumidoraId: string;
  usinaId: string | null;
  tipo: TipoChamadoDiagnostico;
}): Promise<string> {
  return abrirChamado({ ...params, origem: "cliente" });
}
