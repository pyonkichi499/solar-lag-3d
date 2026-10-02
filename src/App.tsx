import { Charts } from "./charts/Charts";
import { Scene } from "./scene/Scene";
import { usePlayback } from "./store/playback";
import { Header } from "./ui/Header";
import { ParamPanel } from "./ui/ParamPanel";
import { ResultsPanel } from "./ui/ResultsPanel";

export function App() {
  usePlayback();
  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <div className="col-left">
          <ParamPanel />
          <ResultsPanel />
        </div>
        <div className="col-right">
          <div className="scene-wrap">
            <Scene />
          </div>
          <div className="charts-wrap">
            <Charts />
          </div>
        </div>
      </main>
    </div>
  );
}
