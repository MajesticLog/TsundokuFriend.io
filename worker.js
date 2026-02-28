/**
 * Cloudflare Worker: minireader
 * Routes:
 *   GET  /?keyword=...        -> proxy to Jisho API (CORS enabled)
 *   POST /handwrite           -> proxy to Google Input Tools handwriting (CORS enabled)
 *
 * Deploy:
 *   - Create a Worker named "minireader"
 *   - Paste this code, Deploy
 *   - Your site should call:
 *       https://<your-worker>.workers.dev/?keyword=猫
 *       https://<your-worker>.workers.dev/handwrite   (POST JSON payload)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // Handwriting proxy
    if (url.pathname === "/handwrite") {
      if (request.method !== "POST") {
        return json({ error: "Use POST" }, 405);
      }

      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "FAILED_TO_PARSE_REQUEST_BODY", detail: String(e) }, 400);
      }

      // Forward to Google Input Tools handwriting endpoint
      const upstreamUrl = "https://www.google.com/inputtools/request?ime=handwriting&app=translate&cs=1";

      let upstream;
      try {
        upstream = await fetch(upstreamUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "User-Agent": "minireader-gh-pages/1.0",
          },
          body: JSON.stringify(body),
        });
      } catch (e) {
        return json({ error: "UPSTREAM_FETCH_FAILED", upstream: "google.com", detail: String(e) }, 502);
      }

      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    // Jisho proxy (optional; you can also call Jisho directly)
    const keyword = url.searchParams.get("keyword") || "";
    if (!keyword) {
      return json({ error: "Missing keyword" }, 400);
    }

    const jishoURL = "https://jisho.org/api/v1/search/words?keyword=" + encodeURIComponent(keyword);

    let upstream;
    try {
      upstream = await fetch(jishoURL, {
        headers: { "User-Agent": "minireader-gh-pages/1.0" },
      });
    } catch (e) {
      return json({ error: "UPSTREAM_FETCH_FAILED", upstream: "jisho.org", detail: String(e) }, 502);
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
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
