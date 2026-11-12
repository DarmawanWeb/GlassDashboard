import type { NextRequest } from "next/server";

// Semua /api/* diteruskan ke container API (FastAPI). Hanya container web yang dibuka ke luar.
// Body diteruskan sebagai stream (unggah video besar tidak ditampung di memori).
export const dynamic = "force-dynamic";

const API_URL = (process.env.API_URL ?? "http://api:8000").replace(/\/$/, "");
const PASS = ["content-type", "cache-control", "content-disposition"];

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${API_URL}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers: { "content-type": req.headers.get("content-type") ?? "application/json" },
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    init.body = req.body;
    init.duplex = "half";
  }

  try {
    const res = await fetch(target, init);
    const headers = new Headers();
    for (const h of PASS) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
    return new Response(res.body, { status: res.status, headers });
  } catch {
    return Response.json(
      { detail: `Mesin GLASS (API) tidak bisa dihubungi di ${API_URL}. Pastikan container "api" berjalan.` },
      { status: 502 },
    );
  }
}

export { proxy as GET, proxy as POST };
