---
name: HLS stream proxy manifest rewriting
description: Why and how to rewrite M3U8 manifests when proxying HLS streams through a backend.
---

When a browser plays an HLS stream through a backend proxy (e.g. `/api/stream?url=<upstream>`), the M3U8 manifest is fetched from the proxy URL. If the manifest contains relative segment URLs such as `segment001.ts`, the browser resolves them relative to the manifest's URL. Because the manifest URL is the proxy endpoint, the browser will request the wrong path (e.g. `/segment001.ts`) and the stream will fail.

**Rule:** Rewrite the manifest response so every media URL (segment files, variant playlists, `#EXT-X-MAP` URI values, `#EXT-X-KEY` URI values) is replaced by an absolute URL that is also routed through the proxy.

**Why:** Browsers resolve relative URLs in a fetched manifest against the manifest request URL. A proxy query-string URL makes the base path the proxy path, not the upstream path, so relative URLs break unless rewritten.

**How to apply:**
1. Detect that the upstream response is a manifest (check `Content-Type` for `mpegurl`/`m3u8`/`m3u`, or the URL extension).
2. Read the upstream response as text and use the final upstream URL (`response.url`) as the base for resolving relative URLs.
3. For each line:
   - Rewrite `URI="..."` attributes inside `#EXT-X-MAP`, `#EXT-X-KEY`, etc.
   - Rewrite non-comment, non-empty lines that are media URLs.
4. Return the rewritten manifest with `Content-Type: application/vnd.apple.mpegurl` and CORS headers.

**When not needed:** If the upstream already returns absolute URLs and the browser can fetch them directly (CORS allowed), proxying may not be required at all. But for any proxy setup, rewrite the manifest to be safe.
