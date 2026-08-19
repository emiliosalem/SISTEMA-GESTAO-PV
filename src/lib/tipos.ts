export type Perfil = "atendente" | "tecnico";

export interface UsuarioPerfil {
  id: string;
  nome: string;
  perfil: Perfil;
  ativo: boolean;
}
