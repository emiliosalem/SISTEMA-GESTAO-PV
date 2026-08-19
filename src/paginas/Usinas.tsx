import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cabecalho } from "../componentes/Cabecalho";
import { supabase } from "../lib/supabase";

interface LinhaUsina {
  id: string;
  nome_monitoramento: string;
  cidade: string | null;
  potencia_kwp: number | null;
  ativa: boolean;
  cobertura_monitoramento_atual: "completa" | "parcial" | "sem_monitoramento";
  cliente: { nome: string } | null;
}

const rotuloCobertura: Record<LinhaUsina["cobertura_monitoramento_atual"], string> = {
  completa: "completa",
  parcial: "parcial",
  sem_monitoramento: "sem monitoramento",
};

const corCobertura: Record<LinhaUsina["cobertura_monitoramento_atual"], string> = {
  completa: "border-fina border-verde-borda bg-verde-bg text-verde",
  parcial: "border-fina border-ambar-borda bg-ambar-bg text-ambar",
  sem_monitoramento: "border-fina border-vermelho-borda bg-vermelho-bg text-vermelho",
};

export function Usinas() {
  const [usinas, setUsinas] = useState<LinhaUsina[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data, error } = await supabase
        .from("usina")
        .select(
          "id, nome_monitoramento, cidade, potencia_kwp, ativa, cobertura_monitoramento_atual, cliente:cliente_id(nome)"
        )
        .order("nome_monitoramento");

      if (error) {
        setErro(error.message);
      } else {
        setUsinas((data ?? []) as unknown as LinhaUsina[]);
      }
      setCarregando(false);
    }
    carregar();
  }, []);

  const usinasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usinas;
    return usinas.filter((u) => u.nome_monitoramento.toLowerCase().includes(termo));
  }, [usinas, busca]);

  return (
    <div className="min-h-screen bg-fundo">
      <Cabecalho />
      <main className="mx-auto max-w-[1120px] space-y-3.5 px-6 py-5">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-tinta">usinas</h1>
          <input
            type="search"
            placeholder="buscar por nome de monitoramento"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="campo w-72"
          />
        </div>

        {erro && (
          <p className="rounded-controle border-fina border-vermelho-borda bg-vermelho-bg px-3 py-2 text-xs text-vermelho">
            {erro}
          </p>
        )}

        {carregando ? (
          <p className="text-xs text-legenda">carregando...</p>
        ) : (
          <div className="cartao overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-hover-fundo text-legenda">
                <tr>
                  <th className="px-4 py-2 text-[11px] font-medium">nome de monitoramento</th>
                  <th className="px-4 py-2 text-[11px] font-medium">cliente</th>
                  <th className="px-4 py-2 text-[11px] font-medium">cidade</th>
                  <th className="px-4 py-2 text-[11px] font-medium">potência (kwp)</th>
                  <th className="px-4 py-2 text-[11px] font-medium">cobertura</th>
                  <th className="px-4 py-2 text-[11px] font-medium">situação</th>
                </tr>
              </thead>
              <tbody>
                {usinasFiltradas.map((u) => (
                  <tr key={u.id} className="border-t-fina border-borda-fraca hover:bg-hover-fundo">
                    <td className="px-4 py-2">
                      <Link to={`/usinas/${u.id}`} className="font-medium text-teal">
                        {u.nome_monitoramento}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-tinta-suave">{u.cliente?.nome ?? "—"}</td>
                    <td className="px-4 py-2 text-tinta-suave">{u.cidade ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-tinta-suave">{u.potencia_kwp ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${corCobertura[u.cobertura_monitoramento_atual]}`}
                      >
                        {rotuloCobertura[u.cobertura_monitoramento_atual]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-tinta-suave">{u.ativa ? "ativa" : "inativa"}</td>
                  </tr>
                ))}
                {usinasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-legenda">
                      nenhuma usina encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
