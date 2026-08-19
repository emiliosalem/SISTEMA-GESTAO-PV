import { Link, useLocation } from "react-router-dom";
import { useAutenticacao } from "../lib/auth";

const rotuloPerfil: Record<string, string> = {
  atendente: "atendente",
  tecnico: "técnico",
};

const itensNavegacao = [
  { rota: "/", rotulo: "início" },
  { rota: "/chamados", rotulo: "fila de chamados" },
  { rota: "/usinas", rotulo: "usinas" },
  { rota: "/cobertura", rotulo: "cobertura" },
  { rota: "/faturas", rotulo: "ingestão de fatura" },
  { rota: "/diagnostico", rotulo: "mesa de diagnóstico" },
  { rota: "/importacao", rotulo: "importação" },
];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toLowerCase();
}

export function Cabecalho() {
  const { usuario, sair } = useAutenticacao();
  const localizacao = useLocation();

  return (
    <div>
      <header className="flex h-[60px] items-center gap-4 bg-teal-escuro px-6 text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)]">
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold uppercase tracking-[0.14em]">cabugi solar</span>
          <span className="text-[11px] tracking-[0.06em] text-white/70">gestão de pós venda</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-xs text-white/80">
          <span>natal, rn</span>
          <span className="h-[22px] w-px bg-white/20" />
          {usuario && (
            <span className="flex items-center gap-2">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/15 text-[10px] font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]">
                {iniciais(usuario.nome)}
              </span>
              <span className="text-white">
                {usuario.nome} · {rotuloPerfil[usuario.perfil] ?? usuario.perfil}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={() => sair()}
            className="rounded-controle border border-white/25 px-3 py-1 text-white/90 hover:bg-white/10"
          >
            sair
          </button>
        </div>
      </header>

      <nav className="flex gap-0.5 overflow-x-auto border-b-fina border-borda bg-white px-6">
        {itensNavegacao.map((item) => {
          const ativa = localizacao.pathname === item.rota;
          return (
            <Link
              key={item.rota}
              to={item.rota}
              className={`whitespace-nowrap border-b-2 px-3.5 pb-[11px] pt-3.5 text-xs tracking-wide no-underline transition-colors ${
                ativa
                  ? "border-teal-escuro font-semibold text-teal-escuro"
                  : "border-transparent font-normal text-legenda hover:text-tinta-suave"
              }`}
            >
              {item.rotulo}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
