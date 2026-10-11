const TOKEN_TTL_SECONDS = 4 * 60 * 60

function base64url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "")
}

function decode(value: string): string | null {
  try {
    return atob(
      value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4)
    )
  } catch {
    return null
  }
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))
  return base64url(String.fromCharCode(...new Uint8Array(signature)))
}

export async function createAdminToken(
  secret: string,
  now = Math.floor(Date.now() / 1000)
): Promise<string> {
  const payload = base64url(JSON.stringify({ sub: "admin", exp: now + TOKEN_TTL_SECONDS }))
  return `${payload}.${await sign(payload, secret)}`
}

export async function verifyAdminToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  const [payload, signature] = token.split(".")
  if (!payload || !signature || signature !== (await sign(payload, secret))) return false
  const decoded = decode(payload)
  if (!decoded) return false
  try {
    const value = JSON.parse(decoded) as { sub?: unknown; exp?: unknown }
    return value.sub === "admin" && typeof value.exp === "number" && value.exp >= now
  } catch {
    return false
  }
}

export { TOKEN_TTL_SECONDS }
