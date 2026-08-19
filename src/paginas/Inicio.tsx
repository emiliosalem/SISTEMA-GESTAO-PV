import { Link } from "react-router-dom";
import { Cabecalho } from "../componentes/Cabecalho";
import { useAutenticacao } from "../lib/auth";

const ATALHOS = [
  { rota: "/chamados", titulo: "fila de chamados", descricao: "métricas, filtros e sla mais apertado primeiro" },
  { rota: "/faturas", titulo: "ingestão de fatura", descricao: "pdf, foto, agência virtual ou digitação manual" },
  { rota: "/diagnostico", titulo: "mesa de diagnóstico", descricao: "fatura conferida x geração medida, alertas por impacto" },
  { rota: "/usinas", titulo: "usinas", descricao: "ficha, equipamentos, rateio e parâmetros de diagnóstico" },
  { rota: "/cobertura", titulo: "cobertura de monitoramento", descricao: "sem comunicação, paradas e fila de recomposição" },
  { rota: "/importacao", titulo: "importação por csv", descricao: "cliente, usina, dispositivo, uc e rateio, aos poucos" },
];

export function Inicio() {
  const { usuario } = useAutenticacao();

  return (
    <div className="min-h-screen bg-fundo">
      <Cabecalho />
      <main className="mx-auto max-w-[1120px] space-y-5 px-6 py-6">
        <div>
          <h1 className="text-lg font-semibold text-tinta">olá, {usuario?.nome}</h1>
          <p className="mt-1 text-xs text-legenda">pós venda cabugi solar, natal · rn</p>
        </div>

        <div className="grid grid-cols-3 gap-3.5">
          {ATALHOS.map((a) => (
            <Link key={a.rota} to={a.rota} className="cartao block p-4 hover:border-info-borda">
              <span className="text-[13px] font-semibold text-tinta">{a.titulo}</span>
              <p className="mt-1 text-xs text-legenda">{a.descricao}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
