import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { baixarModeloCsv, lerArquivoCsv } from "../lib/importacao/csv";
import { gravarLinhasValidas } from "../lib/importacao/motor";
import type { LinhaCsv, LinhaValidada } from "../lib/importacao/tipos";

interface Props {
  titulo: string;
  descricao: string;
  colunasModelo: string[];
  nomeArquivoModelo: string;
  validar: (linhas: LinhaCsv[]) => Promise<LinhaValidada[]>;
}

type Etapa = "ocioso" | "validando" | "validado" | "gravando" | "concluido";

const rotuloStatus: Record<LinhaValidada["status"], string> = {
  valida: "pronta para gravar",
  erro: "erro",
  gravada: "gravada",
  falhou_ao_gravar: "falhou ao gravar",
};

const corStatus: Record<LinhaValidada["status"], string> = {
  valida: "text-ambar",
  erro: "text-vermelho",
  gravada: "text-verde",
  falhou_ao_gravar: "text-vermelho",
};

export function SecaoImportacao({ titulo, descricao, colunasModelo, nomeArquivoModelo, validar }: Props) {
  const [etapa, setEtapa] = useState<Etapa>("ocioso");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaValidada[]>([]);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const entradaArquivoRef = useRef<HTMLInputElement>(null);

  const contagem = useMemo(() => {
    const validas = linhas.filter((l) => l.status === "valida" || l.status === "gravada").length;
    const comErro = linhas.filter((l) => l.status === "erro" || l.status === "falhou_ao_gravar").length;
    return { validas, comErro, total: linhas.length };
  }, [linhas]);

  async function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setNomeArquivo(arquivo.name);
    setErroLeitura(null);
    setEtapa("validando");
    try {
      const linhasCsv = await lerArquivoCsv(arquivo);
      const resultado = await validar(linhasCsv);
      setLinhas(resultado);
      setEtapa("validado");
    } catch (erro) {
      setErroLeitura(erro instanceof Error ? erro.message : "não foi possível ler o arquivo");
      setEtapa("ocioso");
    }
  }

  async function aoGravar() {
    setEtapa("gravando");
    const atualizadas = await gravarLinhasValidas([...linhas], (feitos, total) =>
      setProgresso({ feitos, total })
    );
    setLinhas(atualizadas);
    setProgresso(null);
    setEtapa("concluido");
  }

  function reiniciar() {
    setEtapa("ocioso");
    setLinhas([]);
    setNomeArquivo(null);
    setErroLeitura(null);
    if (entradaArquivoRef.current) entradaArquivoRef.current.value = "";
  }

  return (
    <section className="cartao p-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold text-tinta">{titulo}</h2>
          <p className="mt-1 text-xs text-legenda">{descricao}</p>
        </div>
        <button type="button" onClick={() => baixarModeloCsv(nomeArquivoModelo, colunasModelo)} className="botao-secundario shrink-0">
          baixar modelo
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          ref={entradaArquivoRef}
          type="file"
          accept=".csv"
          onChange={aoSelecionarArquivo}
          disabled={etapa === "validando" || etapa === "gravando"}
          className="text-xs text-tinta-suave file:mr-3 file:rounded-controle file:border-fina file:border-borda-forte file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-tinta-suave"
        />
        {nomeArquivo && <span className="text-xs text-legenda">{nomeArquivo}</span>}
      </div>

      {erroLeitura && (
        <p className="mt-3 rounded-controle border-fina border-vermelho-borda bg-vermelho-bg px-3 py-2 text-xs text-vermelho">
          {erroLeitura}
        </p>
      )}

      {etapa === "validando" && <p className="mt-3 text-xs text-legenda">validando arquivo...</p>}

      {(etapa === "validado" || etapa === "gravando" || etapa === "concluido") && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-legenda">{contagem.total} linhas lidas</span>
            <span className="text-verde">{contagem.validas} válidas</span>
            {contagem.comErro > 0 && <span className="text-vermelho">{contagem.comErro} com erro</span>}
            {etapa === "gravando" && progresso && (
              <span className="text-legenda">
                gravando {progresso.feitos} de {progresso.total}...
              </span>
            )}
          </div>

          <div className="mt-3 max-h-72 overflow-y-auto rounded-controle border-fina border-borda">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-hover-fundo text-legenda">
                <tr>
                  <th className="px-3 py-2 text-[11px] font-medium">linha</th>
                  <th className="px-3 py-2 text-[11px] font-medium">situação</th>
                  <th className="px-3 py-2 text-[11px] font-medium">mensagem</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.linha} className="border-t-fina border-borda-fraca">
                    <td className="px-3 py-1.5 font-mono text-xs text-tinta-suave">{l.linha}</td>
                    <td className={`px-3 py-1.5 text-xs font-medium ${corStatus[l.status]}`}>
                      {rotuloStatus[l.status]}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-legenda">{l.mensagem ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-3">
            {etapa === "validado" && contagem.validas > 0 && (
              <button type="button" onClick={aoGravar} className="botao-primario">
                gravar {contagem.validas} linhas válidas
              </button>
            )}
            {etapa === "concluido" && (
              <button type="button" onClick={reiniciar} className="botao-secundario">
                importar outro arquivo
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
