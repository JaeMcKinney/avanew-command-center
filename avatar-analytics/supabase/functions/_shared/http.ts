// Small HTTP helpers shared by every function.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

/** An error whose message is safe to show to the caller. */
export class HttpError extends Error {
  status: number
  detail?: unknown
  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/** Wraps a handler with CORS, method checks and error handling. */
export function endpoint(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
    if (req.method !== "POST") return json(405, { error: "Use POST" })
    try {
      return await fn(req)
    } catch (err) {
      if (err instanceof HttpError) {
        return json(err.status, { error: err.message, detail: err.detail })
      }
      console.error(err)
      return json(500, { error: "Something went wrong on the server" })
    }
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new HttpError(400, "The request body must be JSON")
  }
}
