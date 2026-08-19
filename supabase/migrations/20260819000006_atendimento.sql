-- atendimento: chamado, diagnóstico, alerta e resposta ao cliente

create table chamado (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente (id) on delete restrict,
  unidade_consumidora_id uuid references unidade_consumidora (id) on delete restrict,
  usina_id uuid references usina (id) on delete restrict,
  tipo tipo_chamado not null,
  origem origem_chamado not null default 'cliente',
  responsavel_id uuid references usuario_perfil (id) on delete set null,
  status text not null default 'aberto',
  prazo_sla timestamptz,
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz
);

comment on column chamado.origem is
  'cliente = aberto por reclamação; sistema = aberto pela detecção contínua (dispositivo parado, sem comunicação etc), recebe marcação visual distinta na fila';

create index idx_chamado_status on chamado (status);
create index idx_chamado_prazo_sla on chamado (prazo_sla);
create index idx_chamado_cliente_id on chamado (cliente_id);
create index idx_chamado_usina_id on chamado (usina_id);
create index idx_chamado_responsavel_id on chamado (responsavel_id);

create table diagnostico (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references chamado (id) on delete cascade,
  fatura_id uuid references fatura (id) on delete restrict,
  gerado_em timestamptz not null default now(),
  geracao_periodo_kwh numeric(12, 3),
  geracao_esperada_kwh numeric(12, 3),
  injecao_esperada_kwh numeric(12, 3),
  diferenca_medidor_kwh numeric(12, 3),
  dias_sem_dado integer not null default 0
);

comment on table diagnostico is
  'gerado quando uma fatura conferida é vinculada a um chamado; recorta a geração pelo período exato de leitura da fatura, nunca por mês calendário';

create index idx_diagnostico_chamado_id on diagnostico (chamado_id);
create index idx_diagnostico_fatura_id on diagnostico (fatura_id);

create table alerta (
  id uuid primary key default gen_random_uuid(),
  diagnostico_id uuid not null references diagnostico (id) on delete cascade,
  causa text not null,
  confianca nivel_confianca not null,
  impacto_estimado_reais numeric(12, 2),
  titulo text not null,
  descricao text
);

comment on table alerta is
  'exibidos ordenados por impacto financeiro estimado, não por gravidade técnica';

create index idx_alerta_diagnostico_id on alerta (diagnostico_id);

create table resposta_cliente (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references chamado (id) on delete cascade,
  texto text not null,
  status status_resposta_cliente not null default 'rascunho',
  aprovada_por uuid references usuario_perfil (id) on delete set null,
  enviada_em timestamptz
);

comment on table resposta_cliente is
  'nenhuma resposta sai sem aprovação humana; status só vai para enviada depois de aprovada';

create index idx_resposta_cliente_chamado_id on resposta_cliente (chamado_id);
