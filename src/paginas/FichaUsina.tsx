import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Cabecalho } from "../componentes/Cabecalho";
import { supabase } from "../lib/supabase";

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const FONTES_DADOS = [
  { valor: "", rotulo: "não definida" },
  { valor: "api_fabricante", rotulo: "api do fabricante" },
  { valor: "solarz", rotulo: "solarz" },
  { valor: "manual", rotulo: "entrada manual" },
] as const;

const ROTULO_COBERTURA: Record<string, string> = {
  completa: "completa — leitura por dispositivo, todas as regras rodam",
  parcial: "parcial — só total da usina, não detecta dispositivo individual parado",
  sem_monitoramento: "sem monitoramento — diagnóstico depende só da fatura",
};

interface Usina {
  id: string;
  cliente_id: string;
  nome_monitoramento: string;
  endereco: string | null;
  cidade: string | null;
  potencia_kwp: number | null;
  quantidade_modulos: number | null;
  data_conexao: string | null;
  autoconsumo_estimado_pct: number | null;
  ativa: boolean;
  fonte_dados_geracao: string | null;
  cobertura_monitoramento_atual: "completa" | "parcial" | "sem_monitoramento";
  cliente: { nome: string } | null;
}

interface Dispositivo {
  id: string;
  fabricante: string;
  tipo: string;
  identificador_fabricante: string;
  numero_serie: string | null;
  potencia_w: number | null;
  quantidade_modulos_atendidos: number | null;
  ativo: boolean;
  ultimaLeituraData: string | null;
  ultimaLeituraKwh: number | null;
  estadoAberto: string | null;
  eventoInicio: string | null;
}

interface RateioLinha {
  id: string;
  percentual: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  unidade_consumidora: { numero_uc: string; tipo: string } | null;
}

const ROTULO_ESTADO: Record<string, string> = {
  parado: "parado",
  abaixo_dos_pares: "abaixo dos pares",
  sem_comunicacao: "sem comunicação",
};

