-- fatura: documento em si e os campos extraídos com grau de confiança

create table fatura (
  id uuid primary key default gen_random_uuid(),
  unidade_consumidora_id uuid not null references unidade_consumidora (id) on delete restrict,
  periodo_inicio date,
  periodo_fim date,
  consumo_kwh numeric(12, 3),
  injetada_kwh numeric(12, 3),
  creditos_usados_kwh numeric(12, 3),
  saldo_creditos_kwh numeric(12, 3),
  percentual_rateio_aplicado numeric(5, 2),
  bandeira text,
  contribuicao_iluminacao_publica numeric(12, 2),
  custo_disponibilidade numeric(12, 2),
  valor_total numeric(12, 2),
  origem origem_fatura not null,
  status status_fatura not null default 'extraida',
  arquivo_url text,
  criada_em timestamptz not null default now(),
  check (periodo_fim is null or periodo_inicio is null or periodo_fim >= periodo_inicio)
);

comment on table fatura is
  'nenhuma fatura com status diferente de conferida pode alimentar o motor de diagnóstico; regra dura, aplicada na camada de aplicação e reforçada pelo motor';

create index idx_fatura_unidade_consumidora_id on fatura (unidade_consumidora_id);
create index idx_fatura_status on fatura (status);
create index idx_fatura_periodo on fatura (unidade_consumidora_id, periodo_inicio, periodo_fim);

create table fatura_campo_extraido (
  id uuid primary key default gen_random_uuid(),
  fatura_id uuid not null references fatura (id) on delete cascade,
  campo text not null,
  valor_lido text,
  confianca numeric(3, 2) check (confianca is null or confianca between 0 and 1),
  valor_confirmado text,
  confirmado_por uuid references usuario_perfil (id) on delete set null,
  confirmado_em timestamptz
);

comment on table fatura_campo_extraido is
  'campo com confiança baixa fica destacado e editável na tela de conferência, exigindo confirmação humana antes da fatura liberar para diagnóstico';

create index idx_fatura_campo_extraido_fatura_id on fatura_campo_extraido (fatura_id);
