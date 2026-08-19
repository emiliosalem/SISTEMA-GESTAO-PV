import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { UsuarioPerfil } from "./tipos";

interface ContextoAutenticacao {
  sessao: Session | null;
  usuario: UsuarioPerfil | null;
  carregando: boolean;
  erroAcesso: string | null;
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
}

const ContextoAutenticacao = createContext<ContextoAutenticacao | undefined>(
  undefined
);

async function buscarPerfil(usuarioId: string): Promise<{
  perfil: UsuarioPerfil | null;
  erro: string | null;
}> {
  const { data, error } = await supabase
    .from("usuario_perfil")
    .select("id, nome, perfil, ativo")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error) {
    return { perfil: null, erro: "não foi possível carregar seu perfil, tente novamente" };
  }
  if (!data) {
    return {
      perfil: null,
      erro: "sua conta ainda não tem um perfil de acesso, procure o administrador",
    };
  }
  if (!data.ativo) {
    return { perfil: null, erro: "sua conta está desativada, procure o administrador" };
  }
  return { perfil: data as UsuarioPerfil, erro: null };
}

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<UsuarioPerfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregarSessaoInicial() {
      const { data } = await supabase.auth.getSession();
      if (!ativo) return;
      setSessao(data.session);
      if (data.session) {
        const { perfil, erro } = await buscarPerfil(data.session.user.id);
        if (!ativo) return;
        if (erro) {
          setErroAcesso(erro);
          await supabase.auth.signOut();
          setSessao(null);
        }
        setUsuario(perfil);
      }
      setCarregando(false);
    }

    carregarSessaoInicial();

    const { data: assinatura } = supabase.auth.onAuthStateChange(
      async (_evento, novaSessao) => {
        if (!ativo) return;
        setSessao(novaSessao);
        if (novaSessao) {
          const { perfil, erro } = await buscarPerfil(novaSessao.user.id);
          if (!ativo) return;
          if (erro) {
            setErroAcesso(erro);
            await supabase.auth.signOut();
            setSessao(null);
          }
          setUsuario(perfil);
        } else {
          setUsuario(null);
        }
      }
    );

    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  async function entrar(email: string, senha: string) {
    setErroAcesso(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      return "e-mail ou senha incorretos";
    }
    return null;
  }

  async function sair() {
    await supabase.auth.signOut();
    setUsuario(null);
    setSessao(null);
  }

  return (
    <ContextoAutenticacao.Provider
      value={{ sessao, usuario, carregando, erroAcesso, entrar, sair }}
    >
      {children}
    </ContextoAutenticacao.Provider>
  );
}

export function useAutenticacao() {
  const contexto = useContext(ContextoAutenticacao);
  if (!contexto) {
    throw new Error("useAutenticacao precisa estar dentro de ProvedorAutenticacao");
  }
  return contexto;
}