export function FichaUsina() {
  const { id } = useParams<{ id: string }>();
  const [usina, setUsina] = useState<Usina | null>(null);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [rateios, setRateios] = useState<RateioLinha[]>([]);
  const [geracaoEsperada, setGeracaoEsperada] = useState<Record<number, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    carregarTudo(id);
  }, [id]);

  async function carregarTudo(usinaId: string) {
    setCarregando(true);
    setErro(null);

    const [respUsina, respDispositivos, respRateios, respGeracaoEsperada] = await Promise.all([
      supabase
        .from("usina")
        .select(
          "id, cliente_id, nome_monitoramento, endereco, cidade, potencia_kwp, quantidade_modulos, data_conexao, autoconsumo_estimado_pct, ativa, fonte_dados_geracao, cobertura_monitoramento_atual, cliente:cliente_id(nome)"
        )
        .eq("id", usinaId)
        .maybeSingle(),
      supabase
        .from("dispositivo")
        .select(
          "id, fabricante, tipo, identificador_fabricante, numero_serie, potencia_w, quantidade_modulos_atendidos, ativo"
        )
        .eq("usina_id", usinaId)
        .order("identificador_fabricante"),
      supabase
        .from("rateio")
        .select(
          "id, percentual, vigencia_inicio, vigencia_fim, unidade_consumidora:unidade_consumidora_id(numero_uc, tipo)"
        )
        .eq("usina_id", usinaId)
        .order("vigencia_inicio", { ascending: false }),
      supabase.from("geracao_esperada_mensal").select("mes, energia_esperada_kwh").eq("usina_id", usinaId),
    ]);

    if (respUsina.error || !respUsina.data) {
      setErro(respUsina.error?.message ?? "usina não encontrada");
      setCarregando(false);
      return;
    }
    setUsina(respUsina.data as unknown as Usina);

    const dispositivosBase = (respDispositivos.data ?? []) as unknown as Omit<
      Dispositivo,
      "ultimaLeituraData" | "ultimaLeituraKwh" | "estadoAberto" | "eventoInicio"
    >[];

    const ultimasLeituras = new Map<string, { data: string; energia_kwh: number }>();
    const eventosAbertos = new Map<string, { estado: string; inicio: string }>();
    if (dispositivosBase.length > 0) {
      const idsDispositivos = dispositivosBase.map((d) => d.id);
      const [{ data: leituras }, { data: eventos }] = await Promise.all([
        supabase
          .from("leitura_geracao")
          .select("dispositivo_id, data, energia_kwh")
          .eq("usina_id", usinaId)
          .not("dispositivo_id", "is", null)
          .order("data", { ascending: false })
          .limit(500),
        supabase
          .from("evento_dispositivo")
          .select("dispositivo_id, estado, inicio")
          .in("dispositivo_id", idsDispositivos)
          .is("fim", null),
      ]);

      for (const leitura of leituras ?? []) {
        const dispId = leitura.dispositivo_id as string;
        if (!ultimasLeituras.has(dispId)) {
          ultimasLeituras.set(dispId, { data: leitura.data, energia_kwh: leitura.energia_kwh });
        }
      }
      for (const evento of eventos ?? []) {
        eventosAbertos.set(evento.dispositivo_id as string, { estado: evento.estado, inicio: evento.inicio });
      }
    }

    setDispositivos(
      dispositivosBase.map((d) => ({
        ...d,
        ultimaLeituraData: ultimasLeituras.get(d.id)?.data ?? null,
        ultimaLeituraKwh: ultimasLeituras.get(d.id)?.energia_kwh ?? null,
        estadoAberto: eventosAbertos.get(d.id)?.estado ?? null,
        eventoInicio: eventosAbertos.get(d.id)?.inicio ?? null,
      }))
    );

    setRateios((respRateios.data ?? []) as unknown as RateioLinha[]);

    const mapaGeracao: Record<number, string> = {};
    for (const linha of respGeracaoEsperada.data ?? []) {
      mapaGeracao[linha.mes] = String(linha.energia_esperada_kwh);
    }
    setGeracaoEsperada(mapaGeracao);

    setCarregando(false);
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-fundo">
        <Cabecalho />
        <p className="p-6 text-xs text-legenda">carregando...</p>
      </div>
    );
  }

  if (erro || !usina) {
    return (
      <div className="min-h-screen bg-fundo">
        <Cabecalho />
        <p className="p-6 text-xs text-vermelho">{erro}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fundo">
      <Cabecalho />
      <main className="mx-auto max-w-[1120px] space-y-3.5 px-6 py-5">
        <div>
          <div className="flex items-center justify-between">
            <Link to="/usinas" className="text-xs text-teal">
              ← usinas
            </Link>
            <div className="flex items-center gap-4">
              <Link to={`/usinas/${usina.id}/dispositivos`} className="text-xs text-teal">
                painel de dispositivos
              </Link>
              <Link to={`/usinas/${usina.id}/leitura-manual`} className="text-xs text-teal">
                lançar leitura manual →
              </Link>
            </div>
          </div>
          <h1 className="mt-1 text-lg font-semibold text-tinta">{usina.nome_monitoramento}</h1>
        </div>

        <BlocoIdentificacao usina={usina} aoSalvar={() => carregarTudo(usina.id)} />
        <BlocoEquipamentos dispositivos={dispositivos} usina={usina} />
        <BlocoDivergenciaFontes usinaId={usina.id} />
        <BlocoRateios rateios={rateios} />
        <BlocoParametros usina={usina} geracaoEsperada={geracaoEsperada} aoSalvar={() => carregarTudo(usina.id)} />
      </main>
    </div>
  );
}

