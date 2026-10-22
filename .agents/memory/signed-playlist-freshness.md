---
name: Signed playlist freshness
description: Refresh cadence for channel playlists whose entries include short-lived signed cookies.
---

Some Jio-style stream playlists include per-channel signed cookies that expire within hours. Treat playlist entries as time-sensitive metadata, not durable stream URLs.

**Why:** A channel can remain visible in the app after its embedded cookie has expired, making playback fail even though the playlist endpoint is healthy.

**How to apply:** Fetch signed playlists from the server and keep any metadata cache far shorter than the observed token lifetime. Do not save cookie values or other signed tokens in project memory or static exports.
