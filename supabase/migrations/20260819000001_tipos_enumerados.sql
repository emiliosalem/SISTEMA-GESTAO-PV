-- tipos enumerados usados nas tabelas do sistema
-- criados antes das tabelas porque postgres exige o tipo existir primeiro

create type perfil_usuario as enum ('atendente', 'tecnico');

create type fabricante_dispositivo as enum (
  'hoymiles', 'apsystems', 'growatt', 'sungrow', 'solis', 'huawei'
);

create type tipo_dispositivo as enum ('microinversor', 'string_mppt');

create type tipo_unidade_consumidora as enum ('geradora', 'beneficiaria');

create type fonte_leitura_geracao as enum ('api_fabricante', 'solarz', 'manual');

create type granularidade_leitura as enum ('dispositivo', 'usina');

create type estado_dispositivo as enum (
  'normal', 'abaixo_dos_pares', 'parado', 'sem_comunicacao'
);

create type origem_fatura as enum ('pdf', 'foto', 'agencia_virtual', 'digitado');

create type status_fatura as enum (
  'extraida', 'em_conferencia', 'conferida', 'rejeitada'
);

create type tipo_chamado as enum (
  'duvida_fatura', 'conta_alta', 'sistema_parado',
  'credito_nao_apareceu', 'alteracao_rateio', 'garantia'
);

create type origem_chamado as enum ('cliente', 'sistema');

create type nivel_confianca as enum ('alta', 'media', 'baixa');

create type status_resposta_cliente as enum ('rascunho', 'aprovada', 'enviada');

create type cobertura_monitoramento as enum ('completa', 'parcial', 'sem_monitoramento');
