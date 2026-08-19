import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface UcResultado {
  id: string;
  numero_uc: string;
  cliente_id: string;
  usina_id: string | null;
  cliente: { nome: string } | null;
}

export function BuscaUnidadeConsumidora({
  ucSelecionada,
  onSelecionar,
}: {
  ucSelecionada: UcResultado | null;
  onSelecionar: (uc: UcResultado) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<UcResultado[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (termo.trim().length < 2) {
      setResultados([]);
      return;
    }
    let ativo = true;
    setBuscando(true);
    const tempo = setTimeout(async () => {
      const { data } = await supabase
        .from("unidade_consumidora")
        .select("id, numero_uc, cliente_id, usina_id, cliente:cliente_id(nome)")
        .ilike("numero_uc", `%${termo.trim()}%`)
        .limit(10);
      if (!ativo) return;
      setResultados((data ?? []) as unknown as UcResultado[]);
      setBuscando(false);
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(tempo);
    };
  }, [termo]);

  return (
    <section className="cartao p-[18px]">
      <label className="block text-xs text-legenda">unidade consumidora (número da uc)</label>
      <input
        type="search"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="digite o número da uc"
        className="campo mt-1"
      />

      {ucSelecionada && (
        <p className="mt-2 text-xs text-tinta-suave">
          selecionada: <span className="font-medium text-teal">{ucSelecionada.numero_uc}</span> ·{" "}
          {ucSelecionada.cliente?.nome ?? "—"}
        </p>
      )}

      {buscando && <p className="mt-2 text-xs text-legenda">buscando...</p>}

      {resultados.length > 0 && (
        <ul className="mt-2 divide-y divide-borda-fraca rounded-controle border-fina border-borda">
          {resultados.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onSelecionar(r);
                  setTermo("");
                  setResultados([]);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-hover-fundo"
              >
                <span className="font-medium text-tinta">{r.numero_uc}</span>{" "}
                <span className="text-legenda">· {r.cliente?.nome ?? "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
