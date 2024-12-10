import { createRoot } from "react-dom/client";
import Explorer from "./index";
import { StrictMode } from "react";

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
