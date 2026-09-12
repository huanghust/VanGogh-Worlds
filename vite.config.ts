import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// The inspector's DOM attributes must not reach Three.js objects: a changed
// code-path during hot reload is interpreted as a nested Three.js property.
const inspectableTags = new Set('a aside button caption circle code defs div ellipse fieldset footer g h1 h2 h3 h4 h5 h6 input kbd label legend li linearGradient main nav ol p path rect section span stop style svg table tbody td text textarea tfoot th thead title tr ul'.split(' '))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    inspectAttr({
      predicate: (node) => node.type === 'JSXElement'
        && node.openingElement.name.type === 'JSXIdentifier'
        && inspectableTags.has(node.openingElement.name.name),
    }), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
