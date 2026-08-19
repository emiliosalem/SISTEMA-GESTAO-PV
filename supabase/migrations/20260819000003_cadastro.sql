-- cadastro: cliente, usina, dispositivo, unidade consumidora e rateio

create table cliente (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text not null,
  telefone text,
  email text,
  criado_em timestamptz not null default now()
);

create table usina (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente (id) on delete restrict,
  nome_monitoramento text not null,
  endereco text,
  cidade text,
  potencia_kwp numeric(10, 3),
  quantidade_modulos integer,
  data_conexao date,
  autoconsumo_estimado_pct numeric(5, 2)
    check (autoconsumo_estimado_pct is null or autoconsumo_estimado_pct between 0 and 100),
  ativa boolean not null default true,

  -- fonte de dados de geração resolvida para esta usina (ver seção 4 do pedido:
  -- cadeia fabricante -> solarz -> manual). nula até o coletor rodar pela primeira
  -- vez ou até alguém escolher manualmente na ficha da usina.
  fonte_dados_geracao fonte_leitura_geracao,

  -- nível de cobertura de monitoramento resultante da fonte acima. calculado pelo
  -- coletor e cacheado aqui para não recalcular em toda tela; completa = leitura
  -- por dispositivo, parcial = só total da usina, sem_monitoramento = manual ou nada.
  cobertura_monitoramento_atual cobertura_monitoramento not null default 'sem_monitoramento',

  criado_em timestamptz not null default now()
);

comment on column usina.nome_monitoramento is
  'nome exato como aparece na plataforma do fabricante; chave de busca do time no dia a dia';
comment on column usina.autoconsumo_estimado_pct is
  'fração da geração consumida no próprio local, nunca injetada na rede; sem isso o motor de diagnóstico gera alarme falso ao comparar inversor com medidor';

create index idx_usina_cliente_id on usina (cliente_id);

-- geração esperada mês a mês por usina, usada pelo motor de diagnóstico e
-- exibida na ficha da usina (seção 7, bloco de parâmetros de diagnóstico)
create table geracao_esperada_mensal (
  id uuid primary key default gen_random_uuid(),
  usina_id uuid not null references usina (id) on delete cascade,
  mes smallint not null check (mes between 1 and 12),
  energia_esperada_kwh numeric(12, 3) not null,
  unique (usina_id, mes)
);

create table dispositivo (
  id uuid primary key default gen_random_uuid(),
  usina_id uuid not null references usina (id) on delete restrict,
  fabricante fabricante_dispositivo not null,
  tipo tipo_dispositivo not null,
  identificador_fabricante text not null,
  numero_serie text,
  potencia_w numeric(10, 2),
  ativo boolean not null default true
);

comment on table dispositivo is
  'granularidade obrigatória: microinversor individual, ou entrada mppt no caso de inversor de string; nunca guardar apenas o total da usina';

create index idx_dispositivo_usina_id on dispositivo (usina_id);

create table unidade_consumidora (
  id uuid primary key default gen_random_uuid(),
  numero_uc text not null unique,
  cliente_id uuid not null references cliente (id) on delete restrict,
  usina_id uuid references usina (id) on delete restrict,
  tipo tipo_unidade_consumidora not null,
  grupo_tarifario text,
  modalidade_compensacao text,
  endereco text
);

create index idx_unidade_consumidora_cliente_id on unidade_consumidora (cliente_id);
create index idx_unidade_consumidora_usina_id on unidade_consumidora (usina_id);

create table rateio (
  id uuid primary key default gen_random_uuid(),
  unidade_consumidora_id uuid not null references unidade_consumidora (id) on delete restrict,
  usina_id uuid not null references usina (id) on delete restrict,
  percentual numeric(5, 2) not null check (percentual between 0 and 100),
  vigencia_inicio date not null,
  vigencia_fim date,
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

comment on table rateio is
  'histórico, não campo único; percentual muda ao longo do tempo e o diagnóstico de fatura antiga precisa usar o percentual vigente naquele período. a soma dos percentuais vigentes de uma mesma usina numa mesma data deve fechar 100%; se não fechar, a aplicação sinaliza, não bloqueia';

create index idx_rateio_usina_vigencia on rateio (usina_id, vigencia_inicio, vigencia_fim);
create index idx_rateio_unidade_consumidora_id on rateio (unidade_consumidora_id);
