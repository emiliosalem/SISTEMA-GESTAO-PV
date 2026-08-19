import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Cabecalho } from "../componentes/Cabecalho";
import { BuscaUnidadeConsumidora, type UcResultado } from "../componentes/BuscaUnidadeConsumidora";
import { supabase } from "../lib/supabase";
import { enviarArquivoFatura, gerarUrlAssinadaFatura } from "../lib/fatura/armazenamento";
import { extrairCamposFatura } from "../lib/fatura/extracao";
import { criarFatura } from "../lib/fatura/registro";
import { CAMPOS_FATURA, bucketConfianca, type TipoCampoFatura } from "../lib/fatura/campos";

interface FaturaResumo {
  id: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  valor_total: number | null;
  status: string;
  origem: string;
}

const ROTULO_STATUS_FATURA: Record<string, string> = {
  extraida: "extraída",
  em_conferencia: "em conferência",
  conferida: "conferida",
  rejeitada: "rejeitada",
};

export function IngestaoFatura() {
  const [uc, setUc] = useState<UcResultado | null>(null);
  const [faturaAtivaId, setFaturaAtivaId] = useState<string | null>(null);
  const [versaoHistorico, setVersaoHistorico] = useState(0);

  return (
    <div className="min-h-screen bg-fundo">
      <Cabecalho />
      <main className="mx-auto max-w-[1420px] space-y-4 px-6 py-5">
        <div>
          <h1 className="text-base font-semibold text-tinta">ingestão e conferência de fatura</h1>
          <p className="mt-1 text-xs text-legenda">
            busque a unidade consumidora do cliente que abriu o chamado; a fatura entra por demanda, não em lote.
          </p>
        </div>

        <BuscaUnidadeConsumidora
          ucSelecionada={uc}
          onSelecionar={(novaUc) => {
            setUc(novaUc);
            setFaturaAtivaId(null);
          }}
        />

        {uc && (
          <div className="grid grid-cols-[400px_1fr] items-start gap-3.5">
            <div className="flex flex-col gap-2.5">
              <ColunaEntradas
                uc={uc}
                onFaturaCriada={(id) => {
                  setFaturaAtivaId(id);
                  setVersaoHistorico((v) => v + 1);
                }}
              />
              <HistoricoFaturas
                ucId={uc.id}
                versao={versaoHistorico}
                faturaAtivaId={faturaAtivaId}
                onSelecionar={setFaturaAtivaId}
              />
            </div>
            <div>
              {faturaAtivaId ? (
                <PainelConferencia faturaId={faturaAtivaId} onLiberada={() => setVersaoHistorico((v) => v + 1)} />
              ) : (
                <div className="cartao p-5 text-xs text-legenda">selecione ou envie uma fatura para conferir</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ColunaEntradas({ uc, onFaturaCriada }: { uc: UcResultado; onFaturaCriada: (id: string) => void }) {
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const entradaPdfRef = useRef<HTMLInputElement>(null);
  const entradaFotoRef = useRef<HTMLInputElement>(null);

  async function processarArquivo(arquivo: File, origem: "pdf" | "foto") {
    setErro(null);
    setProcessando(origem);
    try {
      const caminho = await enviarArquivoFatura(uc.id, arquivo);
      const extracao = await extrairCamposFatura(caminho, arquivo.type);
      const faturaId = await criarFatura({
        unidadeConsumidoraId: uc.id,
        origem,
        arquivoUrl: caminho,
        extracao,
      });
      onFaturaCriada(faturaId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao processar o arquivo");
    } finally {
      setProcessando(null);
    }
  }

  async function digitarManualmente() {
    setErro(null);
    setProcessando("digitado");
    try {
      const faturaId = await criarFatura({ unidadeConsumidoraId: uc.id, origem: "digitado" });
      onFaturaCriada(faturaId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao criar fatura");
    } finally {
      setProcessando(null);
    }
  }

  function aoSelecionarPdf(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (arquivo) processarArquivo(arquivo, "pdf");
    evento.target.value = "";
  }

  function aoSelecionarFoto(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (arquivo) processarArquivo(arquivo, "foto");
    evento.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[13px] font-semibold text-tinta">entrada da fatura</div>
      <p className="text-xs text-legenda">qualquer um dos quatro caminhos resolve, escolha o que estiver à mão.</p>

      <button
        type="button"
        onClick={() => entradaPdfRef.current?.click()}
        disabled={processando !== null}
        className="flex flex-col items-center gap-1.5 rounded-cartao border border-dashed border-info-borda bg-white px-4 py-5 hover:bg-hover-fundo disabled:opacity-60"
      >
        <span className="text-[13px] font-semibold text-info">
          {processando === "pdf" ? "processando pdf..." : "soltar o pdf aqui"}
        </span>
        <span className="text-xs text-legenda">ou clique para escolher no computador</span>
      </button>
      <input ref={entradaPdfRef} type="file" accept="application/pdf" hidden onChange={aoSelecionarPdf} />
      <input ref={entradaFotoRef} type="file" accept="image/*" hidden onChange={aoSelecionarFoto} />

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => entradaFotoRef.current?.click()}
          disabled={processando !== null}
          className="flex flex-col items-start gap-1 rounded-cartao border-fina border-borda-forte bg-white p-3.5 text-left hover:bg-hover-fundo disabled:opacity-60"
        >
          <span className="text-[13px] font-semibold text-tinta">
            {processando === "foto" ? "processando foto..." : "enviar foto"}
          </span>
          <span className="text-[11px] text-legenda">foto tirada pelo cliente ou pelo técnico</span>
        </button>

        <button
          type="button"
          disabled
          title="integração com a agência virtual ainda não está configurada"
          className="flex flex-col items-start gap-1 rounded-cartao border-fina border-borda-forte bg-white p-3.5 text-left opacity-50"
        >
          <span className="text-[13px] font-semibold text-tinta">importar da agência virtual</span>
          <span className="text-[11px] text-legenda">integração ainda não configurada</span>
        </button>

        <button
          type="button"
          onClick={digitarManualmente}
          disabled={processando !== null}
          className="col-span-2 flex flex-col items-start gap-1 rounded-cartao border-fina border-borda-forte bg-white p-3.5 text-left hover:bg-hover-fundo disabled:opacity-60"
        >
          <span className="text-[13px] font-semibold text-tinta">
            {processando === "digitado" ? "criando..." : "digitar manualmente"}
          </span>
          <span className="text-[11px] text-legenda">onze campos, poucos minutos</span>
        </button>
      </div>

      {erro && <p className="text-xs text-vermelho">{erro}</p>}
    </div>
  );
}

function HistoricoFaturas({
  ucId,
  versao,
  faturaAtivaId,
  onSelecionar,
}: {
  ucId: string;
  versao: number;
  faturaAtivaId: string | null;
  onSelecionar: (id: string) => void;
}) {
  const [faturas, setFaturas] = useState<FaturaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    supabase
      .from("fatura")
      .select("id, periodo_inicio, periodo_fim, valor_total, status, origem")
      .eq("unidade_consumidora_id", ucId)
      .order("periodo_fim", { ascending: false, nullsFirst: false })
      .limit(12)
      .then(({ data }) => {
        if (!ativo) return;
        setFaturas((data ?? []) as FaturaResumo[]);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [ucId, versao]);

  return (
    <section className="cartao p-3.5">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-legenda">últimos 12 ciclos</h2>
      {carregando ? (
        <p className="mt-2 text-xs text-legenda">carregando...</p>
      ) : faturas.length === 0 ? (
        <p className="mt-2 text-xs text-legenda">nenhuma fatura registrada para esta uc</p>
      ) : (
        <ul className="mt-1 divide-y divide-borda-fraca">
          {faturas.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onSelecionar(f.id)}
                className={`flex w-full items-center justify-between px-1 py-2 text-left text-xs hover:bg-hover-fundo ${
                  faturaAtivaId === f.id ? "bg-hover-fundo" : ""
                }`}
              >
                <span className="font-mono">
                  {f.periodo_inicio ?? "?"} até {f.periodo_fim ?? "?"}
                </span>
                <span className="flex items-center gap-2 text-legenda">
                  {f.valor_total ? `r$ ${f.valor_total}` : "—"}
                  <span className="rounded-[4px] bg-fundo px-1.5 py-0.5 text-[11px]">
                    {ROTULO_STATUS_FATURA[f.status] ?? f.status}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface CampoConferencia {
  id: string;
  campo: string;
  valor_lido: string | null;
  confianca: number | null;
  valor_confirmado: string | null;
}

const COR_CONFIANCA: Record<string, string> = {
  alta: "text-verde",
  media: "text-ambar",
  baixa: "text-vermelho",
  sem_extracao: "text-legenda",
};

const ROTULO_CONFIANCA: Record<string, string> = {
  alta: "confiança alta",
  media: "confiança média",
  baixa: "confiança baixa",
  sem_extracao: "sem extração",
};

const ROTULO_ORIGEM: Record<string, string> = {
  pdf: "pdf",
  foto: "foto",
  agencia_virtual: "agência virtual",
  digitado: "digitado",
};

function PainelConferencia({ faturaId, onLiberada }: { faturaId: string; onLiberada: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);
  const [arquivoUrl, setArquivoUrl] = useState<string | null>(null);
  const [urlAssinada, setUrlAssinada] = useState<string | null>(null);
  const [campos, setCampos] = useState<CampoConferencia[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregar();
  }, [faturaId]);

  async function carregar() {
    setCarregando(true);
    setErro(null);

    const [respFatura, respCampos] = await Promise.all([
      supabase.from("fatura").select("status, origem, arquivo_url").eq("id", faturaId).maybeSingle(),
      supabase
        .from("fatura_campo_extraido")
        .select("id, campo, valor_lido, confianca, valor_confirmado")
        .eq("fatura_id", faturaId),
    ]);

    if (respFatura.data) {
      setStatus(respFatura.data.status);
      setOrigem(respFatura.data.origem);
      setArquivoUrl(respFatura.data.arquivo_url);
      if (respFatura.data.arquivo_url) {
        gerarUrlAssinadaFatura(respFatura.data.arquivo_url).then(setUrlAssinada);
      } else {
        setUrlAssinada(null);
      }
    }

    const linhas = (respCampos.data ?? []) as CampoConferencia[];
    setCampos(linhas);
    const iniciais: Record<string, string> = {};
    for (const linha of linhas) {
      iniciais[linha.campo] = linha.valor_confirmado ?? linha.valor_lido ?? "";
    }
    setValores(iniciais);
    setCarregando(false);
  }

  const pendentes = useMemo(
    () => CAMPOS_FATURA.filter((def) => !valores[def.campo]?.trim()).length,
    [valores]
  );

  async function salvarConferencia() {
    setSalvando(true);
    setErro(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await Promise.all(
        campos.map((linha) =>
          supabase
            .from("fatura_campo_extraido")
            .update({
              valor_confirmado: valores[linha.campo] || null,
              confirmado_por: user?.id ?? null,
              confirmado_em: new Date().toISOString(),
            })
            .eq("id", linha.id)
        )
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao salvar conferência");
    } finally {
      setSalvando(false);
    }
  }

  async function liberarParaDiagnostico() {
    setLiberando(true);
    setErro(null);
    try {
      const atualizacao: Record<string, unknown> = {};
      for (const def of CAMPOS_FATURA) {
        const valor = valores[def.campo]?.trim();
        atualizacao[def.campo] = valor ? converterValor(valor, def.tipo) : null;
      }
      atualizacao.status = "conferida";

      const { error } = await supabase.from("fatura").update(atualizacao).eq("id", faturaId);
      if (error) throw error;

      await salvarConferencia();
      setStatus("conferida");
      onLiberada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao liberar a fatura");
    } finally {
      setLiberando(false);
    }
  }

  if (carregando) {
    return <div className="cartao p-5 text-xs text-legenda">carregando...</div>;
  }

  const somenteLeitura = status === "conferida" || status === "rejeitada";

  return (
    <section className="cartao overflow-hidden">
      <div className="flex items-center gap-2.5 border-b-fina border-borda px-[18px] py-3">
        <span className="text-[13px] font-semibold text-tinta">extração, campo a campo</span>
        <span className="rounded-[4px] border-fina border-borda bg-fundo px-1.5 py-0.5 text-[11px] text-legenda">
          origem: {origem ? ROTULO_ORIGEM[origem] ?? origem : "—"}
        </span>
        <div className="flex-1" />
        <span className="rounded-[4px] border-fina border-verde-borda bg-verde-bg px-1.5 py-0.5 text-[11px] text-verde">
          {ROTULO_STATUS_FATURA[status ?? ""] ?? status}
        </span>
      </div>

      {origem === "foto" && urlAssinada && (
        <div className="border-b-fina border-borda p-3.5">
          <img src={urlAssinada} alt="fatura enviada" className="max-h-48 rounded-controle border-fina border-borda" />
        </div>
      )}
      {origem === "pdf" && urlAssinada && (
        <div className="border-b-fina border-borda p-3.5">
          <a href={urlAssinada} target="_blank" rel="noreferrer" className="text-xs text-teal">
            abrir pdf original ↗
          </a>
        </div>
      )}
      {!arquivoUrl && origem === "digitado" && (
        <p className="border-b-fina border-borda p-3.5 text-xs text-legenda">
          fatura digitada manualmente, sem arquivo original
        </p>
      )}

      <div className="grid grid-cols-2">
        {CAMPOS_FATURA.map((def, indice) => {
          const linha = campos.find((c) => c.campo === def.campo);
          const bucket = bucketConfianca(linha?.confianca ?? null);
          const precisaConferir = bucket === "media" || bucket === "baixa" || bucket === "sem_extracao";
          const bordaDireita = indice % 2 === 0 ? "border-r-fina border-borda-fraca" : "";
          return (
            <div
              key={def.campo}
              className={`border-b-fina border-borda-fraca p-3.5 ${bordaDireita} ${precisaConferir ? "bg-ambar-bg" : ""}`}
            >
              <span className={`text-[11px] ${precisaConferir ? "text-ambar" : "text-legenda"}`}>
                {precisaConferir ? `${def.rotulo}, confirme o valor` : def.rotulo}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type={def.tipo === "data" ? "date" : def.tipo === "numero" ? "number" : "text"}
                  step={def.tipo === "numero" ? "0.01" : undefined}
                  disabled={somenteLeitura}
                  className={`flex-1 rounded-controle border-fina px-2.5 py-1.5 text-sm ${
                    precisaConferir ? "border-ambar-borda bg-white" : "border-transparent bg-transparent"
                  } focus:border-teal focus:outline-none`}
                  value={valores[def.campo] ?? ""}
                  onChange={(e) => setValores({ ...valores, [def.campo]: e.target.value })}
                />
                {linha && (
                  <span className={`shrink-0 text-[10px] ${COR_CONFIANCA[bucket]}`}>{ROTULO_CONFIANCA[bucket]}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {erro && <p className="px-[18px] pt-3 text-xs text-vermelho">{erro}</p>}

      {!somenteLeitura && (
        <div className="flex items-center gap-3.5 border-t-fina border-borda bg-hover-fundo px-[18px] py-3">
          <span className={pendentes > 0 ? "font-medium text-ambar" : "font-medium text-verde"}>
            {pendentes === 0 ? "todos os campos confirmados" : `${pendentes} campos precisam de conferência`}
          </span>
          <div className="flex-1" />
          <button type="button" onClick={salvarConferencia} disabled={salvando || liberando} className="botao-secundario">
            {salvando ? "salvando..." : "salvar conferência"}
          </button>
          <button
            type="button"
            onClick={liberarParaDiagnostico}
            disabled={pendentes > 0 || liberando}
            title={pendentes > 0 ? "confirme todos os campos antes de liberar" : undefined}
            className="botao-primario"
          >
            {liberando ? "liberando..." : "liberar para diagnóstico"}
          </button>
        </div>
      )}
    </section>
  );
}

function converterValor(valor: string, tipo: TipoCampoFatura): string | number {
  if (tipo === "numero") {
    const numero = Number(valor.replace(",", "."));
    return Number.isNaN(numero) ? 0 : numero;
  }
  return valor;
}
