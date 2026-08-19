import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Cabecalho } from "../componentes/Cabecalho";
import { BuscaUnidadeConsumidora, type UcResultado } from "../componentes/BuscaUnidadeConsumidora";
import { supabase } from "../lib/supabase";
import { abrirChamado, rotuloTipoChamado, TODOS_TIPOS_CHAMADO, type TipoChamado } from "../lib/chamados/chamado";

const STATUS_CHAMADO = ["aberto", "em_andamento", "fechado"] as const;
type StatusChamado = (typeof STATUS_CHAMADO)[number];

const ROTULO_STATUS: Record<StatusChamado, string> = {
  aberto: "aberto",
  em_andamento: "em andamento",
  fechado: "fechado",
};

interface LinhaChamado {
  id: string;
  tipo: TipoChamado;
  origem: "cliente" | "sistema";
  status: string;
  prazo_sla: string | null;
  aberto_em: string;
  fechado_em: string | null;
  responsavel_id: string | null;
  cliente: { nome: string } | null;
  unidade_consumidora: { numero_uc: string } | null;
  usina: { nome_monitoramento: string } | null;
  diagnosticoId: string | null;
}

interface UsuarioInterno {
  id: string;
  nome: string;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toLowerCase();
}

function formatarSla(prazoSla: string | null): { texto: string; vencido: boolean } | null {
  if (!prazoSla) return null;
  const diffMs = new Date(prazoSla).getTime() - Date.now();
  const vencido = diffMs < 0;
  const diffAbsMin = Math.round(Math.abs(diffMs) / 60000);
  const dias = Math.floor(diffAbsMin / 1440);
  const horas = Math.floor((diffAbsMin % 1440) / 60);
  const minutos = diffAbsMin % 60;
  let texto: string;
  if (dias > 0) texto = `${dias}d ${horas}h`;
  else if (horas > 0) texto = `${horas}h ${minutos}min`;
  else texto = `${minutos}min`;
  return { texto: vencido ? `vencido ${texto}` : texto, vencido };
}

