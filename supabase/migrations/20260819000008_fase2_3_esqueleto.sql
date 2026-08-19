-- esqueleto das fases 2 e 3: apenas o esquema, sem tela nesta fase

create table garantia (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references dispositivo (id) on delete restrict,
  numero_serie text,
  data_inicio date,
  data_fim date,
  condicoes text,
  criado_em timestamptz not null default now()
);

create index idx_garantia_dispositivo_id on garantia (dispositivo_id);

create table acionamento_rma (
  id uuid primary key default gen_random_uuid(),
  garantia_id uuid references garantia (id) on delete restrict,
  dispositivo_id uuid not null references dispositivo (id) on delete restrict,
  protocolo_fabricante text,
  status text not null default 'aberto',
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz
);

create index idx_acionamento_rma_dispositivo_id on acionamento_rma (dispositivo_id);
create index idx_acionamento_rma_garantia_id on acionamento_rma (garantia_id);

create table reclamacao_concessionaria (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid references chamado (id) on delete restrict,
  unidade_consumidora_id uuid not null references unidade_consumidora (id) on delete restrict,
  protocolo text,
  status text not null default 'aberta',
  aberta_em timestamptz not null default now(),
  fechada_em timestamptz
);

create index idx_reclamacao_concessionaria_uc_id on reclamacao_concessionaria (unidade_consumidora_id);
create index idx_reclamacao_concessionaria_chamado_id on reclamacao_concessionaria (chamado_id);

create table reembolso (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid references chamado (id) on delete restrict,
  cliente_id uuid not null references cliente (id) on delete restrict,
  valor_reais numeric(12, 2),
  motivo text,
  status text not null default 'solicitado',
  solicitado_em timestamptz not null default now(),
  pago_em timestamptz
);

create index idx_reembolso_cliente_id on reembolso (cliente_id);
create index idx_reembolso_chamado_id on reembolso (chamado_id);
