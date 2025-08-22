export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url")
  if (!url) return new Response("Missing url", { status: 400 })

  let u: URL
  try {
    u = new URL(url)
  } catch {
    return new Response("Invalid url", { status: 400 })
  }

  // Allow Wikimedia and Archive (any subdomain)
  const host = u.hostname.toLowerCase()
  const allowed =
    host === "archive.org" ||
    host.endsWith(".archive.org") ||
    host === "upload.wikimedia.org" ||
    host.endsWith(".wikimedia.org")

  if (!allowed) {
    return new Response("Host not allowed", { status: 400 })
  }

  try {
    const range = req.headers.get("range") || undefined
    const upstream = await fetch(u.toString(), {
      headers: {
        ...(range ? { range } : {}),
        Accept: "audio/*;q=0.9,*/*;q=0.8",
        Referer: "",
        Origin: "",
        "User-Agent": "PixelPlaza/1.0",
      },
      redirect: "follow",
    })

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`Upstream error ${upstream.status}`, { status: 502 })
    }

    const headers = new Headers()
    const pass = ["content-type", "content-length", "content-range", "accept-ranges"]
    for (const name of pass) {
      const v = upstream.headers.get(name)
      if (v) headers.set(name, v)
    }
    if (!headers.has("content-type")) {
      if (u.pathname.endsWith(".mp3")) headers.set("content-type", "audio/mpeg")
      else if (u.pathname.endsWith(".ogg")) headers.set("content-type", "audio/ogg")
    }
    headers.set("Cache-Control", "public, max-age=31536000, immutable")
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Cross-Origin-Resource-Policy", "cross-origin")

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch {
    return new Response("Fetch failed", { status: 502 })
  }
}
