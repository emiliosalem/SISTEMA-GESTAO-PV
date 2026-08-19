import { Cabecalho } from "../componentes/Cabecalho";
import { SecaoImportacao } from "../componentes/SecaoImportacao";
import { colunasModeloCliente, validarLinhasCliente } from "../lib/importacao/cliente";
import { colunasModeloUsina, validarLinhasUsina } from "../lib/importacao/usina";
import { colunasModeloDispositivo, validarLinhasDispositivo } from "../lib/importacao/dispositivo";
import {
  colunasModeloUnidadeConsumidora,
  validarLinhasUnidadeConsumidora,
} from "../lib/importacao/unidadeConsumidora";
import { colunasModeloRateio, validarLinhasRateio } from "../lib/importacao/rateio";

export function ImportacaoCsv() {
  return (
    <div className="min-h-screen bg-fundo">
      <Cabecalho />
      <main className="mx-auto max-w-[760px] space-y-4 px-6 py-5">
        <div>
          <h1 className="text-base font-semibold text-tinta">importação inicial</h1>
          <p className="mt-1 text-xs text-legenda">
            importe nesta ordem: clientes, usinas, dispositivos, unidades consumidoras e
            rateios. reimportar o mesmo arquivo atualiza os registros existentes em vez de
            duplicar. as 800 usinas podem entrar aos poucos, em quantas importações forem
            necessárias.
          </p>
        </div>

        <SecaoImportacao
          titulo="1. clientes"
          descricao="nome, documento (cpf ou cnpj), telefone e e-mail."
          colunasModelo={colunasModeloCliente}
          nomeArquivoModelo="modelo_clientes.csv"
          validar={validarLinhasCliente}
        />

        <SecaoImportacao
          titulo="2. usinas"
          descricao="referencia o cliente pelo documento. nome_monitoramento precisa ser idêntico ao nome na plataforma do fabricante."
          colunasModelo={colunasModeloUsina}
          nomeArquivoModelo="modelo_usinas.csv"
          validar={validarLinhasUsina}
        />

        <SecaoImportacao
          titulo="3. dispositivos"
          descricao="um microinversor ou uma entrada mppt por linha; referencia a usina pelo nome_monitoramento."
          colunasModelo={colunasModeloDispositivo}
          nomeArquivoModelo="modelo_dispositivos.csv"
          validar={validarLinhasDispositivo}
        />

        <SecaoImportacao
          titulo="4. unidades consumidoras"
          descricao="referencia o cliente pelo documento e, quando for o caso, a usina pelo nome_monitoramento."
          colunasModelo={colunasModeloUnidadeConsumidora}
          nomeArquivoModelo="modelo_unidades_consumidoras.csv"
          validar={validarLinhasUnidadeConsumidora}
        />

        <SecaoImportacao
          titulo="5. rateios"
          descricao="referencia a unidade consumidora pelo numero_uc e a usina pelo nome_monitoramento. percentual de 0 a 100."
          colunasModelo={colunasModeloRateio}
          nomeArquivoModelo="modelo_rateios.csv"
          validar={validarLinhasRateio}
        />
      </main>
    </div>
  );
}