export function FilaChamados() {
  const [chamados, setChamados] = useState<LinhaChamado[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioInterno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);

  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos_exceto_fechado");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");

  useEffect(() => {
    carregar();
  }, [versao]);

  async function carregar() {
    setCarregando(true);

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const [{ data: chamadosBrutos }, { data: usuariosBrutos }] = await Promise.all([
      supabase
        .from("chamado")
        .select(
          "id, tipo, origem, status, prazo_sla, aberto_em, fechado_em, responsavel_id, cliente:cliente_id(nome), unidade_consumidora:unidade_consumidora_id(numero_uc), usina:usina_id(nome_monitoramento)"
        )
        .or(`status.neq.fechado,fechado_em.gte.${seteDiasAtras.toISOString()}`)
        .order("prazo_sla", { ascending: true, nullsFirst: false })
        .limit(300),
      supabase.from("usuario_perfil").select("id, nome").eq("ativo", true).order("nome"),
    ]);

    const ids = (chamadosBrutos ?? []).map((c) => c.id);
    let diagnosticoPorChamado = new Map<string, string>();
    if (ids.length > 0) {
      const { data: diagnosticos } = await supabase
        .from("diagnostico")
        .select("id, chamado_id")
        .in("chamado_id", ids);
      diagnosticoPorChamado = new Map((diagnosticos ?? []).map((d) => [d.chamado_id as string, d.id as string]));
    }

    setChamados(
      ((chamadosBrutos ?? []) as unknown as Omit<LinhaChamado, "diagnosticoId">[]).map((c) => ({
        ...c,
        diagnosticoId: diagnosticoPorChamado.get(c.id) ?? null,
      }))
    );
    setUsuarios((usuariosBrutos ?? []) as UsuarioInterno[]);
    setCarregando(false);
  }

  const chamadosFiltrados = useMemo(() => {
    return chamados.filter((c) => {
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (filtroStatus === "todos_exceto_fechado" && c.status === "fechado") return false;
      if (filtroStatus !== "todos" && filtroStatus !== "todos_exceto_fechado" && c.status !== filtroStatus) return false;
      if (filtroOrigem !== "todos" && c.origem !== filtroOrigem) return false;
      if (filtroResponsavel === "sem_responsavel" && c.responsavel_id !== null) return false;
      if (filtroResponsavel !== "todos" && filtroResponsavel !== "sem_responsavel" && c.responsavel_id !== filtroResponsavel)
        return false;
      return true;
    });
  }, [chamados, filtroTipo, filtroStatus, filtroOrigem, filtroResponsavel]);

  const agora = Date.now();
  const metricas = useMemo(() => {
    const abertos = chamados.filter((c) => c.status !== "fechado");
    const atrasados = abertos.filter((c) => c.prazo_sla && new Date(c.prazo_sla).getTime() < agora);
    const origemSistema = abertos.filter((c) => c.origem === "sistema");
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const fechadosHoje = chamados.filter(
      (c) => c.status === "fechado" && c.fechado_em && new Date(c.fechado_em).getTime() >= inicioHoje.getTime()
    ).length;

    return {
      abertos: abertos.length,
      atrasados: atrasados.length,
      origemSistema: origemSistema.length,
      fechadosHoje,
    };
  }, [chamados, agora]);

  async function atualizarChamado(id: string, campos: Record<string, unknown>) {
    await supabase.from("chamado").update(campos).eq("id", id);
    setVersao((v) => v + 1);
  }

  return (
    <div className="min-h-screen bg-fundo">
      <Cabecalho />
      <main className="mx-auto max-w-[1420px] space-y-3.5 px-6 py-5">
        <div className="grid grid-cols-4 gap-3">
          <Metrica rotulo="chamados abertos" valor={metricas.abertos} />
          <Metrica rotulo="atrasados" valor={metricas.atrasados} cor="text-vermelho" />
          <Metrica rotulo="origem sistema, em aberto" valor={metricas.origemSistema} />
          <Metrica rotulo="fechados hoje" valor={metricas.fechadosHoje} cor="text-verde" />
        </div>

        <AbrirChamado onAberto={() => setVersao((v) => v + 1)} />

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-0.5 text-[11px] text-legenda">filtros aplicam na hora</span>
          <FiltroPill valor={filtroTipo} onChange={setFiltroTipo} destaque={filtroTipo !== "todos"}>
            <option value="todos">tipo: todos</option>
            {TODOS_TIPOS_CHAMADO.map((t) => (
              <option key={t} value={t}>
                {rotuloTipoChamado(t)}
              </option>
            ))}
          </FiltroPill>
          <FiltroPill valor={filtroStatus} onChange={setFiltroStatus} destaque={filtroStatus === "todos_exceto_fechado"}>
            <option value="todos_exceto_fechado">status: em aberto</option>
            <option value="todos">status: todos</option>
            {STATUS_CHAMADO.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s]}
              </option>
            ))}
          </FiltroPill>
          <FiltroPill valor={filtroOrigem} onChange={setFiltroOrigem} destaque={filtroOrigem !== "todos"}>
            <option value="todos">origem: todas</option>
            <option value="cliente">origem: cliente</option>
            <option value="sistema">origem: sistema</option>
          </FiltroPill>
          <FiltroPill valor={filtroResponsavel} onChange={setFiltroResponsavel} destaque={filtroResponsavel !== "todos"}>
            <option value="todos">responsável: qualquer</option>
            <option value="sem_responsavel">sem responsável</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </FiltroPill>
          <div className="flex-1" />
          <span className="text-[11px] text-legenda">ordenado pelo sla mais apertado</span>
        </div>

        <div className="cartao overflow-hidden">
          {carregando ? (
            <p className="p-5 text-xs text-legenda">carregando...</p>
          ) : chamadosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-11 text-center">
              <span className="text-[15px] font-semibold text-tinta">nenhum chamado com esses filtros</span>
              <span className="max-w-[46ch] text-legenda">
                ajuste os filtros acima, ou abra um chamado manual se for o caso.
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[88px_2.1fr_1.5fr_1.4fr_150px_110px] gap-3 border-b-fina border-borda bg-hover-fundo px-[18px] py-2 text-[11px] text-legenda">
                <span>chamado</span>
                <span>cliente e unidade</span>
                <span>tipo</span>
                <span>origem</span>
                <span>responsável / status</span>
                <span className="text-right">sla</span>
              </div>
              {chamadosFiltrados.map((c) => (
                <LinhaChamadoRow key={c.id} chamado={c} usuarios={usuarios} onAtualizar={(campos) => atualizarChamado(c.id, campos)} />
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Metrica({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-cartao bg-metrica-bg p-3.5">
      <span className="text-[11px] text-legenda">{rotulo}</span>
      <span className={`font-mono text-[28px] font-semibold leading-tight ${cor ?? "text-tinta"}`}>{valor}</span>
    </div>
  );
}

function FiltroPill({
  valor,
  onChange,
  destaque,
  children,
}: {
  valor: string;
  onChange: (v: string) => void;
  destaque?: boolean;
  children: ReactNode;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-controle border-fina px-2.5 py-1.5 text-xs ${
        destaque ? "border-info-borda bg-info-bg text-info" : "border-borda-forte bg-white text-tinta"
      }`}
    >
      {children}
    </select>
  );
}

function AbrirChamado({ onAberto }: { onAberto: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [uc, setUc] = useState<UcResultado | null>(null);
  const [tipo, setTipo] = useState<TipoChamado>("duvida_fatura");
  const [origemSistema, setOrigemSistema] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="botao-secundario">
        abrir chamado manual
      </button>
    );
  }

  async function salvar() {
    if (!uc) {
      setErro("selecione a unidade consumidora do cliente");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await abrirChamado({
        clienteId: uc.cliente_id,
        unidadeConsumidoraId: uc.id,
        usinaId: uc.usina_id,
        tipo,
        origem: origemSistema ? "sistema" : "cliente",
      });
      setAberto(false);
      setUc(null);
      onAberto();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao abrir chamado");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="cartao p-5">
      <h2 className="text-[13px] font-semibold text-tinta">abrir chamado</h2>
      <div className="mt-3">
        <BuscaUnidadeConsumidora ucSelecionada={uc} onSelecionar={setUc} />
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="block text-xs text-legenda">tipo</span>
          <select className="campo mt-1" value={tipo} onChange={(e) => setTipo(e.target.value as TipoChamado)}>
            {TODOS_TIPOS_CHAMADO.map((t) => (
              <option key={t} value={t}>
                {rotuloTipoChamado(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-tinta-suave">
          <input type="checkbox" checked={origemSistema} onChange={(e) => setOrigemSistema(e.target.checked)} />
          origem sistema
        </label>
      </div>
      {erro && <p className="mt-3 text-xs text-vermelho">{erro}</p>}
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={salvar} disabled={salvando} className="botao-primario">
          {salvando ? "abrindo..." : "confirmar abertura"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="botao-secundario">
          cancelar
        </button>
      </div>
    </section>
  );
}

function LinhaChamadoRow({
  chamado,
  usuarios,
  onAtualizar,
}: {
  chamado: LinhaChamado;
  usuarios: UsuarioInterno[];
  onAtualizar: (campos: Record<string, unknown>) => void;
}) {
  const sla = chamado.status === "fechado" ? null : formatarSla(chamado.prazo_sla);
  const responsavel = usuarios.find((u) => u.id === chamado.responsavel_id);

  return (
    <div className="grid grid-cols-[88px_2.1fr_1.5fr_1.4fr_150px_110px] items-center gap-3 border-b-fina border-borda-fraca px-[18px] py-2.5 hover:bg-hover-fundo">
      <span className="font-mono text-xs font-medium text-teal">{chamado.id.slice(0, 4).toUpperCase()}</span>

      <span className="flex flex-col">
        <span className="font-medium text-tinta">{chamado.cliente?.nome ?? "—"}</span>
        <span className="font-mono text-[11px] text-legenda">
          uc {chamado.unidade_consumidora?.numero_uc ?? chamado.usina?.nome_monitoramento ?? "—"}
        </span>
      </span>

      <span className="text-tinta-suave">{rotuloTipoChamado(chamado.tipo)}</span>

      {chamado.origem === "sistema" ? (
        <span className="flex items-center gap-1.5 text-info">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal" />
          detectado pelo sistema
        </span>
      ) : (
        <span className="text-legenda">aberto pelo cliente</span>
      )}

      <div className="flex items-center gap-2">
        {responsavel ? (
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-info-bg text-[10px] font-semibold text-info">
            {iniciais(responsavel.nome)}
          </span>
        ) : (
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-fundo text-[10px] font-semibold text-legenda">
            --
          </span>
        )}
        <select
          value={chamado.responsavel_id ?? ""}
          onChange={(e) => onAtualizar({ responsavel_id: e.target.value || null })}
          className="rounded-controle border-fina border-borda-forte bg-white px-1 py-0.5 text-[11px] text-tinta-suave"
        >
          <option value="">sem dono</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
        <select
          value={chamado.status}
          onChange={(e) =>
            onAtualizar(
              e.target.value === "fechado"
                ? { status: e.target.value, fechado_em: new Date().toISOString() }
                : { status: e.target.value, fechado_em: null }
            )
          }
          className="rounded-controle border-fina border-borda-forte bg-white px-1 py-0.5 text-[11px] text-tinta-suave"
        >
          {STATUS_CHAMADO.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className={`font-mono text-xs font-semibold ${sla ? (sla.vencido ? "text-vermelho" : "text-ambar") : "text-tinta-suave"}`}>
          {chamado.status === "fechado" ? "fechado" : sla ? sla.texto : "sem prazo"}
        </span>
        {chamado.diagnosticoId && (
          <Link to={`/diagnostico/${chamado.diagnosticoId}`} className="text-[11px] text-teal">
            ver diagnóstico
          </Link>
        )}
      </div>
    </div>
  );
}
