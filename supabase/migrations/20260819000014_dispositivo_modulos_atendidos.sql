-- quantos módulos cada dispositivo atende (ex: um microinversor de 4
-- entradas atende 4 módulos). é essa referência que permite ao time olhar o
-- layout de painéis do fabricante e bater com o que o sistema espera; sem
-- ela, um micro parado só aparece como "geração um pouco mais baixa" no
-- total da usina, em vez de "estes N módulos específicos zerados". não
-- entrou na migração original porque só ficou claro depois de discutir um
-- caso real: um micro de 6 parado desde março, só percebido meses depois
-- porque ninguém tinha o mapeamento de qual micro atende quais módulos.
alter table dispositivo
  add column quantidade_modulos_atendidos smallint;

comment on column dispositivo.quantidade_modulos_atendidos is
  'quantos módulos este dispositivo atende; referência para bater com o layout de painéis do fabricante ao investigar um dispositivo parado';
