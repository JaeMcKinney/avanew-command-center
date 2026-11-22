import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  server: {
    port: 5180,
    strictPort: true,
    host: "127.0.0.1",
    // `npm run dev:shared` serves the app, the local Supabase API and the local
    // functions through this one address, so the app can be opened from another
    // device or a hosted preview. Local development only.
    allowedHosts: process.env.SHARED_PREVIEW ? true : undefined,
    proxy: {
      "/_sb": { target: "http://127.0.0.1:54321", changeOrigin: true, rewrite: (path) => path.replace(/^\/_sb/, "") },
      "/_fn": { target: "http://127.0.0.1:54399", changeOrigin: true, rewrite: (path) => path.replace(/^\/_fn/, "") },
    },
  },
  preview: { port: 5180, strictPort: true, host: "127.0.0.1" },
})
