import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProvedorAutenticacao } from "./lib/auth";
import { RotaProtegida } from "./componentes/RotaProtegida";
import { Entrar } from "./paginas/Entrar";
import { Inicio } from "./paginas/Inicio";
import { ImportacaoCsv } from "./paginas/ImportacaoCsv";
import { Usinas } from "./paginas/Usinas";
import { FichaUsina } from "./paginas/FichaUsina";
import { IngestaoFatura } from "./paginas/IngestaoFatura";
import { EntradaManualLeitura } from "./paginas/EntradaManualLeitura";
import { MesaDiagnostico } from "./paginas/MesaDiagnostico";
import { FilaChamados } from "./paginas/FilaChamados";
import { PainelDispositivos } from "./paginas/PainelDispositivos";
import { CoberturaMonitoramento } from "./paginas/CoberturaMonitoramento";

export function App() {
  return (
    <BrowserRouter>
      <ProvedorAutenticacao>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route
            path="/"
            element={
              <RotaProtegida>
                <Inicio />
              </RotaProtegida>
            }
          />
          <Route
            path="/importacao"
            element={
              <RotaProtegida>
                <ImportacaoCsv />
              </RotaProtegida>
            }
          />
          <Route
            path="/usinas"
            element={
              <RotaProtegida>
                <Usinas />
              </RotaProtegida>
            }
          />
          <Route
            path="/usinas/:id"
            element={
              <RotaProtegida>
                <FichaUsina />
              </RotaProtegida>
            }
          />
          <Route
            path="/faturas"
            element={
              <RotaProtegida>
                <IngestaoFatura />
              </RotaProtegida>
            }
          />
          <Route
            path="/usinas/:id/leitura-manual"
            element={
              <RotaProtegida>
                <EntradaManualLeitura />
              </RotaProtegida>
            }
          />
          <Route
            path="/diagnostico"
            element={
              <RotaProtegida>
                <MesaDiagnostico />
              </RotaProtegida>
            }
          />
          <Route
            path="/diagnostico/:diagnosticoId"
            element={
              <RotaProtegida>
                <MesaDiagnostico />
              </RotaProtegida>
            }
          />
          <Route
            path="/chamados"
            element={
              <RotaProtegida>
                <FilaChamados />
              </RotaProtegida>
            }
          />
          <Route
            path="/usinas/:id/dispositivos"
            element={
              <RotaProtegida>
                <PainelDispositivos />
              </RotaProtegida>
            }
          />
          <Route
            path="/cobertura"
            element={
              <RotaProtegida>
                <CoberturaMonitoramento />
              </RotaProtegida>
            }
          />
        </Routes>
      </ProvedorAutenticacao>
    </BrowserRouter>
  );
}
