import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { setupI18n } from "./i18n";
import "./index.css";
import { installUrlSync } from "./store/urlSync";

// URL を先にストアへ反映してから、その言語で i18n を初期化する
installUrlSync();
setupI18n();

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
