-- suporte ao coletor (seção 4 do pedido): registro de divergência entre a
-- leitura do fabricante e a do solarz para a mesma usina/dia, e a extensão
-- de agendamento para a rotina diária.

create table divergencia_fonte (
  id uuid primary key default gen_random_uuid(),
  usina_id uuid not null references usina (id) on delete restrict,
  data date not null,
  energia_fabricante_kwh numeric(12, 3) not null,
  energia_solarz_kwh numeric(12, 3) not null,
  diferenca_pct numeric(6, 2) not null,
  sinalizado boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (usina_id, data)
);

comment on table divergencia_fonte is
  'compara a leitura do fabricante com a do solarz quando as duas existem para a mesma usina/dia; alerta interno, nunca visível ao cliente. existe suspeita fundada de falha de sincronia entre as duas plataformas, e esta tabela mede o tamanho do problema em vez de discutir por impressão';

create index idx_divergencia_fonte_usina_id on divergencia_fonte (usina_id);

alter table divergencia_fonte enable row level security;
create policy "usuario_interno_acessa_divergencia_fonte"
  on divergencia_fonte for all
  using (e_usuario_interno_ativo())
  with check (e_usuario_interno_ativo());

-- limiar de divergência entre fontes (não é norma da aneel, é operacional;
-- mesma disciplina da tabela parametro: nasce vazio, ninguém estima no código)
insert into parametro (chave) values ('limite_divergencia_fontes_pct')
on conflict (chave) do nothing;

-- extensões para agendar a rotina de coleta via cron chamando a edge function
-- coletar-geracao (seção 2 do pedido). o agendamento em si (cron.schedule)
-- não entra numa migração porque precisaria embutir a service role key no
-- corpo da chamada http, e isso não deve ir para o controle de versão —
-- finalize o schedule pelo painel do supabase (Database > Cron Jobs) ou por
-- "supabase secrets set" seguido de um script rodado manualmente, nunca
-- commitado com a chave dentro.
create extension if not exists pg_cron;
create extension if not exists pg_net;
