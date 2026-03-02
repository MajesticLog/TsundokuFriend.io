/* =============================================================
   Cloudflare Worker — Dictionary + Handwriting + NHK proxy
   ============================================================= */

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (url.pathname === '/handwrite') {
      return handleHandwrite(request, origin);
    }

    if (url.searchParams.has('nhk')) {
      return handleNhkList(origin);
    }

    const nhkUrl = url.searchParams.get('nhk_article');
    if (nhkUrl) {
      return handleNhkArticle(nhkUrl, origin);
    }

    const keyword = url.searchParams.get('keyword')?.trim() || '';
    if (!keyword) {
      return json({ error: 'MISSING_KEYWORD', data: [] }, 400, origin);
    }
    return handleDictionary(keyword, origin);
  }
};

// ── NHK Easy News ─────────────────────────────────────────────────────────────

async function handleNhkList(origin) {
  try {
    // news-list.json is the correct endpoint — top-list.json does not exist
    const r = await fetch('https://www3.nhk.or.jp/news/easy/news-list.json', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('NHK news-list HTTP ' + r.status);
    const list = await r.json();

    // Structure: [ { "YYYYMMDD": [ {news_id, title, title_with_ruby, news_prearranged_time}, ... ] } ]
    const articles = [];
    for (const weekObj of (list || [])) {
      for (const dayArticles of Object.values(weekObj)) {
        for (const item of (dayArticles || [])) {
          articles.push({
            title: item.title_with_ruby ? stripRuby(item.title_with_ruby) : (item.title || ''),
            date:  (item.news_prearranged_time || '').slice(0, 10),
            url:   `https://www3.nhk.or.jp/news/easy/${item.news_id}/${item.news_id}.html`,
            id:    item.news_id,
          });
          if (articles.length >= 20) break;
        }
        if (articles.length >= 20) break;
      }
      if (articles.length >= 20) break;
    }

    if (!articles.length) throw new Error('No articles parsed from news-list.json');
    return okJson({ articles }, origin);
  } catch (e) {
    return json({ error: 'NHK_UNAVAILABLE', detail: e.message, articles: [] }, 200, origin);
  }
}

async function handleNhkArticle(articleUrl, origin) {
  if (!articleUrl.startsWith('https://www3.nhk.or.jp/news/easy/')) {
    return json({ error: 'INVALID_URL' }, 400, origin);
  }
  try {
    const r = await fetch(articleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();

    // Try multiple possible article body selectors NHK has used over the years
    let body = '';
    const patterns = [
      /id="js-article-body"[^>]*>([\s\S]*?)<\/div>/,
      /class="article-main__body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div/,
      /class="content--detail-main"[^>]*>([\s\S]*?)<\/div>\s*<div/,
    ];
    for (const pat of patterns) {
      const m = html.match(pat);
      if (m && m[1] && /[\u3040-\u9fff]/.test(m[1])) { body = m[1]; break; }
    }
    if (!body) {
      // Fallback: gather <p> tags with Japanese text
      const ps = html.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
      body = ps.filter(p => /[\u3040-\u9fff]/.test(p)).slice(0, 30).join('\n');
    }

    // NHK wraps ruby text in <rb>; strip the wrapper, keep standard <ruby>/<rt>
    body = body
      .replace(/<rb>/g, '').replace(/<\/rb>/g, '')
      .replace(/<span[^>]*class="colour[^"]*"[^>]*>/g, '').replace(/<\/span>/g, '')
      .replace(/\s{2,}/g, ' ');

    return okJson({ html: body || '<p>Article content not available.</p>' }, origin);
  } catch (e) {
    return json({ error: 'ARTICLE_FAILED', detail: e.message }, 200, origin);
  }
}

function stripRuby(s) {
  return s.replace(/<ruby[^>]*>(.*?)<\/ruby>/gs, (_, inner) =>
    inner.replace(/<rt[^>]*>.*?<\/rt>/gs, '').replace(/<[^>]+>/g, '')
  );
}

// ── Handwriting proxy ─────────────────────────────────────────────────────────

async function handleHandwrite(request, origin) {
  try {
    const body = await request.json();
    const r = await fetch(
      'https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(8000),
      }
    );
    const data = await r.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return json({ error: 'HANDWRITE_FAILED', detail: e.message }, 500, origin);
  }
}

// ── JLPT enrichment ───────────────────────────────────────────────────────────

async function enrichJlpt(results, keyword) {
  const firstWord = results[0]?.japanese[0]?.word || keyword;
  const kanji = [...firstWord].find(c => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c));
  if (!kanji) return results;
  if (results.every(r => r.jlpt && r.jlpt.length)) return results;
  try {
    const r = await fetch('https://kanjiapi.dev/v1/kanji/' + encodeURIComponent(kanji), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) return results;
    const k = await r.json();
    if (k.jlpt == null) return results;
    const tag = 'jlpt-n' + k.jlpt; // kanjiapi returns numeric e.g. 3 → "jlpt-n3"
    return results.map(res => ({
      ...res,
      jlpt: (res.jlpt && res.jlpt.length) ? res.jlpt : [tag],
    }));
  } catch (_) {
    return results;
  }
}

