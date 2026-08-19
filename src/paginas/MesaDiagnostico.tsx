import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Cabecalho } from "../componentes/Cabecalho";
import { BuscaUnidadeConsumidora, type UcResultado } from "../componentes/BuscaUnidadeConsumidora";
import { supabase } from "../lib/supabase";
import { gerarDiagnostico } from "../lib/diagnostico/motor";
import {
  abrirChamadoParaDiagnostico,
  rotuloTipoChamado,
  TIPOS_CHAMADO_DIAGNOSTICO,
  type TipoChamadoDiagnostico,
} from "../lib/chamados/chamado";

interface FaturaConferida {
  id: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  valor_total: number | null;
  temDiagnostico: boolean;
}

const ROTULO_ORIGEM_FATURA: Record<string, string> = {
  pdf: "pdf",
  foto: "foto",
  agencia_virtual: "agência virtual",
  digitado: "digitado",
};

export function MesaDiagnostico() {
  const { diagnosticoId: diagnosticoIdRota } = useParams<{ diagnosticoId?: string }>();
  const navigate = useNavigate();
  const [uc, setUc] = useState<UcResultado | null>(null);
  const [faturaId, setFaturaId] = useState<string | null>(null);
  const [diagnosticoId, setDiagnosticoId] = useState<string | null>(diagnosticoIdRota ?? null);

  return (
    <div className="min-h-screen bg-fundo">
      <Cabecalho />
      <main className="mx-auto max-w-[1420px] space-y-4 px-6 py-5">
        {!diagnosticoId && (
          <div>
            <h1 className="text-base font-semibold text-tinta">mesa de diagnóstico</h1>
            <p className="mt-1 text-xs text-legenda">
              só fatura conferida entra aqui — nenhuma fatura com status diferente alimenta o motor.
            </p>
          </div>
        )}

        {!diagnosticoId && (
          <BuscaUnidadeConsumidora
            ucSelecionada={uc}
            onSelecionar={(novaUc) => {
              setUc(novaUc);
              setFaturaId(null);
              setDiagnosticoId(null);
            }}
          />
        )}

        {uc && !diagnosticoId && (
          <ListaFaturasConferidas
            ucId={uc.id}
            faturaSelecionadaId={faturaId}
            onSelecionar={setFaturaId}
          />
        )}

        {uc && faturaId && !diagnosticoId && (
          <VerificarOuAbrirDiagnostico
            uc={uc}
            faturaId={faturaId}
            onDiagnosticoPronto={setDiagnosticoId}
          />
        )}

        {diagnosticoId && (
          <PainelDiagnostico
            diagnosticoId={diagnosticoId}
            onVoltar={() => {
              setDiagnosticoId(null);
              setFaturaId(null);
              navigate("/diagnostico");
            }}
          />
        )}
      </main>
    </div>
  );
}

