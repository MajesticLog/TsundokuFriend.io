# TsundokuFriend (GitHub Pages)

This build is refactored for stability:

- **Dictionary lookup** calls **Jisho directly** from the browser:
  - `https://jisho.org/api/v1/search/words?keyword=...`
- **Handwriting recognition** calls your **Cloudflare Worker** only:
  - `POST https://minireader.zoe-caudron.workers.dev/handwrite`

Why: Cloudflare Workers can intermittently fail TLS handshakes to `jisho.org` (error 525). Removing the Worker from the lookup path makes the app reliable on GitHub Pages.

## Optional: Radical/component search dataset

For full radical/component suggestions, add:
- `data/element2kanji.json`
