import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  resolve: {
    alias: {
      "monaco-editor/esm/vs/editor/contrib/hover/browser/hover":
        "monaco-editor/esm/vs/editor/contrib/hover/browser/hoverController",
    },
  },
  build: {
    lib: {
      entry: "src/index.ts",
      name: "graphql-explorer",
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  plugins: [
    react(),
    dts({ tsconfigPath: "./tsconfig.app.json" }),
    viteStaticCopy({
      targets: [
        {
          src: "src/graphql-explorer.css.d.ts", // Source file
          dest: ".", // Destination in dist folder
        },
      ],
    }),
  ],
});
