# Memory

- [HLS stream proxy manifest rewriting](hls-proxy-manifest-rewriting.md) — When proxying HLS streams through a backend, rewrite the M3U8 manifest so relative segment/variant URLs are also routed through the proxy. Otherwise the browser resolves them against the wrong base URL and playback fails.
- [Signed playlist freshness](signed-playlist-freshness.md) — Refresh channel metadata often; signed cookies in these live playlists expire, so stale exported links stop playing.
