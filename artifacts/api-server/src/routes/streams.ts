import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "node:stream";
import {
  GetChannelsQueryParams,
  GetChannelsResponse,
  GetM3uQueryParams,
  GetStreamQueryParams,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

function isManifestContent(url: string, contentType: string | null): boolean {
  const ct = (contentType || "").toLowerCase();
  return (
    /mpegurl|m3u8|m3u/.test(ct) ||
    url.toLowerCase().endsWith(".m3u8") ||
    url.toLowerCase().endsWith(".m3u")
  );
}

function proxyUrl(target: string): string {
  return `/api/stream?url=${encodeURIComponent(target)}`;
}

function rewriteM3uManifest(baseUrl: string, content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite URI="..." attributes inside #EXT lines (keys, maps, etc.)
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (match, uri: string) => {
          try {
            const absolute = new URL(uri, baseUrl).toString();
            return `URI="${proxyUrl(absolute)}"`;
          } catch {
            return match;
          }
        });
      }

      // Any non-comment, non-empty line is treated as a media/playlist URL
      try {
        const absolute = new URL(trimmed, baseUrl).toString();
        return proxyUrl(absolute);
      } catch {
        return line;
      }
    })
    .join("\n");
}

function parseExtinfLine(line: string): {
  name: string;
  logo: string | null;
  group: string | null;
} {
  const logoMatch = line.match(/tvg-logo="([^"]*)"/);
  const groupMatch = line.match(/group-title="([^"]*)"/);

  // The channel title is the text after the last comma that is not inside quotes.
  let titleStart = -1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      titleStart = i;
    }
  }
  const name = titleStart >= 0 ? line.slice(titleStart + 1).trim() : "Unknown";

  return {
    name,
    logo: logoMatch ? logoMatch[1] : null,
    group: groupMatch ? groupMatch[1] : null,
  };
}

function isHlsUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes(".m3u8") || lower.endsWith(".m3u") || lower.includes("/playlist.m3u");
}

function parseM3u(content: string) {
  const channels = [];
  const lines = content.split(/\r?\n/);
  let pending: {
    name: string;
    logo: string | null;
    group: string | null;
  } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      pending = parseExtinfLine(line);
    } else if (pending && !line.startsWith("#")) {
      if (isHlsUrl(line)) {
        channels.push({ ...pending, url: line });
      }
      pending = null;
    }
  }

  return channels;
}

const UPSTREAM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

router.get("/m3u", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetM3uQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const url = parsed.data.url;
  if (!isValidUrl(url)) {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  try {
    const upstream = await fetch(url, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok) {
      throw new Error(`Upstream returned ${upstream.status}`);
    }
    const text = await upstream.text();
    res.setHeader("Content-Type", "text/plain");
    res.send(text);
  } catch (err) {
    logger.error({ err, url }, "Failed to fetch M3U playlist");
    res.status(500).json({ error: "Failed to fetch playlist" });
  }
});

router.get("/stream", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetStreamQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const url = parsed.data.url;
  if (!isValidUrl(url)) {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        ...UPSTREAM_HEADERS,
        Referer: new URL(url).origin,
      },
    });
    if (!upstream.ok) {
      throw new Error(`Upstream returned ${upstream.status}`);
    }

    const baseUrl = upstream.url;
    const contentType = upstream.headers.get("content-type");
    const isManifest = isManifestContent(baseUrl, contentType);

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        [
          "content-type",
          "content-length",
          "cache-control",
          "accept-ranges",
          "etag",
          "last-modified",
        ].includes(lower)
      ) {
        // Skip content-length for manifests because we rewrite the body
        if (isManifest && lower === "content-length") return;
        res.setHeader(key, value);
      }
    });

    if (isManifest) {
      const text = await upstream.text();
      const rewritten = rewriteM3uManifest(baseUrl, text);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.send(rewritten);
      return;
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    // Node 20+ supports Readable.fromWeb for native fetch ReadableStream
    Readable.fromWeb(upstream.body as unknown as import("stream/web").ReadableStream)
      .on("error", (err) => {
        logger.error({ err, url }, "Stream pipe error");
        if (!res.writableEnded) res.end();
      })
      .pipe(res);
  } catch (err) {
    logger.error({ err, url }, "Failed to proxy stream");
    res.status(500).json({ error: "Failed to proxy stream" });
  }
});

router.get("/channels", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetChannelsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const playlist = parsed.data.playlist;
  if (!isValidUrl(playlist)) {
    res.status(400).json({ error: "Invalid playlist URL" });
    return;
  }

  try {
    const upstream = await fetch(playlist, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok) {
      throw new Error(`Upstream returned ${upstream.status}`);
    }
    const text = await upstream.text();
    const channels = parseM3u(text);
    res.json(GetChannelsResponse.parse(channels));
  } catch (err) {
    logger.error({ err, playlist }, "Failed to parse channels");
    res.status(500).json({ error: "Failed to parse channels" });
  }
});

export default router;