// ── Dictionary ────────────────────────────────────────────────────────────────

async function handleDictionary(keyword, origin) {
  const jotobaResult = await tryJotoba(keyword);
  if (jotobaResult.length) {
    return okJson({ meta: { status: 200, source: 'jotoba' }, data: await enrichJlpt(jotobaResult, keyword) }, origin);
  }

  const kana = romajiToHiragana(keyword);
  if (kana && kana !== keyword) {
    const kanaResult = await tryJotoba(kana);
    if (kanaResult.length) {
      return okJson({ meta: { status: 200, source: 'jotoba-kana' }, data: await enrichJlpt(kanaResult, kana) }, origin);
    }
  }

  const firstChar = [...keyword][0] || '';
  const isKanji   = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(firstChar);

  if (isKanji) {
    try {
      const r = await fetch(`https://kanjiapi.dev/v1/words/${encodeURIComponent(firstChar)}`, {
        headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(4000),
      });
      if (r.ok) {
        const data = normaliseKanjiapi(await r.json(), keyword);
        if (data.length) return okJson({ meta: { status: 200, source: 'kanjiapi' }, data }, origin);
      }
    } catch (_) {}

    try {
      const r = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(firstChar)}`, {
        headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(4000),
      });
      if (r.ok) {
        const data = normaliseKanjiDetail(await r.json(), firstChar);
        if (data.length) return okJson({ meta: { status: 200, source: 'kanjiapi-detail' }, data }, origin);
      }
    } catch (_) {}
  }

  return json({ error: 'DICTIONARY_UNAVAILABLE', detail: 'All upstream APIs failed', data: [] }, 200, origin);
}

async function tryJotoba(query) {
  try {
    const r = await fetch('https://jotoba.de/api/search/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, no_english: false, language: 'English' }),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return [];
    return normaliseJotoba((await r.json()).words || []);
  } catch (_) { return []; }
}

// ── Romaji → Hiragana ─────────────────────────────────────────────────────────

function romajiToHiragana(str) {
  if (!str || /[^\x00-\x7F]/.test(str)) return '';
  const s = str.toLowerCase();
  const MAP = [
    ['sha','しゃ'],['shi','し'],['shu','しゅ'],['she','しぇ'],['sho','しょ'],
    ['chi','ち'],['cha','ちゃ'],['chu','ちゅ'],['che','ちぇ'],['cho','ちょ'],
    ['tsu','つ'],['dzu','づ'],['dzi','ぢ'],
    ['kya','きゃ'],['kyu','きゅ'],['kyo','きょ'],['nya','にゃ'],['nyu','にゅ'],['nyo','にょ'],
    ['hya','ひゃ'],['hyu','ひゅ'],['hyo','ひょ'],['mya','みゃ'],['myu','みゅ'],['myo','みょ'],
    ['rya','りゃ'],['ryu','りゅ'],['ryo','りょ'],['gya','ぎゃ'],['gyu','ぎゅ'],['gyo','ぎょ'],
    ['bya','びゃ'],['byu','びゅ'],['byo','びょ'],['pya','ぴゃ'],['pyu','ぴゅ'],['pyo','ぴょ'],
    ['uu','う'],['oo','おお'],['ou','おう'],
    ['ka','か'],['ki','き'],['ku','く'],['ke','け'],['ko','こ'],
    ['sa','さ'],['si','し'],['su','す'],['se','せ'],['so','そ'],
    ['ta','た'],['ti','ち'],['tu','つ'],['te','て'],['to','と'],
    ['na','な'],['ni','に'],['nu','ぬ'],['ne','ね'],['no','の'],
    ['ha','は'],['hi','ひ'],['hu','ふ'],['he','へ'],['ho','ほ'],
    ['fu','ふ'],['ma','ま'],['mi','み'],['mu','む'],['me','め'],['mo','も'],
    ['ya','や'],['yu','ゆ'],['yo','よ'],
    ['ra','ら'],['ri','り'],['ru','る'],['re','れ'],['ro','ろ'],
    ['wa','わ'],['wo','を'],
    ['ga','が'],['gi','ぎ'],['gu','ぐ'],['ge','げ'],['go','ご'],
    ['za','ざ'],['zi','じ'],['zu','ず'],['ze','ぜ'],['zo','ぞ'],
    ['ji','じ'],['ja','じゃ'],['ju','じゅ'],['jo','じょ'],
    ['da','だ'],['di','ぢ'],['du','づ'],['de','で'],['do','ど'],
    ['ba','ば'],['bi','び'],['bu','ぶ'],['be','べ'],['bo','ぼ'],
    ['pa','ぱ'],['pi','ぴ'],['pu','ぷ'],['pe','ぺ'],['po','ぽ'],
    ['a','あ'],['i','い'],['u','う'],['e','え'],['o','お'],['n','ん'],
  ];
  let result = '', i = 0;
  while (i < s.length) {
    if (s[i] === s[i+1] && s[i] !== 'n' && /[a-z]/.test(s[i])) { result += 'っ'; i++; continue; }
    let matched = false;
    for (const [rom, hira] of MAP) {
      if (s.startsWith(rom, i)) { result += hira; i += rom.length; matched = true; break; }
    }
    if (!matched) { result += s[i]; i++; }
  }
  return result;
}

// ── Normalisers ───────────────────────────────────────────────────────────────

function posToStrings(pos) {
  if (!pos) return [];
  const flatten = (p) => {
    if (typeof p === 'string')      return p ? [p] : [];
    if (Array.isArray(p))           return p.flatMap(flatten);
    if (p && typeof p === 'object') { const k = Object.keys(p)[0]; return k ? [k] : []; }
    return [];
  };
  return flatten(pos).filter(Boolean);
}

function normaliseJotoba(words) {
  return words.map(w => ({
    japanese: [{ word: w.reading?.kanji || w.reading?.kana || '', reading: w.reading?.kana || '' }],
    senses: (w.senses || []).map(s => ({
      english_definitions: s.glosses || [],
      parts_of_speech:     posToStrings(s.pos),
    })),
    jlpt:      w.jlpt_lvl ? [`jlpt-n${w.jlpt_lvl}`] : [],
    is_common: w.common || false,
  }));
}

function normaliseKanjiapi(words, keyword) {
  const out = [];
  for (const entry of words) {
    const variant = entry.variants?.find(v =>
      v.written === keyword || v.written?.includes(keyword) || keyword.includes(v.written || '')
    ) || entry.variants?.[0];
    if (!variant) continue;
    const meanings = (entry.meanings_in_context || []).map(m => m.meaning).filter(Boolean);
    if (!meanings.length) continue;
    out.push({
      japanese: [{ word: variant.written || '', reading: variant.pronounced || '' }],
      senses:   [{ english_definitions: meanings, parts_of_speech: [] }],
      jlpt: [], is_common: false,
    });
    if (out.length >= 6) break;
  }
  return out;
}

function normaliseKanjiDetail(k, char) {
  const meanings = k.meanings || [];
  if (!meanings.length) return [];
  return [{
    japanese: [{ word: char, reading: (k.kun_readings || [])[0] || (k.on_readings || [])[0] || '' }],
    senses:   [{ english_definitions: meanings, parts_of_speech: [] }],
    jlpt:     k.jlpt != null ? [`jlpt-n${k.jlpt}`] : [],
    is_common: false,
  }];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
}

function json(body, status = 200, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function okJson(body, origin) { return json(body, 200, origin); }
