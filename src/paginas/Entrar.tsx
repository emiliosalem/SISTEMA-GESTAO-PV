import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAutenticacao } from "../lib/auth";

export function Entrar() {
  const { sessao, usuario, carregando, erroAcesso, entrar } = useAutenticacao();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!carregando && sessao && usuario) {
    return <Navigate to="/" replace />;
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErroFormulario(null);
    const erro = await entrar(email, senha);
    setEnviando(false);
    if (erro) {
      setErroFormulario(erro);
    }
  }

  const erroExibido = erroFormulario ?? erroAcesso;

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo px-4">
      <div className="cartao w-full max-w-sm overflow-hidden">
        <div className="bg-teal-escuro px-8 pb-7 pt-8 text-white">
          <span className="text-[17px] font-semibold uppercase tracking-[0.14em]">cabugi solar</span>
          <p className="mt-1 text-xs tracking-[0.06em] text-white/70">gestão de pós venda, acesso interno</p>
        </div>

        <form onSubmit={aoSubmeter} className="space-y-4 px-8 pb-8 pt-7">
          <div>
            <label htmlFor="email" className="block text-xs text-legenda">
              e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="campo mt-1"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-xs text-legenda">
              senha
            </label>
            <input
              id="senha"
              type="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="campo mt-1"
            />
          </div>

          {erroExibido && (
            <p className="rounded-controle border-fina border-vermelho-borda bg-vermelho-bg px-3 py-2 text-xs text-vermelho">
              {erroExibido}
            </p>
          )}

          <button type="submit" disabled={enviando} className="botao-primario w-full">
            {enviando ? "entrando..." : "entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
