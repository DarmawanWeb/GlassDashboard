import type { NextRequest } from "next/server";

// Semua /api/* diteruskan ke container API (FastAPI). Hanya container web yang dibuka ke luar.
export const dynamic = "force-dynamic";

const API_URL = (process.env.API_URL ?? "http://api:8000").replace(/\/$/, "");

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${API_URL}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
      "accept-encoding": "gzip",
    },
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") init.body = await req.text();

  try {
    const res = await fetch(target, init);
    const body = await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { detail: `Mesin GLASS (API) tidak bisa dihubungi di ${API_URL}. Pastikan container "api" berjalan.` },
      { status: 502 },
    );
  }
}

export { proxy as GET, proxy as POST };
