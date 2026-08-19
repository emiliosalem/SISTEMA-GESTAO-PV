-- restrições adicionais para permitir importação por csv idempotente e
-- incremental (seção 8 do pedido): reimportar o mesmo arquivo atualiza em
-- vez de duplicar, usando a chave natural que o time já usa no dia a dia.

alter table cliente
  add constraint cliente_documento_unico unique (documento);

alter table usina
  add constraint usina_nome_monitoramento_unico unique (nome_monitoramento);

comment on constraint usina_nome_monitoramento_unico on usina is
  'nome_monitoramento é a chave de busca do time (seção 3); precisa ser único para servir de chave de upsert na importação';

alter table dispositivo
  add constraint dispositivo_usina_identificador_unico unique (usina_id, identificador_fabricante);

alter table rateio
  add constraint rateio_uc_vigencia_inicio_unico unique (unidade_consumidora_id, vigencia_inicio);
