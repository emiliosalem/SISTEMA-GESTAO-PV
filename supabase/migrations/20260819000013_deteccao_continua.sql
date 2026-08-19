-- suporte à detecção contínua (seção 5 do pedido): limiares configuráveis
-- da comparação entre pares, e uma view para achar rápido a última leitura
-- de cada usina (usada pela tela de cobertura de monitoramento para calcular
-- dias de silêncio, e pela fila de recomposição).

insert into parametro (chave) values
  ('limiar_abaixo_dos_pares_pct'),
  ('limiar_parado_pct')
on conflict (chave) do nothing;

comment on table parametro is
  'nunca assumir valor padrão, nunca estimar, nunca escrever número de norma no código; todo prazo, limite regulatório e limiar operacional configurável vem desta tabela';

-- security_invoker garante que a rls de leitura_geracao continua valendo
-- para quem consulta a view, em vez de rodar com o dono da view
create view vw_ultima_leitura_usina
with (security_invoker = true)
as
select usina_id, max(data) as ultima_leitura_data
from leitura_geracao
group by usina_id;

grant select on vw_ultima_leitura_usina to authenticated;
