import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/creepster/latin-400.css";
import "./index.css";
import { App } from "./shell/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
