import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

// The page's title, tab icon and browser colour, per edition. Set before the
// app loads, so a build never flashes the other company's name.
const EDITION_HEAD = {
  divigner: { title: "Avalytics by Divigner", icon: "/favicon.svg", color: "#14374B" },
  avanew: { title: "Avalytics by Avanew", icon: "/favicon-avanew.svg", color: "#0B1828" },
}

function editionHead(edition: keyof typeof EDITION_HEAD): Plugin {
  const head = EDITION_HEAD[edition]
  return {
    name: "edition-head",
    transformIndexHtml: (html) =>
      html
        .replace('<html lang="en">', `<html lang="en" data-edition="${edition}">`)
        .replace(/<title>[^<]*<\/title>/, `<title>${head.title}</title>`)
        .replace('href="/favicon.svg"', `href="${head.icon}"`)
        .replace(/(<meta name="theme-color" content=")[^"]*/, `$1${head.color}`),
  }
}

export default defineConfig(({ mode }) => {
  // `VITE_EDITION=avanew` builds the Avanew edition; anything else is Divigner's.
  const edition = loadEnv(mode, process.cwd(), "VITE_").VITE_EDITION === "avanew" ? "avanew" : "divigner"
  return {
    plugins: [react(), tailwindcss(), editionHead(edition)],
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
  }
})
