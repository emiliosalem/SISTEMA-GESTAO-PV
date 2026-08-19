import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { abrirChamado } from "../lib/chamados/chamado";
import { ROTULO_FONTE } from "../lib/monitoramento/rotulos";

interface Usina {
  id: string;
  cliente_id: string;
  nome_monitoramento: string;
  potencia_kwp: number | null;
  cobertura_monitoramento_atual: "completa" | "parcial" | "sem_monitoramento";
  fonte_dados_geracao: string | null;
}

interface CartaoDispositivo {
  id: string;
  identificador_fabricante: string;
  estado: string;
  energiaHojeKwh: number | null;
  medianaDia: number;
  razaoPct: number | null;
  diasParado: number | null;
  energiaPerdidaKwh: number | null;
}

export function PainelDispositivos() {
  const { id } = useParams<{ id: string }>();
  const [usina, setUsina] = useState<Usina | null>(null);
  const [dispositivos, setDispositivos] = useState<CartaoDispositivo[]>([]);
  const [geracaoTotalDia, setGeracaoTotalDia] = useState<{ data: string; energiaKwh: number } | null>(null);
  const [somaHoje, setSomaHoje] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (id) carregar(id);
  }, [id]);

  async function carregar(usinaId: string) {
    setCarregando(true);

    const { data: usinaRow } = await supabase
      .from("usina")
      .select("id, cliente_id, nome_monitoramento, potencia_kwp, cobertura_monitoramento_atual, fonte_dados_geracao")
      .eq("id", usinaId)
      .maybeSingle();
    setUsina(usinaRow as Usina | null);

    if (!usinaRow) {
      setCarregando(false);
      return;
    }

    if (usinaRow.cobertura_monitoramento_atual !== "completa") {
      const { data: ultimaLeitura } = await supabase
        .from("leitura_geracao")
        .select("data, energia_kwh")
        .eq("usina_id", usinaId)
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();
      setGeracaoTotalDia(ultimaLeitura ? { data: ultimaLeitura.data, energiaKwh: ultimaLeitura.energia_kwh } : null);
      setDispositivos([]);
      setCarregando(false);
      return;
    }

    const { data: dispositivosBrutos } = await supabase
      .from("dispositivo")
      .select("id, identificador_fabricante")
      .eq("usina_id", usinaId)
      .eq("ativo", true);
    const listaDispositivos = dispositivosBrutos ?? [];

    const { data: ultimaData } = await supabase
      .from("leitura_geracao")
      .select("data")
      .eq("usina_id", usinaId)
      .not("dispositivo_id", "is", null)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();

    let leiturasDoDia = new Map<string, number>();
    if (ultimaData?.data) {
      const { data: leituras } = await supabase
        .from("leitura_geracao")
        .select("dispositivo_id, energia_kwh")
        .eq("usina_id", usinaId)
        .eq("data", ultimaData.data)
        .not("dispositivo_id", "is", null);
      leiturasDoDia = new Map((leituras ?? []).map((l) => [l.dispositivo_id as string, l.energia_kwh as number]));
    }
    const medianaDia = mediana([...leiturasDoDia.values()]);
    setSomaHoje([...leiturasDoDia.values()].reduce((soma, v) => soma + v, 0));

    const idsDispositivos = listaDispositivos.map((d) => d.id);
    let eventosPorDispositivo = new Map<string, { estado: string; inicio: string; energia_perdida_estimada_kwh: number | null }>();
    if (idsDispositivos.length > 0) {
      const { data: eventos } = await supabase
        .from("evento_dispositivo")
        .select("dispositivo_id, estado, inicio, energia_perdida_estimada_kwh")
        .in("dispositivo_id", idsDispositivos)
        .is("fim", null);
      eventosPorDispositivo = new Map((eventos ?? []).map((e) => [e.dispositivo_id as string, e]));
    }

    const cartoes: CartaoDispositivo[] = listaDispositivos.map((d) => {
      const evento = eventosPorDispositivo.get(d.id);
      const energiaHoje = leiturasDoDia.get(d.id);
      const razaoPct = energiaHoje !== undefined && medianaDia > 0 ? (energiaHoje / medianaDia) * 100 : null;
      const diasParado =
        evento?.estado === "parado" ? Math.floor((Date.now() - new Date(evento.inicio).getTime()) / 86400000) : null;

      return {
        id: d.id,
        identificador_fabricante: d.identificador_fabricante,
        estado: evento?.estado ?? "normal",
        energiaHojeKwh: energiaHoje ?? null,
        medianaDia,
        razaoPct,
        diasParado,
        energiaPerdidaKwh: evento?.energia_perdida_estimada_kwh ?? null,
      };
    });

    cartoes.sort((a, b) => PRIORIDADE_ESTADO[a.estado] - PRIORIDADE_ESTADO[b.estado]);

    setDispositivos(cartoes);
    setCarregando(false);
  }

  if (carregando) {
    return <p className="p-4 text-sm text-legenda">carregando...</p>;
  }

  if (!usina) {
    return <p className="p-4 text-sm text-vermelho">usina não encontrada</p>;
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[380px] overflow-hidden bg-fundo">
      <header className="sticky top-0 bg-teal px-4 py-3.5 text-white">
        <Link to={`/usinas/${usina.id}`} className="text-[11px] text-white/75">
          ← ficha da usina
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[17px] font-semibold">{usina.nome_monitoramento}</span>
          <span className="text-[13px] text-white/85">{usina.potencia_kwp ?? "—"} kwp</span>
        </div>
        {usina.cobertura_monitoramento_atual === "completa" && (
          <div className="mt-2.5 flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-white/80">geração de hoje</span>
              <span className="font-mono text-2xl font-semibold leading-tight">{somaHoje.toFixed(1)} kwh</span>
            </div>
          </div>
        )}
      </header>

      <main className="space-y-2.5 p-3">
        {usina.cobertura_monitoramento_atual !== "completa" ? (
          <div className="rounded-cartao border-2 border-ambar bg-white p-4">
            <p className="text-sm font-bold text-ambar">esta usina não tem leitura por dispositivo</p>
            <p className="mt-1 text-sm text-tinta-suave">
              a fonte atual ({ROTULO_FONTE[usina.fonte_dados_geracao ?? ""] ?? "não definida"}) entrega só o total da
              usina. cartão por dispositivo não é mostrado para não simular um dado que não existe.
            </p>
            {geracaoTotalDia ? (
              <div className="mt-4 rounded-controle bg-fundo p-4 text-center">
                <p className="text-xs font-medium text-legenda">geração total em {geracaoTotalDia.data}</p>
                <p className="mt-1 text-3xl font-bold text-tinta">{geracaoTotalDia.energiaKwh.toFixed(1)} kwh</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-legenda">nenhuma leitura registrada ainda</p>
            )}
          </div>
        ) : dispositivos.length === 0 ? (
          <p className="text-sm text-legenda">nenhum dispositivo ativo cadastrado</p>
        ) : (
          <>
            {dispositivos.map((d) => (
              <CartaoDispositivoView key={d.id} dispositivo={d} usina={usina} />
            ))}
            <p className="px-1 py-1 text-xs text-legenda">
              a comparação é entre os dispositivos do mesmo telhado, no mesmo dia, então dia nublado não gera alarme
              falso.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

const PRIORIDADE_ESTADO: Record<string, number> = {
  parado: 0,
  sem_comunicacao: 1,
  abaixo_dos_pares: 2,
  normal: 3,
};

const ROTULO_ESTADO: Record<string, string> = {
  normal: "normal",
  abaixo_dos_pares: "abaixo dos pares",
  parado: "parado",
  sem_comunicacao: "sem comunicação",
};

function CartaoDispositivoView({ dispositivo, usina }: { dispositivo: CartaoDispositivo; usina: Usina }) {
  const [abrindoChamado, setAbrindoChamado] = useState(false);
  const [chamadoAberto, setChamadoAberto] = useState(false);

  async function aoAbrirChamado() {
    setAbrindoChamado(true);
    try {
      const { data: existente } = await supabase
        .from("chamado")
        .select("id")
        .eq("usina_id", usina.id)
        .eq("tipo", "sistema_parado")
        .eq("origem", "sistema")
        .neq("status", "fechado")
        .maybeSingle();

      if (!existente) {
        await abrirChamado({
          clienteId: usina.cliente_id,
          unidadeConsumidoraId: null,
          usinaId: usina.id,
          tipo: "sistema_parado",
          origem: "sistema",
        });
      }
      setChamadoAberto(true);
    } finally {
      setAbrindoChamado(false);
    }
  }

  const critico = dispositivo.estado === "parado";
  const barraPct = dispositivo.razaoPct !== null ? Math.min(dispositivo.razaoPct, 100) : 0;
  const corBordaBase = critico ? "border-vermelho" : "border-borda-forte";
  const corBordaEsquerda =
    dispositivo.estado === "parado"
      ? "border-l-vermelho"
      : dispositivo.estado === "sem_comunicacao"
        ? "border-l-tinta-suave"
        : dispositivo.estado === "abaixo_dos_pares"
          ? "border-l-ambar"
          : "border-l-verde";
  const corBadgeSolida =
    dispositivo.estado === "parado"
      ? "bg-vermelho text-white"
      : dispositivo.estado === "sem_comunicacao"
        ? "bg-tinta-suave text-white"
        : dispositivo.estado === "abaixo_dos_pares"
          ? "bg-ambar text-white"
          : "bg-verde-bg text-verde";

  return (
    <div
      className={`rounded-cartao border-fina border-l-[5px] bg-white p-3.5 ${corBordaBase} ${corBordaEsquerda}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-semibold text-tinta">{dispositivo.identificador_fabricante}</span>
        <span className={`rounded-controle px-2.5 py-1 text-[13px] font-semibold ${corBadgeSolida}`}>
          {ROTULO_ESTADO[dispositivo.estado]}
        </span>
      </div>

      {dispositivo.estado !== "sem_comunicacao" && (
        <>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className={`font-mono text-2xl font-semibold ${critico ? "text-vermelho" : "text-tinta"}`}>
              {dispositivo.energiaHojeKwh?.toFixed(1) ?? "—"} kwh
            </span>
            <span className="text-[13px] text-legenda">hoje</span>
          </div>
          {dispositivo.razaoPct !== null && (
            <>
              <div className="mt-2.5 h-3.5 overflow-hidden rounded-full bg-fundo">
                <div
                  className={`h-full ${critico ? "bg-vermelho" : dispositivo.estado === "abaixo_dos_pares" ? "bg-ambar" : "bg-verde"}`}
                  style={{ width: `${barraPct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-legenda">
                <span>{dispositivo.razaoPct.toFixed(0)}% da mediana dos irmãos</span>
                <span className="font-mono">mediana {dispositivo.medianaDia.toFixed(1)} kwh</span>
              </div>
            </>
          )}
        </>
      )}

      {critico && (
        <div className="mt-3 flex flex-col gap-1 rounded-controle bg-vermelho-bg p-2.5">
          <span className="text-[15px] font-semibold text-vermelho">parado há {dispositivo.diasParado} dia(s)</span>
          <span className="text-[13px] text-vermelho">
            perda estimada de {dispositivo.energiaPerdidaKwh?.toFixed(0) ?? "0"} kwh, calculada pela mediana dos
            outros dispositivos.
          </span>
        </div>
      )}

      {critico && (
        <button
          type="button"
          onClick={aoAbrirChamado}
          disabled={abrindoChamado || chamadoAberto}
          className="mt-3 w-full rounded-controle bg-laranja p-[15px] text-base font-semibold text-white shadow-[0_1px_2px_rgba(232,82,10,0.28)] hover:bg-laranja-hover disabled:opacity-60"
        >
          {chamadoAberto ? "chamado aberto" : abrindoChamado ? "abrindo..." : "abrir chamado técnico"}
        </button>
      )}
    </div>
  );
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}
