/**
 * Cloudflare Worker: minireader
 * GET  /?keyword=...   -> Jotoba.de (open-source Jisho alternative, CORS-friendly)
 * POST /handwrite      -> Google Input Tools handwriting proxy
 *
 * WHY JOTOBA instead of Jisho:
 * Jisho blocks requests from Cloudflare Workers with HTTP 403 regardless of
 * headers. Jotoba (jotoba.de) is an open-source Japanese dictionary with a
 * proper public API, CORS enabled, no authentication required.
 * API docs: https://jotoba.de/docs.html
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // ── Handwriting proxy ──────────────────────────────────────────────────
    if (url.pathname === "/handwrite") {
      if (request.method !== "POST") return json({ error: "Use POST" }, 405);

      let body;
      try { body = await request.json(); }
      catch (e) { return json({ error: "BAD_REQUEST_BODY", detail: String(e) }, 400); }

      let upstream;
      try {
        upstream = await fetch(
          "https://www.google.com/inputtools/request?ime=handwriting&app=translate&cs=1",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              "Accept": "application/json",
              "Origin": "https://translate.google.com",
              "Referer": "https://translate.google.com/",
            },
            body: JSON.stringify(body),
          }
        );
      } catch (e) {
        return json({ error: "UPSTREAM_FETCH_FAILED", upstream: "google.com", detail: String(e) }, 502);
      }

      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // ── Dictionary proxy (Jotoba) ──────────────────────────────────────────
    const keyword = url.searchParams.get("keyword") || "";
    if (!keyword) return json({ error: "Missing keyword" }, 400);

    // Edge cache
    const cache = caches.default;
    const cacheKey = new Request(
      "https://cache.minireader.local/jotoba?kw=" + encodeURIComponent(keyword),
      { method: "GET" }
    );
    const cached = await cache.match(cacheKey);

    let upstream;
    try {
      upstream = await fetch("https://jotoba.de/api/search/words", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ query: keyword, no_english: false, language: "English" }),
      });
    } catch (e) {
      if (cached) return cachedResponse(await cached.text());
      return json({ error: "UPSTREAM_FETCH_FAILED", detail: String(e) }, 502);
    }

    if (!upstream.ok) {
      if (cached) return cachedResponse(await cached.text());
      return json({ error: "JOTOBA_UNAVAILABLE", detail: `HTTP ${upstream.status}` }, 502);
    }

    const jotobaData = await upstream.json();

    // Normalise Jotoba response → Jisho-compatible shape so the frontend
    // doesn't need changes. Jotoba words look like:
    // { reading: { kana, kanji }, senses: [{ glosses, pos }], jlpt_lvl }
    const data = (jotobaData.words || []).map(w => ({
      japanese: [{
        word:    w.reading?.kanji || w.reading?.kana || "",
        reading: w.reading?.kana  || "",
      }],
      senses: (w.senses || []).map(s => ({
        english_definitions: s.glosses || [],
        parts_of_speech:     s.pos ? [s.pos] : [],
      })),
      jlpt: w.jlpt_lvl ? [`jlpt-n${w.jlpt_lvl}`] : [],
      is_common: w.common || false,
    }));

    const respBody = JSON.stringify({ meta: { status: 200 }, data });
    const resp = new Response(respBody, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
    ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  },
};

function cachedResponse(text) {
  return new Response(text, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Served-From": "stale-cache",
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
