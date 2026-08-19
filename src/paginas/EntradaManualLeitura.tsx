import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Cabecalho } from "../componentes/Cabecalho";
import { supabase } from "../lib/supabase";

interface Dispositivo {
  id: string;
  identificador_fabricante: string;
}

interface LeituraManual {
  id: string;
  data: string;
  energia_kwh: number;
  dispositivo: { identificador_fabricante: string } | null;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EntradaManualLeitura() {
  const { id } = useParams<{ id: string }>();
  const [nomeUsina, setNomeUsina] = useState<string>("");
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [leituras, setLeituras] = useState<LeituraManual[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [data, setData] = useState(hoje());
  const [dispositivoId, setDispositivoId] = useState<string>("");
  const [energiaKwh, setEnergiaKwh] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    carregar(id);
  }, [id]);

  async function carregar(usinaId: string) {
    setCarregando(true);
    const [respUsina, respDispositivos, respLeituras] = await Promise.all([
      supabase.from("usina").select("nome_monitoramento").eq("id", usinaId).maybeSingle(),
      supabase
        .from("dispositivo")
        .select("id, identificador_fabricante")
        .eq("usina_id", usinaId)
        .order("identificador_fabricante"),
      supabase
        .from("leitura_geracao")
        .select("id, data, energia_kwh, dispositivo:dispositivo_id(identificador_fabricante)")
        .eq("usina_id", usinaId)
        .eq("fonte", "manual")
        .order("data", { ascending: false })
        .limit(30),
    ]);

    setNomeUsina(respUsina.data?.nome_monitoramento ?? "");
    setDispositivos((respDispositivos.data ?? []) as Dispositivo[]);
    setLeituras((respLeituras.data ?? []) as unknown as LeituraManual[]);
    setCarregando(false);
  }

  async function salvar() {
    if (!id) return;
    setErro(null);
    setMensagem(null);

    const energia = Number(energiaKwh.replace(",", "."));
    if (!data || Number.isNaN(energia)) {
      setErro("preencha a data e um valor numérico de energia");
      return;
    }

    setSalvando(true);
    try {
      let consulta = supabase.from("leitura_geracao").select("id").eq("usina_id", id).eq("data", data);
      consulta = dispositivoId ? consulta.eq("dispositivo_id", dispositivoId) : consulta.is("dispositivo_id", null);
      const { data: existente } = await consulta.maybeSingle();

      const linha = {
        usina_id: id,
        dispositivo_id: dispositivoId || null,
        data,
        energia_kwh: energia,
        fonte: "manual",
        granularidade: dispositivoId ? "dispositivo" : "usina",
        coletado_em: new Date().toISOString(),
      };

      const { error } = existente
        ? await supabase.from("leitura_geracao").update(linha).eq("id", existente.id)
        : await supabase.from("leitura_geracao").insert(linha);

      if (error) throw error;

      setMensagem(existente ? "leitura atualizada" : "leitura registrada");
      setEnergiaKwh("");
      await carregar(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao salvar a leitura");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-fundo">
      <Cabecalho />
      <main className="mx-auto max-w-[640px] space-y-3.5 px-6 py-5">
        <div>
          {id && (
            <Link to={`/usinas/${id}`} className="text-xs text-teal">
              ← {nomeUsina || "usina"}
            </Link>
          )}
          <h1 className="mt-1 text-base font-semibold text-tinta">entrada manual de leitura</h1>
          <p className="mt-1 text-xs text-legenda">
            use quando a usina não tem integração automática, ou para completar um dia sem dado.
          </p>
        </div>

        <section className="cartao p-[18px]">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs text-legenda">data</span>
              <input type="date" className="campo mt-1" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-xs text-legenda">dispositivo</span>
              <select
                className="campo mt-1"
                value={dispositivoId}
                onChange={(e) => setDispositivoId(e.target.value)}
              >
                <option value="">usina inteira (total agregado)</option>
                {dispositivos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.identificador_fabricante}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="block text-xs text-legenda">energia gerada no dia (kwh)</span>
              <input
                type="number"
                step="0.001"
                className="campo mt-1"
                value={energiaKwh}
                onChange={(e) => setEnergiaKwh(e.target.value)}
              />
            </label>
          </div>

          {erro && <p className="mt-3 text-xs text-vermelho">{erro}</p>}
          {mensagem && <p className="mt-3 text-xs text-verde">{mensagem}</p>}

          <button type="button" onClick={salvar} disabled={salvando} className="botao-primario mt-4">
            {salvando ? "salvando..." : "salvar leitura"}
          </button>
        </section>

        <section className="cartao p-[18px]">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-legenda">últimos lançamentos manuais</h2>
          {carregando ? (
            <p className="mt-2 text-xs text-legenda">carregando...</p>
          ) : leituras.length === 0 ? (
            <p className="mt-2 text-xs text-legenda">nenhuma leitura manual registrada ainda</p>
          ) : (
            <ul className="mt-2 divide-y divide-borda-fraca text-sm">
              {leituras.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs">{l.data}</span>
                  <span className="text-xs text-legenda">
                    {l.dispositivo?.identificador_fabricante ?? "usina inteira"}
                  </span>
                  <span className="font-mono text-xs font-medium text-tinta">{l.energia_kwh} kwh</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
