-- perfil interno de cada usuário autenticado (atendente ou técnico)
-- a linha em auth.users já existe antes desta, criada pelo supabase auth
-- no cadastro de usuário; aqui só amarramos o perfil de negócio a ela

create table usuario_perfil (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  perfil perfil_usuario not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table usuario_perfil is
  'perfil de negócio de cada usuário interno (atendente ou técnico); toda pessoa com acesso ao sistema tem uma linha aqui';

-- função auxiliar usada pelas políticas de RLS em todas as tabelas de negócio:
-- só usuário interno ativo (atendente ou técnico) enxerga e altera dados
create function e_usuario_interno_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuario_perfil
    where id = auth.uid() and ativo = true
  );
$$;

alter table usuario_perfil enable row level security;

create policy "usuario_le_o_proprio_perfil"
  on usuario_perfil for select
  using (id = auth.uid());

create policy "usuario_interno_le_todos_os_perfis"
  on usuario_perfil for select
  using (e_usuario_interno_ativo());
