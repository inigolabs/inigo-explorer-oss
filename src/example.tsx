import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import Explorer from "./index";

function App() {
  const defaultState = {};

  return (
    <div>
      <Explorer
        defaultState={defaultState}
        onStateChange={(state) => console.log("Explorer state updated:", state)}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
