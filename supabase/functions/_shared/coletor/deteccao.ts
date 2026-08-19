// detecção contínua (seção 5 do pedido): comparação entre pares e detecção
// de "sem comunicação". roda uma vez por usina, chamada pela rotina diária
// de coleta (coletar-geracao), depois que a leitura do dia já foi gravada.

// deno-lint-ignore no-explicit-any
type Cliente = any;

// dispositivo sem leitura nova há mais desse tanto de dias conta como sem
// comunicação. não é norma nem número regulatório, é um heurístico técnico
// de monitoramento — por isso fica como constante, diferente dos limiares
// da comparação entre pares, que a seção 5 pede explicitamente configuráveis
const DIAS_SEM_COMUNICACAO = 2;

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}

function dataParaTimestamp(data: string): string {
  return new Date(data + "T00:00:00Z").toISOString();
}

async function buscarLimiares(supabase: Cliente): Promise<{ abaixoDosPares: number | null; parado: number | null }> {
  const { data } = await supabase
    .from("parametro")
    .select("chave, valor")
    .in("chave", ["limiar_abaixo_dos_pares_pct", "limiar_parado_pct"]);
  const mapa = new Map((data ?? []).map((p: { chave: string; valor: string | null }) => [p.chave, p.valor]));
  const parse = (v: unknown) => (v ? Number(v) : null);
  return {
    abaixoDosPares: parse(mapa.get("limiar_abaixo_dos_pares_pct")),
    parado: parse(mapa.get("limiar_parado_pct")),
  };
}

async function abrirChamadoSistemaParado(supabase: Cliente, usinaId: string) {
  const { data: chamadoExistente } = await supabase
    .from("chamado")
    .select("id")
    .eq("usina_id", usinaId)
    .eq("tipo", "sistema_parado")
    .eq("origem", "sistema")
    .neq("status", "fechado")
    .maybeSingle();
  if (chamadoExistente) return;

  const { data: usina } = await supabase.from("usina").select("cliente_id").eq("id", usinaId).maybeSingle();
  if (!usina) return;

  await supabase.from("chamado").insert({
    cliente_id: usina.cliente_id,
    usina_id: usinaId,
    tipo: "sistema_parado",
    origem: "sistema",
    status: "aberto",
    aberto_em: new Date().toISOString(),
  });
}

async function aplicarTransicaoEstado(
  supabase: Cliente,
  dispositivoId: string,
  usinaId: string,
  novoEstado: "normal" | "abaixo_dos_pares" | "parado",
  data: string,
  perdaDoDia: number
) {
  const { data: eventoAberto } = await supabase
    .from("evento_dispositivo")
    .select("id, estado, energia_perdida_estimada_kwh")
    .eq("dispositivo_id", dispositivoId)
    .is("fim", null)
    .maybeSingle();

  if (eventoAberto && eventoAberto.estado === novoEstado) {
    if (novoEstado === "parado") {
      const acumulado = (eventoAberto.energia_perdida_estimada_kwh ?? 0) + perdaDoDia;
      await supabase
        .from("evento_dispositivo")
        .update({ energia_perdida_estimada_kwh: acumulado })
        .eq("id", eventoAberto.id);
    }
    return;
  }

  if (eventoAberto) {
    await supabase.from("evento_dispositivo").update({ fim: dataParaTimestamp(data) }).eq("id", eventoAberto.id);
  }

  if (novoEstado !== "normal") {
    await supabase.from("evento_dispositivo").insert({
      dispositivo_id: dispositivoId,
      estado: novoEstado,
      inicio: dataParaTimestamp(data),
      fim: null,
      energia_perdida_estimada_kwh: novoEstado === "parado" ? perdaDoDia : null,
    });
    if (novoEstado === "parado") {
      await abrirChamadoSistemaParado(supabase, usinaId);
    }
  }
}

// só faz sentido em usina com cobertura completa (leitura por dispositivo);
// quem chama garante isso antes. imune a dia nublado porque compara
// dispositivos da mesma usina no mesmo dia, nunca contra curva teórica.
export async function compararEntrePares(supabase: Cliente, usinaId: string, data: string) {
  const limiares = await buscarLimiares(supabase);
  if (limiares.abaixoDosPares === null || limiares.parado === null) return; // parâmetro ausente, regra não roda

  const { data: leituras } = await supabase
    .from("leitura_geracao")
    .select("dispositivo_id, energia_kwh")
    .eq("usina_id", usinaId)
    .eq("data", data)
    .not("dispositivo_id", "is", null);

  const linhas = (leituras ?? []) as { dispositivo_id: string; energia_kwh: number }[];
  if (linhas.length < 2) return; // não dá pra comparar com menos de dois dispositivos

  const medianaDia = mediana(linhas.map((l) => l.energia_kwh));
  if (medianaDia <= 0) return; // irmãos também não geraram; não é uma comparação válida

  for (const linha of linhas) {
    const razaoPct = (linha.energia_kwh / medianaDia) * 100;
    let novoEstado: "normal" | "abaixo_dos_pares" | "parado";
    if (razaoPct <= limiares.parado) novoEstado = "parado";
    else if (razaoPct <= limiares.abaixoDosPares) novoEstado = "abaixo_dos_pares";
    else novoEstado = "normal";

    const perdaDoDia = Math.max(0, medianaDia - linha.energia_kwh);
    await aplicarTransicaoEstado(supabase, linha.dispositivo_id, usinaId, novoEstado, data, perdaDoDia);
  }
}

// ausência de leitura não é a mesma coisa que parado (seção 5): pode ser só
// falha de comunicação, com a usina gerando normal. por isso tem estado
// próprio, e nunca sobrescreve um evento de parado/abaixo_dos_pares já
// confirmado por uma leitura anterior.
export async function detectarSemComunicacao(
  supabase: Cliente,
  dispositivosUsina: { id: string }[]
) {
  const agora = Date.now();

  for (const dispositivo of dispositivosUsina) {
    const { data: ultimaLeitura } = await supabase
      .from("leitura_geracao")
      .select("data")
      .eq("dispositivo_id", dispositivo.id)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();

    const diasSemLeitura = ultimaLeitura
      ? (agora - new Date(ultimaLeitura.data + "T00:00:00Z").getTime()) / 86400000
      : Infinity;
    const semComunicacao = diasSemLeitura > DIAS_SEM_COMUNICACAO;

    const { data: eventoAberto } = await supabase
      .from("evento_dispositivo")
      .select("id, estado")
      .eq("dispositivo_id", dispositivo.id)
      .is("fim", null)
      .maybeSingle();

    if (semComunicacao) {
      if (!eventoAberto) {
        await supabase.from("evento_dispositivo").insert({
          dispositivo_id: dispositivo.id,
          estado: "sem_comunicacao",
          inicio: new Date().toISOString(),
          fim: null,
        });
      }
      // se já existe um evento aberto (sem_comunicacao, ou parado/abaixo_dos_pares
      // confirmado por uma leitura anterior), não mexe — comparação entre
      // pares é quem reclassifica assim que uma leitura nova chegar
    } else if (eventoAberto?.estado === "sem_comunicacao") {
      await supabase.from("evento_dispositivo").update({ fim: new Date().toISOString() }).eq("id", eventoAberto.id);
    }
  }
}
