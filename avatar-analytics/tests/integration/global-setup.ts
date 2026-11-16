// Starts what the integration tests need besides the local Supabase stack:
// the mock Tavus API and the server functions (run with Deno).

import { spawn, type ChildProcess } from "node:child_process"
import { loadEnv } from "vite"

const children: ChildProcess[] = []

async function waitFor(url: string, label: string, init?: RequestInit) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(url, init)
      if (res.status < 500) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`${label} did not start (${url})`)
}

async function isUp(url: string, init?: RequestInit) {
  try {
    return (await fetch(url, init)).status < 500
  } catch {
    return false
  }
}

export async function setup() {
  Object.assign(process.env, loadEnv("test", process.cwd(), ""))
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local (see README).")
  }
  if (!(await isUp(`${supabaseUrl}/auth/v1/health`))) {
    throw new Error("The local Supabase stack is not running. Start it with `npm run db:start`.")
  }

  if (!(await isUp("http://127.0.0.1:54398/__control/health"))) {
    children.push(spawn("node", ["tests/mock-tavus.mjs"], { stdio: "inherit" }))
    await waitFor("http://127.0.0.1:54398/__control/health", "Mock Tavus")
  }
  const functionsProbe = "http://127.0.0.1:54399/health"
  if (!(await isUp(functionsProbe))) {
    children.push(spawn("npm", ["run", "functions"], { stdio: "inherit", detached: true }))
    await waitFor(functionsProbe, "Server functions")
  }
}

export async function teardown() {
  for (const child of children) {
    try {
      if (child.pid) process.kill(-child.pid, "SIGTERM")
    } catch {
      child.kill("SIGTERM")
    }
  }
}