function ListaFaturasConferidas({
  ucId,
  faturaSelecionadaId,
  onSelecionar,
}: {
  ucId: string;
  faturaSelecionadaId: string | null;
  onSelecionar: (id: string) => void;
}) {
  const [faturas, setFaturas] = useState<FaturaConferida[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    (async () => {
      const { data: faturasBrutas } = await supabase
        .from("fatura")
        .select("id, periodo_inicio, periodo_fim, valor_total")
        .eq("unidade_consumidora_id", ucId)
        .eq("status", "conferida")
        .order("periodo_fim", { ascending: false })
        .limit(12);

      const ids = (faturasBrutas ?? []).map((f) => f.id);
      let comDiagnostico = new Set<string>();
      if (ids.length > 0) {
        const { data: diagnosticos } = await supabase.from("diagnostico").select("fatura_id").in("fatura_id", ids);
        comDiagnostico = new Set((diagnosticos ?? []).map((d) => d.fatura_id as string));
      }

      if (!ativo) return;
      setFaturas(
        (faturasBrutas ?? []).map((f) => ({ ...f, temDiagnostico: comDiagnostico.has(f.id) }))
      );
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [ucId]);

  return (
    <section className="cartao p-5">
      <h2 className="text-[13px] font-semibold text-tinta">faturas conferidas</h2>
      {carregando ? (
        <p className="mt-2 text-xs text-legenda">carregando...</p>
      ) : faturas.length === 0 ? (
        <p className="mt-2 text-xs text-legenda">
          nenhuma fatura conferida para esta uc ainda. confira uma em ingestão de fatura primeiro.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-borda-fraca text-sm">
          {faturas.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onSelecionar(f.id)}
                className={`flex w-full items-center justify-between px-1 py-2 text-left hover:bg-fundo ${
                  faturaSelecionadaId === f.id ? "bg-fundo" : ""
                }`}
              >
                <span className="font-mono text-[13px]">
                  {f.periodo_inicio} até {f.periodo_fim}
                </span>
                <span className="flex items-center gap-2 text-legenda">
                  {f.valor_total ? `r$ ${f.valor_total}` : "—"}
                  {f.temDiagnostico && (
                    <span className="rounded-controle bg-verde-bg px-2 py-0.5 text-[11px] text-verde">
                      já diagnosticada
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VerificarOuAbrirDiagnostico({
  uc,
  faturaId,
  onDiagnosticoPronto,
}: {
  uc: UcResultado;
  faturaId: string;
  onDiagnosticoPronto: (id: string) => void;
}) {
  const [verificando, setVerificando] = useState(true);
  const [tipo, setTipo] = useState<TipoChamadoDiagnostico>("conta_alta");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("diagnostico")
      .select("id")
      .eq("fatura_id", faturaId)
      .order("gerado_em", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return;
        if (data) {
          onDiagnosticoPronto(data.id as string);
        } else {
          setVerificando(false);
        }
      });
    return () => {
      ativo = false;
    };
  }, [faturaId]);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const chamadoId = await abrirChamadoParaDiagnostico({
        clienteId: uc.cliente_id,
        unidadeConsumidoraId: uc.id,
        usinaId: uc.usina_id,
        tipo,
      });
      const diagnosticoId = await gerarDiagnostico(faturaId, chamadoId);
      onDiagnosticoPronto(diagnosticoId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao gerar diagnóstico");
    } finally {
      setGerando(false);
    }
  }

  if (verificando) {
    return <p className="text-xs text-legenda">verificando...</p>;
  }

  return (
    <section className="cartao p-5">
      <h2 className="text-[13px] font-semibold text-tinta">abrir chamado e diagnosticar</h2>
      <p className="mt-1 text-xs text-legenda">
        esta fatura ainda não tem diagnóstico. escolha o tipo do chamado para gerar.
      </p>
      <select
        className="campo mt-3 max-w-xs"
        value={tipo}
        onChange={(e) => setTipo(e.target.value as TipoChamadoDiagnostico)}
      >
        {TIPOS_CHAMADO_DIAGNOSTICO.map((t) => (
          <option key={t} value={t}>
            {rotuloTipoChamado(t)}
          </option>
        ))}
      </select>
      {erro && <p className="mt-3 text-xs text-vermelho">{erro}</p>}
      <div>
        <button type="button" onClick={gerar} disabled={gerando} className="botao-primario mt-4">
          {gerando ? "gerando diagnóstico..." : "gerar diagnóstico"}
        </button>
      </div>
    </section>
  );
}

interface DetalheDiagnostico {
  chamadoId: string;
  chamadoCurto: string;
  prazoSla: string | null;
  geracaoPeriodoKwh: number;
  geracaoEsperadaKwh: number | null;
  injecaoEsperadaKwh: number;
  diferencaMedidorKwh: number;
  diasSemDado: number;
  fatura: {
    origem: string;
    status: string;
    periodoInicio: string;
    periodoFim: string;
    consumoKwh: number | null;
    injetadaKwh: number | null;
    creditosUsadosKwh: number | null;
    saldoCreditosKwh: number | null;
    percentualRateioAplicado: number | null;
    valorTotal: number | null;
    unidadeConsumidoraId: string;
  };
  clienteNome: string;
  numeroUc: string;
  tipoUc: string;
  usinaNome: string;
  fonteDadosGeracao: string | null;
  coberturaMonitoramento: string;
  rateioVigentePct: number | null;
  totalDispositivos: number;
  dispositivosParados: number;
  resumoEquipamento: string;
  leiturasDiarias: { data: string; energiaKwh: number }[];
  alertas: {
    id: string;
    causa: string;
    confianca: "alta" | "media" | "baixa";
    impacto_estimado_reais: number | null;
    titulo: string;
    descricao: string;
  }[];
}

const ROTULO_CONFIANCA_ALERTA: Record<string, string> = {
  alta: "confiança alta",
  media: "confiança média",
  baixa: "informativo",
};
const ESTILO_ALERTA: Record<string, { borda: string; bg: string; texto: string; badge: string }> = {
  alta: { borda: "border-l-vermelho", bg: "bg-vermelho-bg", texto: "text-vermelho", badge: "bg-vermelho/10 text-vermelho" },
  media: { borda: "border-l-ambar", bg: "bg-ambar-bg", texto: "text-ambar", badge: "bg-ambar/10 text-ambar" },
  baixa: { borda: "border-l-borda-forte", bg: "bg-white", texto: "text-tinta-suave", badge: "bg-fundo text-legenda" },
};

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

function PainelDiagnostico({ diagnosticoId, onVoltar }: { diagnosticoId: string; onVoltar: () => void }) {
  const [detalhe, setDetalhe] = useState<DetalheDiagnostico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregar();
  }, [diagnosticoId]);

  async function carregar() {
    setCarregando(true);
    setErro(null);

    const { data: diagnostico, error: erroDiagnostico } = await supabase
      .from("diagnostico")
      .select("*")
      .eq("id", diagnosticoId)
      .maybeSingle();
    if (erroDiagnostico || !diagnostico) {
      setErro(erroDiagnostico?.message ?? "diagnóstico não encontrado");
      setCarregando(false);
      return;
    }

    const { data: fatura } = await supabase.from("fatura").select("*").eq("id", diagnostico.fatura_id).maybeSingle();
    const { data: chamado } = await supabase
      .from("chamado")
      .select("cliente_id, usina_id, prazo_sla")
      .eq("id", diagnostico.chamado_id)
      .maybeSingle();
    const { data: alertasBrutos } = await supabase
      .from("alerta")
      .select("id, causa, confianca, impacto_estimado_reais, titulo, descricao")
      .eq("diagnostico_id", diagnosticoId);

    const [{ data: cliente }, { data: usina }, { data: unidadeConsumidora }] = await Promise.all([
      supabase.from("cliente").select("nome").eq("id", chamado?.cliente_id ?? "").maybeSingle(),
      supabase
        .from("usina")
        .select("nome_monitoramento, cobertura_monitoramento_atual, fonte_dados_geracao")
        .eq("id", chamado?.usina_id ?? "")
        .maybeSingle(),
      supabase
        .from("unidade_consumidora")
        .select("numero_uc, tipo")
        .eq("id", fatura?.unidade_consumidora_id ?? "")
        .maybeSingle(),
    ]);

    let rateioVigentePct: number | null = null;
    let dispositivosParados = 0;
    let totalDispositivos = 0;
    let resumoEquipamento = "—";
    const leiturasDiarias: { data: string; energiaKwh: number }[] = [];

    if (fatura && chamado?.usina_id) {
      const { data: rateios } = await supabase
        .from("rateio")
        .select("percentual, vigencia_inicio, vigencia_fim")
        .eq("unidade_consumidora_id", fatura.unidade_consumidora_id)
        .eq("usina_id", chamado.usina_id)
        .lte("vigencia_inicio", fatura.periodo_fim);
      const vigente = (rateios ?? []).find((r) => !r.vigencia_fim || r.vigencia_fim >= fatura.periodo_fim);
      rateioVigentePct = vigente?.percentual ?? null;

      const { data: dispositivosUsina } = await supabase
        .from("dispositivo")
        .select("id, fabricante, tipo")
        .eq("usina_id", chamado.usina_id)
        .eq("ativo", true);
      const idsDispositivos = (dispositivosUsina ?? []).map((d) => d.id);
      totalDispositivos = idsDispositivos.length;
      if (dispositivosUsina && dispositivosUsina.length > 0) {
        const primeiro = dispositivosUsina[0];
        const tipoRotulo = primeiro.tipo === "microinversor" ? "microinversores" : "entradas mppt";
        resumoEquipamento = `${primeiro.fabricante}, ${dispositivosUsina.length} ${tipoRotulo}`;
      }

      if (idsDispositivos.length > 0) {
        const { count } = await supabase
          .from("evento_dispositivo")
          .select("id", { count: "exact", head: true })
          .in("dispositivo_id", idsDispositivos)
          .eq("estado", "parado")
          .lte("inicio", fatura.periodo_fim)
          .or(`fim.is.null,fim.gte.${fatura.periodo_inicio}`);
        dispositivosParados = count ?? 0;
      }

      const { data: leiturasBrutas } = await supabase
        .from("leitura_geracao")
        .select("data, dispositivo_id, energia_kwh")
        .eq("usina_id", chamado.usina_id)
        .gte("data", fatura.periodo_inicio)
        .lte("data", fatura.periodo_fim);

      const agregadaPorDia = new Map<string, number>();
      const somaDispositivosPorDia = new Map<string, number>();
      for (const l of leiturasBrutas ?? []) {
        const mapa = l.dispositivo_id === null ? agregadaPorDia : somaDispositivosPorDia;
        mapa.set(l.data, (mapa.get(l.data) ?? 0) + l.energia_kwh);
      }
      const todasAsDatas = new Set([...agregadaPorDia.keys(), ...somaDispositivosPorDia.keys()]);
      for (const data of [...todasAsDatas].sort()) {
        leiturasDiarias.push({ data, energiaKwh: agregadaPorDia.get(data) ?? somaDispositivosPorDia.get(data) ?? 0 });
      }
    }

    setDetalhe({
      chamadoId: diagnostico.chamado_id,
      chamadoCurto: (diagnostico.chamado_id as string).slice(0, 8).toUpperCase(),
      prazoSla: chamado?.prazo_sla ?? null,
      geracaoPeriodoKwh: diagnostico.geracao_periodo_kwh,
      geracaoEsperadaKwh: diagnostico.geracao_esperada_kwh,
      injecaoEsperadaKwh: diagnostico.injecao_esperada_kwh,
      diferencaMedidorKwh: diagnostico.diferenca_medidor_kwh,
      diasSemDado: diagnostico.dias_sem_dado,
      fatura: {
        origem: fatura?.origem ?? "—",
        status: fatura?.status ?? "—",
        periodoInicio: fatura?.periodo_inicio ?? "—",
        periodoFim: fatura?.periodo_fim ?? "—",
        consumoKwh: fatura?.consumo_kwh ?? null,
        injetadaKwh: fatura?.injetada_kwh ?? null,
        creditosUsadosKwh: fatura?.creditos_usados_kwh ?? null,
        saldoCreditosKwh: fatura?.saldo_creditos_kwh ?? null,
        percentualRateioAplicado: fatura?.percentual_rateio_aplicado ?? null,
        valorTotal: fatura?.valor_total ?? null,
        unidadeConsumidoraId: fatura?.unidade_consumidora_id ?? "",
      },
      clienteNome: cliente?.nome ?? "cliente",
      numeroUc: unidadeConsumidora?.numero_uc ?? "—",
      tipoUc: unidadeConsumidora?.tipo ?? "—",
      usinaNome: usina?.nome_monitoramento ?? "—",
      fonteDadosGeracao: usina?.fonte_dados_geracao ?? null,
      coberturaMonitoramento: usina?.cobertura_monitoramento_atual ?? "sem_monitoramento",
      rateioVigentePct,
      totalDispositivos,
      dispositivosParados,
      resumoEquipamento,
      leiturasDiarias,
      alertas: ((alertasBrutos ?? []) as DetalheDiagnostico["alertas"]).sort(
        (a, b) => (b.impacto_estimado_reais ?? 0) - (a.impacto_estimado_reais ?? 0)
      ),
    });
    setCarregando(false);
  }

  if (carregando) return <p className="text-xs text-legenda">carregando diagnóstico...</p>;
  if (erro || !detalhe) return <p className="text-xs text-vermelho">{erro}</p>;

  const sla = formatarSla(detalhe.prazoSla);
  const desvioPct =
    detalhe.geracaoEsperadaKwh && detalhe.geracaoEsperadaKwh > 0
      ? ((detalhe.geracaoPeriodoKwh - detalhe.geracaoEsperadaKwh) / detalhe.geracaoEsperadaKwh) * 100
      : null;

  return (
    <div className="space-y-3.5">
      <button type="button" onClick={onVoltar} className="text-xs text-teal">
        ← nova busca
      </button>

      <div className="cartao flex flex-wrap items-center gap-7 p-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-teal">CH {detalhe.chamadoCurto}</span>
          <span className="text-[15px] font-semibold text-tinta">{detalhe.clienteNome}</span>
        </div>
        <div className="h-[34px] w-px bg-borda" />
        <div className="flex flex-wrap gap-6">
          <CampoResumo rotulo="unidade consumidora" valor={detalhe.numeroUc} mono />
          <CampoResumo
            rotulo="papel"
            valor={
              <span className="rounded-[4px] bg-info-bg px-1.5 py-0.5 text-[11px] font-medium text-info">
                {detalhe.tipoUc}
              </span>
            }
          />
          <CampoResumo rotulo="usina" valor={detalhe.usinaNome} />
          <CampoResumo rotulo="equipamento" valor={detalhe.resumoEquipamento} />
        </div>
        <div className="flex-1" />
        {sla && (
          <div
            className={`flex flex-col items-end gap-0.5 rounded-controle border-fina px-3.5 py-2 ${
              sla.vencido ? "border-vermelho-borda bg-vermelho-bg" : "border-ambar-borda bg-ambar-bg"
            }`}
          >
            <span className={`text-[11px] ${sla.vencido ? "text-vermelho" : "text-ambar"}`}>sla restante</span>
            <span className={`font-mono text-lg font-semibold leading-none ${sla.vencido ? "text-vermelho" : "text-ambar"}`}>
              {sla.texto}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="cartao px-[18px] pb-1.5 pt-3.5">
          <div className="flex items-center gap-2.5 border-b-fina border-borda pb-2.5">
            <span className="text-[13px] font-semibold text-tinta">fatura lida</span>
            <div className="flex-1" />
            <span className="rounded-[4px] border-fina border-borda bg-fundo px-1.5 py-0.5 text-[11px] text-legenda">
              origem: {ROTULO_ORIGEM_FATURA[detalhe.fatura.origem] ?? detalhe.fatura.origem}
            </span>
            <span className="rounded-[4px] border-fina border-verde-borda bg-verde-bg px-1.5 py-0.5 text-[11px] text-verde">
              {detalhe.fatura.status}
            </span>
          </div>
          <LinhaCampo rotulo="período de leitura" valor={`${detalhe.fatura.periodoInicio} a ${detalhe.fatura.periodoFim}`} />
          <LinhaCampo rotulo="consumo" valor={detalhe.fatura.consumoKwh !== null ? `${detalhe.fatura.consumoKwh} kwh` : null} />
          <LinhaCampo rotulo="energia injetada" valor={detalhe.fatura.injetadaKwh !== null ? `${detalhe.fatura.injetadaKwh} kwh` : null} />
          <LinhaCampo rotulo="créditos usados" valor={detalhe.fatura.creditosUsadosKwh !== null ? `${detalhe.fatura.creditosUsadosKwh} kwh` : null} />
          <LinhaCampo rotulo="saldo acumulado" valor={detalhe.fatura.saldoCreditosKwh !== null ? `${detalhe.fatura.saldoCreditosKwh} kwh` : null} />
          <LinhaCampo rotulo="rateio aplicado" valor={detalhe.fatura.percentualRateioAplicado !== null ? `${detalhe.fatura.percentualRateioAplicado}%` : null} />
          <LinhaCampo
            rotulo="valor total"
            valor={detalhe.fatura.valorTotal !== null ? `R$ ${detalhe.fatura.valorTotal}` : null}
            destaque
            semBorda
          />
        </div>

        <div className="cartao px-[18px] pb-1.5 pt-3.5">
          <div className="flex items-center gap-2.5 border-b-fina border-borda pb-2.5">
            <span className="text-[13px] font-semibold text-tinta">geração no mesmo período</span>
            <div className="flex-1" />
            <span className="rounded-[4px] border-fina border-borda bg-fundo px-1.5 py-0.5 text-[11px] text-legenda">
              fonte: {detalhe.fonteDadosGeracao ?? "não definida"}
            </span>
          </div>
          <LinhaCampo rotulo="energia gerada medida" valor={`${detalhe.geracaoPeriodoKwh.toFixed(0)} kwh`} />
          <LinhaCampo
            rotulo="esperada pelo projeto"
            valor={detalhe.geracaoEsperadaKwh !== null ? `${detalhe.geracaoEsperadaKwh.toFixed(0)} kwh` : "não configurada"}
          />
          {desvioPct !== null && (
            <LinhaCampo
              rotulo="desvio"
              valor={`${desvioPct >= 0 ? "+" : ""}${desvioPct.toFixed(1)}%`}
              corValor={Math.abs(desvioPct) > 15 ? "text-ambar" : undefined}
            />
          )}
          <LinhaCampo rotulo="injeção esperada, estimada" valor={`${detalhe.injecaoEsperadaKwh.toFixed(0)} kwh`} />

          <div className="my-1 -mx-[18px] flex items-center justify-between rounded-[8px] bg-vermelho-bg px-2.5 py-2.5">
            <span className="font-medium text-vermelho">diferença contra o medidor</span>
            <span className="font-mono text-base font-semibold text-vermelho">
              {detalhe.diferencaMedidorKwh.toFixed(0)} kwh
            </span>
          </div>

          <LinhaCampo
            rotulo="dispositivos ativos"
            valor={detalhe.totalDispositivos > 0 ? `${detalhe.totalDispositivos - detalhe.dispositivosParados} de ${detalhe.totalDispositivos}` : "—"}
            corValor={detalhe.dispositivosParados > 0 ? "text-ambar" : undefined}
          />
          <LinhaCampo rotulo="dias sem dado no período" valor={String(detalhe.diasSemDado)} semBorda />
        </div>
      </div>

      {detalhe.leiturasDiarias.length > 0 && (
        <div className="cartao p-[18px]">
          <p className="text-[11px] font-medium uppercase tracking-wide text-legenda">geração diária no período</p>
          <GraficoGeracaoDiaria leituras={detalhe.leiturasDiarias} />
        </div>
      )}

      <div className="flex items-baseline gap-2.5 pt-1">
        <span className="text-[13px] font-semibold text-tinta">alertas do diagnóstico</span>
        <span className="text-[11px] text-legenda">ordenados por impacto financeiro</span>
      </div>

      {detalhe.alertas.length === 0 ? (
        <p className="text-xs text-legenda">nenhum alerta identificado neste diagnóstico</p>
      ) : (
        <div className="flex flex-col gap-2">
          {detalhe.alertas.map((a) => {
            const estilo = ESTILO_ALERTA[a.confianca];
            return (
              <div key={a.id} className={`rounded-cartao border-y-fina border-r-fina border-l-[3px] border-borda-forte ${estilo.borda} ${estilo.bg} px-4 py-3`}>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className={`text-[13px] font-semibold ${estilo.texto}`}>{a.titulo}</span>
                  <div className="flex-1" />
                  <span className={`rounded-[4px] px-1.5 py-0.5 text-[11px] ${estilo.badge}`}>
                    {ROTULO_CONFIANCA_ALERTA[a.confianca]}
                  </span>
                  {a.impacto_estimado_reais !== null && (
                    <span className={`font-mono text-xs font-semibold ${estilo.texto}`}>
                      R$ {a.impacto_estimado_reais.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className={`mt-1.5 text-[13px] ${estilo.texto} opacity-90`}>{a.descricao}</p>
              </div>
            );
          })}
        </div>
      )}

      <PainelResposta chamadoId={detalhe.chamadoId} />
    </div>
  );
}

function CampoResumo({ rotulo, valor, mono }: { rotulo: string; valor: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-legenda">{rotulo}</span>
      <span className={`text-[13px] text-tinta ${mono ? "font-mono" : ""}`}>{valor}</span>
    </div>
  );
}

function LinhaCampo({
  rotulo,
  valor,
  destaque,
  semBorda,
  corValor,
}: {
  rotulo: string;
  valor: string | null;
  destaque?: boolean;
  semBorda?: boolean;
  corValor?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between py-2 ${semBorda ? "" : "border-b-fina border-borda-fraca"}`}>
      <span className="text-legenda">{rotulo}</span>
      <span
        className={`font-mono ${destaque ? "text-[15px] font-semibold text-tinta" : "text-[13px] text-tinta"} ${corValor ?? ""}`}
      >
        {valor ?? "—"}
      </span>
    </div>
  );
}

function GraficoGeracaoDiaria({ leituras }: { leituras: { data: string; energiaKwh: number }[] }) {
  const maximo = Math.max(...leituras.map((l) => l.energiaKwh), 1);
  const largura = 600;
  const altura = 80;
  const larguraBarra = largura / leituras.length;

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="mt-2 w-full" role="img" aria-label="geração diária no período">
      {leituras.map((l, i) => {
        const alturaBarra = (l.energiaKwh / maximo) * (altura - 4);
        return (
          <rect
            key={l.data}
            x={i * larguraBarra + 1}
            y={altura - alturaBarra}
            width={Math.max(larguraBarra - 2, 1)}
            height={alturaBarra}
            className="fill-teal"
          >
            <title>{`${l.data}: ${l.energiaKwh.toFixed(1)} kwh`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function PainelResposta({ chamadoId }: { chamadoId: string }) {
  const [respostaId, setRespostaId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState<"rascunho" | "aprovada" | "enviada">("rascunho");
  const [graficoAnexado, setGraficoAnexado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("resposta_cliente")
      .select("id, texto, status")
      .eq("chamado_id", chamadoId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRespostaId(data.id);
          setTexto(data.texto);
          setStatus(data.status);
        }
        setCarregando(false);
      });
  }, [chamadoId]);

  async function salvarTexto() {
    if (!respostaId) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("resposta_cliente").update({ texto }).eq("id", respostaId);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEditando(false);
  }

  // aprovação e envio acontecem num único clique deliberado do atendente:
  // é esse clique que garante que nenhuma resposta sai sem aprovação humana,
  // sem precisar de dois passos separados. aprovada_por fica gravado mesmo
  // assim, para auditoria de quem aprovou.
  async function aprovarEEnviar() {
    if (!respostaId) return;
    setSalvando(true);
    setErro(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("resposta_cliente")
      .update({
        status: "enviada",
        aprovada_por: user?.id ?? null,
        enviada_em: new Date().toISOString(),
      })
      .eq("id", respostaId);
    setSalvando(false);
    if (error) setErro(error.message);
    else setStatus("enviada");
  }

  function alternarGrafico() {
    const marcador = "\n\n[gráfico de geração diária anexado]";
    if (!graficoAnexado) {
      setTexto((t) => t + marcador);
    } else {
      setTexto((t) => t.replace(marcador, ""));
    }
    setGraficoAnexado(!graficoAnexado);
  }

  if (carregando) return null;
  if (!respostaId) return null;

  const somenteLeitura = status === "enviada";

  return (
    <section className="cartao p-4">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-semibold text-tinta">rascunho da resposta ao cliente</span>
        <span
          className={`rounded-[4px] border-fina px-1.5 py-0.5 text-[11px] ${
            status === "enviada" ? "border-verde-borda bg-verde-bg text-verde" : "border-ambar-borda bg-ambar-bg text-ambar"
          }`}
        >
          {status === "rascunho" ? "pendente de aprovação" : status === "aprovada" ? "aprovada" : "enviada"}
        </span>
      </div>

      {editando && !somenteLeitura ? (
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} className="campo mt-2.5" autoFocus />
      ) : (
        <p className="mt-2.5 max-w-[76ch] whitespace-pre-wrap text-[14px] leading-relaxed text-tinta-suave">{texto}</p>
      )}

      {erro && <p className="mt-2 text-xs text-vermelho">{erro}</p>}

      {!somenteLeitura && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" onClick={aprovarEEnviar} disabled={salvando} className="botao-primario">
            {salvando ? "enviando..." : "aprovar e enviar"}
          </button>
          <button type="button" onClick={() => (editando ? salvarTexto() : setEditando(true))} disabled={salvando} className="botao-secundario">
            {editando ? (salvando ? "salvando..." : "salvar texto") : "editar texto"}
          </button>
          <button type="button" onClick={alternarGrafico} className="botao-secundario">
            {graficoAnexado ? "remover gráfico anexado" : "anexar gráfico"}
          </button>
        </div>
      )}
    </section>
  );
}
