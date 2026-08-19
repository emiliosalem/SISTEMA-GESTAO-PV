// movido para src/lib/chamados/chamado.ts no passo 7, que também cobre a
// fila de chamados; reexportado aqui para não quebrar quem já importava
// deste caminho.
export {
  TIPOS_CHAMADO_DIAGNOSTICO,
  type TipoChamadoDiagnostico,
  rotuloTipoChamado,
  abrirChamadoParaDiagnostico,
} from "../chamados/chamado";
