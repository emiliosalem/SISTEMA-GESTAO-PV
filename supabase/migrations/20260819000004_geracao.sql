-- geração: leituras diárias e histórico de estado de cada dispositivo

create table leitura_geracao (
  id uuid primary key default gen_random_uuid(),
  usina_id uuid not null references usina (id) on delete restrict,
  dispositivo_id uuid references dispositivo (id) on delete restrict,
  data date not null,
  energia_kwh numeric(12, 3) not null,
  fonte fonte_leitura_geracao not null,
  granularidade granularidade_leitura not null,
  coletado_em timestamptz not null default now()
);

comment on column leitura_geracao.dispositivo_id is
  'nulo quando a leitura é agregada (a fonte só entrega o total da usina); nesse caso granularidade = usina e o sistema não roda comparação entre pares nesta usina. nunca inventar rateio da geração agregada entre os dispositivos para preencher a lacuna';

-- unicidade por dispositivo quando a leitura é por dispositivo
create unique index idx_leitura_geracao_unica_dispositivo
  on leitura_geracao (usina_id, dispositivo_id, data)
  where dispositivo_id is not null;

-- unicidade por usina quando a leitura é agregada (dispositivo_id nulo);
-- constraint normal não bastaria porque null não é considerado igual a null
create unique index idx_leitura_geracao_unica_usina
  on leitura_geracao (usina_id, data)
  where dispositivo_id is null;

create index idx_leitura_geracao_usina_data on leitura_geracao (usina_id, data);
create index idx_leitura_geracao_dispositivo_data on leitura_geracao (dispositivo_id, data);

create table evento_dispositivo (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references dispositivo (id) on delete restrict,
  estado estado_dispositivo not null,
  inicio timestamptz not null,
  fim timestamptz,
  energia_perdida_estimada_kwh numeric(12, 3),
  check (fim is null or fim >= inicio)
);

comment on table evento_dispositivo is
  'cada mudança de estado fecha o evento anterior e abre um novo; responde há quanto tempo um dispositivo está parado e alimenta reembolso e garantia. sem esta tabela o sistema só saberia o estado presente';

-- no máximo um evento aberto (fim nulo) por dispositivo
create unique index idx_evento_dispositivo_aberto_unico
  on evento_dispositivo (dispositivo_id)
  where fim is null;

create index idx_evento_dispositivo_dispositivo_id on evento_dispositivo (dispositivo_id);