function BlocoIdentificacao({ usina, aoSalvar }: { usina: Usina; aoSalvar: () => void }) {
  const [form, setForm] = useState({
    nome_monitoramento: usina.nome_monitoramento,
    endereco: usina.endereco ?? "",
    cidade: usina.cidade ?? "",
    potencia_kwp: usina.potencia_kwp?.toString() ?? "",
    quantidade_modulos: usina.quantidade_modulos?.toString() ?? "",
    data_conexao: usina.data_conexao ?? "",
    ativa: usina.ativa,
    fonte_dados_geracao: usina.fonte_dados_geracao ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { error } = await supabase
      .from("usina")
      .update({
        nome_monitoramento: form.nome_monitoramento,
        endereco: form.endereco || null,
        cidade: form.cidade || null,
        potencia_kwp: form.potencia_kwp ? Number(form.potencia_kwp) : null,
        quantidade_modulos: form.quantidade_modulos ? Number(form.quantidade_modulos) : null,
        data_conexao: form.data_conexao || null,
        ativa: form.ativa,
        fonte_dados_geracao: form.fonte_dados_geracao || null,
      })
      .eq("id", usina.id);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    aoSalvar();
  }

  return (
    <section className="cartao p-[18px]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="text-[13px] font-semibold text-tinta">identificação</span>
        <span className="font-mono text-[11px] text-teal">usina {usina.id.slice(0, 8)}</span>
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-3.5">
        <Campo rotulo="cliente">
          <p className="py-1.5 text-sm text-tinta-suave">{usina.cliente?.nome ?? "—"}</p>
        </Campo>
        <Campo rotulo="nome de monitoramento">
          <input className="campo" value={form.nome_monitoramento} onChange={(e) => setForm({ ...form, nome_monitoramento: e.target.value })} />
        </Campo>
        <Campo rotulo="endereço">
          <input className="campo" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
        </Campo>
        <Campo rotulo="cidade">
          <input className="campo" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
        </Campo>
        <Campo rotulo="potência instalada (kwp)">
          <input type="number" step="0.001" className="campo" value={form.potencia_kwp} onChange={(e) => setForm({ ...form, potencia_kwp: e.target.value })} />
        </Campo>
        <Campo rotulo="quantidade de módulos">
          <input type="number" className="campo" value={form.quantidade_modulos} onChange={(e) => setForm({ ...form, quantidade_modulos: e.target.value })} />
        </Campo>
        <Campo rotulo="data de conexão">
          <input type="date" className="campo" value={form.data_conexao} onChange={(e) => setForm({ ...form, data_conexao: e.target.value })} />
        </Campo>
        <Campo rotulo="situação">
          <select className="campo" value={form.ativa ? "ativa" : "inativa"} onChange={(e) => setForm({ ...form, ativa: e.target.value === "ativa" })}>
            <option value="ativa">ativa</option>
            <option value="inativa">inativa</option>
          </select>
        </Campo>
        <Campo rotulo="fonte de dados de geração">
          <select className="campo" value={form.fonte_dados_geracao} onChange={(e) => setForm({ ...form, fonte_dados_geracao: e.target.value })}>
            {FONTES_DADOS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="cobertura de monitoramento">
          <p className="py-1.5 text-sm text-tinta-suave">{ROTULO_COBERTURA[usina.cobertura_monitoramento_atual]}</p>
        </Campo>
      </div>

      {erro && <p className="mt-3 text-xs text-vermelho">{erro}</p>}

      <button type="button" onClick={salvar} disabled={salvando} className="botao-primario mt-4">
        {salvando ? "salvando..." : "salvar identificação"}
      </button>
    </section>
  );
}

function BlocoEquipamentos({ dispositivos, usina }: { dispositivos: Dispositivo[]; usina: Usina }) {
  const ultimaLeitura = dispositivos.reduce<string | null>((maisRecente, d) => {
    if (!d.ultimaLeituraData) return maisRecente;
    if (!maisRecente || d.ultimaLeituraData > maisRecente) return d.ultimaLeituraData;
    return maisRecente;
  }, null);

  return (
    <section className="cartao p-[18px]">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] font-semibold text-tinta">equipamentos</span>
        <span
          className={`rounded-[4px] border-fina px-1.5 py-0.5 text-[11px] ${
            usina.fonte_dados_geracao
              ? "border-verde-borda bg-verde-bg text-verde"
              : "border-borda bg-fundo text-legenda"
          }`}
        >
          {usina.fonte_dados_geracao ? `integração ${usina.fonte_dados_geracao} ativa` : "integração não configurada"}
        </span>
        {ultimaLeitura && <span className="text-[11px] text-legenda">última leitura recebida: {ultimaLeitura}</span>}
      </div>

      <div className="overflow-hidden rounded-controle border-fina border-borda">
        <table className="w-full text-left text-sm">
          <thead className="bg-hover-fundo text-legenda">
            <tr>
              <th className="px-3 py-2 text-[11px] font-medium">identificador</th>
              <th className="px-3 py-2 text-[11px] font-medium">fabricante</th>
              <th className="px-3 py-2 text-[11px] font-medium">tipo</th>
              <th className="px-3 py-2 text-[11px] font-medium">nº série</th>
              <th className="px-3 py-2 text-[11px] font-medium">módulos</th>
              <th className="px-3 py-2 text-[11px] font-medium">última leitura</th>
              <th className="px-3 py-2 text-[11px] font-medium">situação</th>
            </tr>
          </thead>
          <tbody>
            {dispositivos.map((d) => {
              const critico = d.estadoAberto === "parado";
              return (
                <tr key={d.id} className={`border-t-fina border-borda-fraca ${critico ? "bg-vermelho-bg" : ""}`}>
                  <td className={`px-3 py-1.5 ${critico ? "font-medium text-vermelho" : ""}`}>{d.identificador_fabricante}</td>
                  <td className={`px-3 py-1.5 ${critico ? "text-vermelho" : "text-tinta-suave"}`}>{d.fabricante}</td>
                  <td className={`px-3 py-1.5 ${critico ? "text-vermelho" : "text-tinta-suave"}`}>{d.tipo}</td>
                  <td className={`px-3 py-1.5 font-mono text-xs ${critico ? "text-vermelho" : "text-tinta-suave"}`}>
                    {d.numero_serie ?? "—"}
                  </td>
                  <td className={`px-3 py-1.5 font-mono text-xs ${critico ? "text-vermelho" : "text-tinta-suave"}`}>
                    {d.quantidade_modulos_atendidos ?? "—"}
                  </td>
                  <td className={`px-3 py-1.5 ${critico ? "text-vermelho" : "text-tinta-suave"}`}>
                    {d.ultimaLeituraData ? `${d.ultimaLeituraData} · ${d.ultimaLeituraKwh} kwh` : "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    {d.estadoAberto ? (
                      <span className="font-medium text-vermelho">
                        {ROTULO_ESTADO[d.estadoAberto] ?? d.estadoAberto}
                        {d.eventoInicio && d.estadoAberto === "parado"
                          ? ` há ${Math.floor((Date.now() - new Date(d.eventoInicio).getTime()) / 86400000)} dias`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-verde">normal</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {dispositivos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-legenda">
                  nenhum dispositivo cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface DivergenciaFonte {
  id: string;
  data: string;
  energia_fabricante_kwh: number;
  energia_solarz_kwh: number;
  diferenca_pct: number;
  sinalizado: boolean;
}

// alerta interno da seção 4 do pedido: quando a usina tem leitura pelo
// fabricante e pelo solarz no mesmo dia, o coletor registra a diferença
// entre as duas fontes aqui. nunca aparece para o cliente, só para a equipe
// que está investigando por que os números não batem.
function BlocoDivergenciaFontes({ usinaId }: { usinaId: string }) {
  const [divergencias, setDivergencias] = useState<DivergenciaFonte[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("divergencia_fonte")
      .select("id, data, energia_fabricante_kwh, energia_solarz_kwh, diferenca_pct, sinalizado")
      .eq("usina_id", usinaId)
      .order("data", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!ativo) return;
        setDivergencias((data ?? []) as DivergenciaFonte[]);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [usinaId]);

  if (carregando || divergencias.length === 0) return null;

  const temSinalizada = divergencias.some((d) => d.sinalizado);

  return (
    <section className="cartao p-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] font-semibold text-tinta">divergência entre fontes</span>
        <span className="rounded-[4px] bg-fundo px-1.5 py-0.5 text-[11px] text-legenda">alerta interno, não visível ao cliente</span>
        {temSinalizada && (
          <span className="rounded-[4px] border-fina border-ambar-borda bg-ambar-bg px-1.5 py-0.5 text-[11px] text-ambar">
            acima do limiar configurado
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-legenda">
        comparação entre a leitura do fabricante e do solarz no mesmo dia, quando as duas existem — mede possível
        falha de sincronia entre as plataformas.
      </p>

      <div className="mt-3 overflow-hidden rounded-controle border-fina border-borda">
        <table className="w-full text-left text-sm">
          <thead className="bg-hover-fundo text-legenda">
            <tr>
              <th className="px-3 py-2 text-[11px] font-medium">data</th>
              <th className="px-3 py-2 text-[11px] font-medium">fabricante (kwh)</th>
              <th className="px-3 py-2 text-[11px] font-medium">solarz (kwh)</th>
              <th className="px-3 py-2 text-[11px] font-medium">diferença</th>
            </tr>
          </thead>
          <tbody>
            {divergencias.map((d) => (
              <tr key={d.id} className={`border-t-fina border-borda-fraca ${d.sinalizado ? "bg-ambar-bg" : ""}`}>
                <td className="px-3 py-1.5 font-mono text-xs">{d.data}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-tinta-suave">{d.energia_fabricante_kwh}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-tinta-suave">{d.energia_solarz_kwh}</td>
                <td className={`px-3 py-1.5 font-mono text-xs font-medium ${d.sinalizado ? "text-ambar" : "text-tinta-suave"}`}>
                  {d.diferenca_pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BlocoRateios({ rateios }: { rateios: RateioLinha[] }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const vigentes = rateios.filter((r) => !r.vigencia_fim || r.vigencia_fim >= hoje);
  const historico = rateios.filter((r) => r.vigencia_fim && r.vigencia_fim < hoje);
  const somaVigentes = vigentes.reduce((soma, r) => soma + r.percentual, 0);
  const somaFecha = Math.abs(somaVigentes - 100) < 0.01;

  return (
    <section className="cartao p-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] font-semibold text-tinta">amarração de unidades consumidoras</span>
        <div className="flex-1" />
        {vigentes.length > 0 && (
          <span
            className={`rounded-[4px] border-fina px-2 py-0.5 text-[11px] font-medium ${
              somaFecha ? "border-verde-borda bg-verde-bg text-verde" : "border-vermelho-borda bg-vermelho-bg text-vermelho"
            }`}
          >
            soma dos rateios: {somaVigentes.toFixed(0)}%{!somaFecha ? `, faltam ${(100 - somaVigentes).toFixed(0)}%` : ""}
          </span>
        )}
      </div>

      {vigentes.length > 0 && !somaFecha && (
        <p className="mt-2 rounded-controle bg-ambar-bg px-3 py-2 text-xs text-ambar">
          a soma dos percentuais vigentes é {somaVigentes.toFixed(2)}%, não fecha 100% — sinalizado, não bloqueado
        </p>
      )}

      <TabelaRateio titulo="vigentes" linhas={vigentes} />
      {historico.length > 0 && <TabelaRateio titulo="histórico" linhas={historico} />}
    </section>
  );
}

function TabelaRateio({ titulo, linhas }: { titulo: string; linhas: RateioLinha[] }) {
  return (
    <div className="mt-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-legenda">{titulo}</p>
      <div className="mt-1 overflow-hidden rounded-controle border-fina border-borda">
        <table className="w-full text-left text-sm">
          <thead className="bg-hover-fundo text-legenda">
            <tr>
              <th className="px-3 py-2 text-[11px] font-medium">uc</th>
              <th className="px-3 py-2 text-[11px] font-medium">tipo</th>
              <th className="px-3 py-2 text-[11px] font-medium">percentual</th>
              <th className="px-3 py-2 text-[11px] font-medium">vigência</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((r) => (
              <tr key={r.id} className="border-t-fina border-borda-fraca">
                <td className="px-3 py-1.5 font-mono text-xs">{r.unidade_consumidora?.numero_uc ?? "—"}</td>
                <td className="px-3 py-1.5 text-tinta-suave">{r.unidade_consumidora?.tipo ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-tinta-suave">{r.percentual}%</td>
                <td className="px-3 py-1.5 font-mono text-xs text-tinta-suave">
                  {r.vigencia_inicio} até {r.vigencia_fim ?? "atual"}
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-legenda">
                  nenhum rateio {titulo}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BlocoParametros({
  usina,
  geracaoEsperada,
  aoSalvar,
}: {
  usina: Usina;
  geracaoEsperada: Record<number, string>;
  aoSalvar: () => void;
}) {
  const [autoconsumo, setAutoconsumo] = useState(usina.autoconsumo_estimado_pct?.toString() ?? "");
  const [meses, setMeses] = useState<Record<number, string>>(geracaoEsperada);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);

    const { error: erroUsina } = await supabase
      .from("usina")
      .update({ autoconsumo_estimado_pct: autoconsumo ? Number(autoconsumo) : null })
      .eq("id", usina.id);

    if (erroUsina) {
      setErro(erroUsina.message);
      setSalvando(false);
      return;
    }

    const linhasParaGravar = Object.entries(meses)
      .filter(([, valor]) => valor.trim() !== "")
      .map(([mes, valor]) => ({
        usina_id: usina.id,
        mes: Number(mes),
        energia_esperada_kwh: Number(valor),
      }));

    if (linhasParaGravar.length > 0) {
      const { error: erroGeracao } = await supabase
        .from("geracao_esperada_mensal")
        .upsert(linhasParaGravar, { onConflict: "usina_id,mes" });
      if (erroGeracao) {
        setErro(erroGeracao.message);
        setSalvando(false);
        return;
      }
    }

    setSalvando(false);
    aoSalvar();
  }

  return (
    <section className="cartao p-[18px]">
      <div className="text-[13px] font-semibold text-tinta">parâmetros de diagnóstico</div>
      <p className="mb-3 mt-0.5 text-xs text-legenda">
        geração esperada mês a mês, em kwh, conforme projeto e histórico de irradiação
      </p>
      <div className="grid grid-cols-12 gap-2">
        {NOMES_MES.map((nome, indice) => {
          const mes = indice + 1;
          return (
            <div key={mes} className="flex flex-col gap-0.5">
              <span className="text-[10px] text-legenda">{nome}</span>
              <input
                type="number"
                step="0.001"
                className="font-mono w-full rounded-controle border-fina border-borda-forte px-1.5 py-1 text-xs focus:border-teal focus:outline-none"
                value={meses[mes] ?? ""}
                onChange={(e) => setMeses({ ...meses, [mes]: e.target.value })}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-5 border-t-fina border-borda-fraca pt-3.5">
        <div className="flex min-w-[150px] flex-col gap-0.5">
          <span className="text-[11px] text-legenda">autoconsumo estimado</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="font-mono w-24 rounded-controle border-fina border-borda-forte px-2 py-1 text-lg font-semibold focus:border-teal focus:outline-none"
            value={autoconsumo}
            onChange={(e) => setAutoconsumo(e.target.value)}
          />
        </div>
        <p className="max-w-[74ch] text-xs text-legenda">
          parte da geração é consumida na hora, dentro da casa, e nunca chega a ser injetada na rede. o motor desconta
          esse percentual antes de comparar com o medidor da distribuidora, e é isso que evita alarme falso de
          divergência de medição.
        </p>
      </div>

      {erro && <p className="mt-3 text-xs text-vermelho">{erro}</p>}

      <button type="button" onClick={salvar} disabled={salvando} className="botao-primario mt-4">
        {salvando ? "salvando..." : "salvar parâmetros"}
      </button>
    </section>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-legenda">{rotulo}</span>
      {children}
    </label>
  );
}
