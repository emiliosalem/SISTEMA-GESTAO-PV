import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAutenticacao } from "../lib/auth";

export function RotaProtegida({ children }: { children: ReactNode }) {
  const { sessao, usuario, carregando } = useAutenticacao();

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundo text-xs text-legenda">
        carregando...
      </div>
    );
  }

  if (!sessao || !usuario) {
    return <Navigate to="/entrar" replace />;
  }

  return <>{children}</>;
}
