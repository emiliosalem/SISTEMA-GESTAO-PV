import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ROTULO_FONTE } from "../lib/monitoramento/rotulos";

interface LinhaUsina {
  id: string;
  nome_monitoramento: string;
  cidade: string | null;
  potencia_kwp: number | null;
  fonte_dados_geracao: string | null;
  cobertura_monitoramento_atual: "completa" | "parcial" | "sem_monitoramento";
  diasSilencio: number;
  ultimaLeitura: string | null;
  temParado: boolean;
  temSemComunicacao: boolean;
  prioridade: number;
}

type Aba = "todas" | "sem_comunicacao" | "paradas" | "cobertura_parcial";

export function CoberturaMonitoramento() {
  const [usinas, setUsinas] = useState<LinhaUsina[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>("todas");
  const [limite, setLimite] = useState(20);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);

    const [{ data: usinasBrutas }, { data: ultimasLeituras }, { data: eventosAbertos }] = await Promise.all([
      supabase
        .from("usina")
        .select(
          "id, nome_monitoramento, cidade, potencia_kwp, fonte_dados_geracao, cobertura_monitoramento_atual, data_conexao"
        )
        .eq("ativa", true),
      supabase.from("vw_ultima_leitura_usina").select("usina_id, ultima_leitura_data"),
      supabase.from("evento_dispositivo").select("estado, dispositivo:dispositivo_id(usina_id)").is("fim", null),
    ]);

    const ultimaLeituraPorUsina = new Map(
      (ultimasLeituras ?? []).map((l) => [l.usina_id as string, l.ultima_leitura_data as string])
    );

    const usinasComParado = new Set<string>();
    const usinasComSemComunicacao = new Set<string>();
    for (const evento of eventosAbertos ?? []) {
      const usinaId = (evento.dispositivo as { usina_id: string } | null)?.usina_id;
      if (!usinaId) continue;
      if (evento.estado === "parado") usinasComParado.add(usinaId);
      if (evento.estado === "sem_comunicacao") usinasComSemComunicacao.add(usinaId);
    }

    const hoje = Date.now();
    const linhas: LinhaUsina[] = (usinasBrutas ?? []).map((u) => {
      const ultimaLeitura = ultimaLeituraPorUsina.get(u.id) ?? null;
      const referencia = ultimaLeitura ?? u.data_conexao;
      const diasSilencio = referencia
        ? Math.floor((hoje - new Date(referencia + "T00:00:00Z").getTime()) / 86400000)
        : 9999;
      const potencia = u.potencia_kwp ?? 0;

      return {
        id: u.id,
        nome_monitoramento: u.nome_monitoramento,
        cidade: u.cidade,
        potencia_kwp: u.potencia_kwp,
        fonte_dados_geracao: u.fonte_dados_geracao,
        cobertura_monitoramento_atual: u.cobertura_monitoramento_atual,
        diasSilencio,
        ultimaLeitura,
        temParado: usinasComParado.has(u.id),
        temSemComunicacao: usinasComSemComunicacao.has(u.id),
        // potência combinada com dias de silêncio, em escala logarítmica: uma
        // usina grande parada há pouco tempo pesa mais que uma pequena parada
        // há muito tempo (300 kwp há 3 dias > 5 kwp há 8 meses, seção 5 do pedido)
        prioridade: potencia * Math.log(1 + Math.max(diasSilencio, 0)),
      };
    });

    linhas.sort((a, b) => b.prioridade - a.prioridade);
    setUsinas(linhas);
    setCarregando(false);
  }

  const metricas = useMemo(
    () => ({
      completa: usinas.filter((u) => u.cobertura_monitoramento_atual === "completa").length,
      parcial: usinas.filter((u) => u.cobertura_monitoramento_atual === "parcial").length,
      semComunicacao: usinas.filter((u) => u.temSemComunicacao).length,
      paradas: usinas.filter((u) => u.temParado).length,
    }),
    [usinas]
  );

  const usinasFiltradas = useMemo(() => {
    if (aba === "sem_comunicacao") return usinas.filter((u) => u.temSemComunicacao);
    if (aba === "paradas") return usinas.filter((u) => u.temParado);
    if (aba === "cobertura_parcial") return usinas.filter((u) => u.cobertura_monitoramento_atual === "parcial");
    return usinas;
  }, [usinas, aba]);

  const usinasVisiveis = usinasFiltradas.slice(0, limite);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[380px] bg-fundo">
      <header className="bg-teal px-4 py-3.5 text-white">
        <span className="text-[17px] font-semibold">cobertura de monitoramento</span>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <TelinhaMetrica valor={metricas.completa} rotulo="cobertura completa" tom="teal" />
          <TelinhaMetrica valor={metricas.parcial} rotulo="cobertura parcial" tom="ambar" />
          <TelinhaMetrica valor={metricas.semComunicacao} rotulo="sem comunicação" tom="ambar" />
          <TelinhaMetrica valor={metricas.paradas} rotulo="confirmadas paradas" tom="vermelho" />
        </div>
      </header>

      <main className="space-y-2.5 p-3">
        <div className="flex flex-col gap-2.5 rounded-cartao border-fina border-borda-forte bg-white p-3.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px] bg-ambar" />
            <span className="text-[13px] text-tinta-suave">
              <span className="font-semibold text-ambar">sem comunicação</span> é dado faltando, a usina pode estar
              gerando bem. custa visibilidade, não energia. ação: recompor a internet do local.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px] bg-vermelho" />
            <span className="text-[13px] text-tinta-suave">
              <span className="font-semibold text-vermelho">parada</span> é a fatura confirmando injeção próxima de
              zero. custa dinheiro agora. ação: assistência técnica urgente.
            </span>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          <AbaBotao rotulo="todas" ativa={aba === "todas"} onClick={() => setAba("todas")} />
          <AbaBotao rotulo={`sem comunicação, ${metricas.semComunicacao}`} ativa={aba === "sem_comunicacao"} onClick={() => setAba("sem_comunicacao")} />
          <AbaBotao rotulo={`paradas, ${metricas.paradas}`} ativa={aba === "paradas"} onClick={() => setAba("paradas")} />
          <AbaBotao rotulo="cobertura parcial" ativa={aba === "cobertura_parcial"} onClick={() => setAba("cobertura_parcial")} />
        </div>

        <div className="rounded-controle bg-metrica-bg px-3 py-2.5 text-xs text-tinta-suave">
          ordenado por prioridade: potência em kwp combinada com os dias em silêncio, em escala logarítmica. usina
          grande calada há pouco tempo vem antes de usina pequena calada há meses.
        </div>

        {aba === "cobertura_parcial" && (
          <p className="rounded-controle bg-ambar-bg px-3 py-2 text-xs text-ambar">
            esta é a lista de trabalho de integração: usinas onde o sistema ainda não enxerga dispositivo individual.
          </p>
        )}

        {carregando ? (
          <p className="text-sm text-legenda">carregando...</p>
        ) : usinasFiltradas.length === 0 ? (
          <p className="text-sm text-legenda">nenhuma usina nesse filtro</p>
        ) : (
          <>
            {usinasVisiveis.map((u) => (
              <CartaoUsina key={u.id} usina={u} />
            ))}
            {usinasFiltradas.length > usinasVisiveis.length && (
              <button
                type="button"
                onClick={() => setLimite((l) => l + 20)}
                className="w-full rounded-controle border-fina border-borda-forte bg-white p-3.5 text-sm font-medium text-tinta-suave hover:bg-hover-fundo"
              >
                ver as próximas {Math.min(20, usinasFiltradas.length - usinasVisiveis.length)} usinas
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function TelinhaMetrica({ valor, rotulo, tom }: { valor: number; rotulo: string; tom: "teal" | "ambar" | "vermelho" }) {
  const estilo =
    tom === "teal"
      ? "bg-white/[0.13] text-white"
      : tom === "ambar"
        ? "bg-ambar-bg text-ambar"
        : "bg-vermelho-bg text-vermelho";
  return (
    <div className={`flex flex-col gap-0.5 rounded-controle px-2.5 py-2 ${estilo}`}>
      <span className="font-mono text-lg font-semibold leading-tight">{valor}</span>
      <span className={`text-[11px] leading-tight ${tom === "teal" ? "text-white/85" : ""}`}>{rotulo}</span>
    </div>
  );
}

function AbaBotao({ rotulo, ativa, onClick }: { rotulo: string; ativa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-controle px-3 py-2 text-xs font-semibold ${
        ativa ? "bg-ambar-bg text-ambar" : "border-fina border-borda-forte bg-white text-legenda"
      }`}
    >
      {rotulo}
    </button>
  );
}

function CartaoUsina({ usina }: { usina: LinhaUsina }) {
  const selo: { texto: string; classe: string } | null = usina.temParado
    ? { texto: "parada", classe: "bg-vermelho text-white" }
    : usina.temSemComunicacao
      ? { texto: "sem comunicação", classe: "border-fina border-ambar-borda bg-ambar-bg text-ambar" }
      : null;

  const corBorda = usina.temParado ? "border-l-vermelho" : usina.temSemComunicacao ? "border-l-ambar" : "border-l-borda-forte";

  return (
    <Link
      to={`/usinas/${usina.id}/dispositivos`}
      className={`block rounded-cartao border-fina border-l-[5px] bg-white p-3.5 ${corBorda} border-borda-forte`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold text-tinta">{usina.nome_monitoramento}</span>
          <span className="text-xs text-legenda">{usina.cidade ?? "—"}</span>
        </div>
        {selo && (
          <span className={`shrink-0 whitespace-nowrap rounded-controle px-2.5 py-1 text-xs font-semibold ${selo.classe}`}>
            {selo.texto}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-3.5">
        <span className="font-mono text-[15px] font-semibold text-tinta">{usina.potencia_kwp ?? "—"} kwp</span>
        <span
          className={`font-mono text-[15px] font-semibold ${
            usina.temParado ? "text-vermelho" : usina.temSemComunicacao ? "text-ambar" : "text-legenda"
          }`}
        >
          {usina.diasSilencio} dia(s) em silêncio
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-legenda">
        <span>fonte: {ROTULO_FONTE[usina.fonte_dados_geracao ?? ""] ?? "não definida"}</span>
        <span>{usina.ultimaLeitura ? `último dado ${usina.ultimaLeitura}` : "sem dado ainda"}</span>
      </div>
    </Link>
  );
}

