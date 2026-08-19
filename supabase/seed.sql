-- dados de exemplo para ambiente de desenvolvimento local.
-- nunca usar em produção. roda automaticamente com "supabase db reset".
-- usuários (atendente/técnico) não entram aqui: são criados via autenticação,
-- que é o passo 2 da ordem de construção.

insert into cliente (id, nome, documento, telefone, email) values
  ('11111111-1111-1111-1111-111111111111', 'cliente exemplo dev ltda', '00.000.000/0001-00', '(84) 99999-0000', 'contato@exemplo-dev.com.br');

insert into usina (id, cliente_id, nome_monitoramento, endereco, cidade, potencia_kwp, quantidade_modulos, data_conexao, autoconsumo_estimado_pct, cobertura_monitoramento_atual) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'USINA-DEV-001', 'rua exemplo, 100', 'natal', 10.5, 24, '2024-03-01', 8.0, 'completa');

insert into geracao_esperada_mensal (usina_id, mes, energia_esperada_kwh) values
  ('22222222-2222-2222-2222-222222222222', 1, 1450.0),
  ('22222222-2222-2222-2222-222222222222', 2, 1380.0),
  ('22222222-2222-2222-2222-222222222222', 3, 1420.0);

insert into dispositivo (id, usina_id, fabricante, tipo, identificador_fabricante, numero_serie, potencia_w) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'hoymiles', 'microinversor', 'HM-DEV-01', 'SN-DEV-01', 350),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'hoymiles', 'microinversor', 'HM-DEV-02', 'SN-DEV-02', 350);

insert into unidade_consumidora (id, numero_uc, cliente_id, usina_id, tipo, grupo_tarifario, modalidade_compensacao) values
  ('55555555-5555-5555-5555-555555555555', 'UC-DEV-0001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'geradora', 'b1', 'autoconsumo_remoto');

insert into rateio (unidade_consumidora_id, usina_id, percentual, vigencia_inicio) values
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 100.0, '2024-03-01');
