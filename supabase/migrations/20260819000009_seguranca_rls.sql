-- row level security: sistema interno, sem acesso de cliente final.
-- toda tabela de negócio exige usuário interno ativo (atendente ou técnico)
-- autenticado; e_usuario_interno_ativo() foi criada na migração de autenticação.

alter table cliente enable row level security;
alter table usina enable row level security;
alter table geracao_esperada_mensal enable row level security;
alter table dispositivo enable row level security;
alter table unidade_consumidora enable row level security;
alter table rateio enable row level security;
alter table leitura_geracao enable row level security;
alter table evento_dispositivo enable row level security;
alter table fatura enable row level security;
alter table fatura_campo_extraido enable row level security;
alter table chamado enable row level security;
alter table diagnostico enable row level security;
alter table alerta enable row level security;
alter table resposta_cliente enable row level security;
alter table parametro enable row level security;
alter table garantia enable row level security;
alter table acionamento_rma enable row level security;
alter table reclamacao_concessionaria enable row level security;
alter table reembolso enable row level security;

do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'cliente', 'usina', 'geracao_esperada_mensal', 'dispositivo',
    'unidade_consumidora', 'rateio', 'leitura_geracao', 'evento_dispositivo',
    'fatura', 'fatura_campo_extraido', 'chamado', 'diagnostico', 'alerta',
    'resposta_cliente', 'parametro', 'garantia', 'acionamento_rma',
    'reclamacao_concessionaria', 'reembolso'
  ]
  loop
    execute format(
      'create policy "usuario_interno_acessa_%1$s" on %1$s for all using (e_usuario_interno_ativo()) with check (e_usuario_interno_ativo());',
      tabela
    );
  end loop;
end $$;
