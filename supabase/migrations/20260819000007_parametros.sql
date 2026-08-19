-- parâmetros normativos/operacionais. tabela criada vazia, sem valor no seed
-- e sem valor no código: se um parâmetro estiver sem valor, a função que
-- depende dele retorna estado 'parametro_ausente' e a interface mostra
-- "prazo não configurado, defina em parâmetros" no lugar do número.

create table parametro (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  valor text,
  unidade text,
  fonte_normativa text,
  data_consulta date,
  observacao text
);

comment on table parametro is
  'nunca assumir valor padrão, nunca estimar, nunca escrever número de norma no código; todo prazo e limite regulatório vem desta tabela';

-- chaves criadas sem valor; alguém do time preenche depois de confirmar na fonte
insert into parametro (chave) values
  ('prazo_resposta_reclamacao_faturamento'),
  ('prazo_alteracao_rateio'),
  ('validade_credito_meses'),
  ('escalonamento_fio_b_por_ano'),
  ('sla_interno_duvida_fatura'),
  ('sla_interno_sistema_parado'),
  ('limite_divergencia_medidor_pct');
