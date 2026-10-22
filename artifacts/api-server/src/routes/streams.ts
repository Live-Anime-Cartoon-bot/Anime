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

function isDashManifest(url: string, contentType: string | null): boolean {
  return /dash\+xml/.test((contentType || "").toLowerCase()) || /\.mpd(?:$|[?#])/i.test(url);
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

function isKnownNonPlayableUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".mkv");
}

function parseM3u(content: string) {
  const channels: {
    name: string;
    logo: string | null;
    group: string | null;
    url: string;
    cookie: string | null;
    licenseUrl: string | null;
    licenseKey: string | null;
    userAgent: string | null;
    referrer: string | null;
  }[] = [];

  const lines = content.split(/\r?\n/);
  let pending: { name: string; logo: string | null; group: string | null } | null = null;
  let pendingCookie: string | null = null;
  let pendingLicenseUrl: string | null = null;
  let pendingLicenseKey: string | null = null;
  let pendingUserAgent: string | null = null;
  let pendingReferrer: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      pending = parseExtinfLine(line);
      pendingCookie = null;
      pendingLicenseUrl = null;
      pendingLicenseKey = null;
      pendingUserAgent = null;
      pendingReferrer = null;
    } else if (line.startsWith("#EXTHTTP:")) {
      try {
        const json = JSON.parse(line.slice(9));
        if (json.cookie) pendingCookie = json.cookie;
      } catch { /* ignore */ }
    } else if (line.startsWith("#KODIPROP:inputstream.adaptive.license_key=")) {
      const licenseValue = line.slice("#KODIPROP:inputstream.adaptive.license_key=".length);
      if (/^https?:\/\//i.test(licenseValue)) pendingLicenseUrl = licenseValue;
      else pendingLicenseKey = licenseValue;
    } else if (line.startsWith("#EXTVLCOPT:http-user-agent=")) {
      pendingUserAgent = line.split("=").slice(1).join("=");
    } else if (line.startsWith("#EXTVLCOPT:http-referrer=")) {
      pendingReferrer = line.slice("#EXTVLCOPT:http-referrer=".length);
    } else if (line.startsWith("#KODIPROP:inputstream.adaptive.stream_headers=")) {
      const headers = line.slice("#KODIPROP:inputstream.adaptive.stream_headers=".length);
      const cookieMatch = headers.match(/(?:^|&)Cookie=([^&]+)/i);
      const uaMatch = headers.match(/(?:^|&)User-Agent=([^&]+)/i);
      if (cookieMatch && !pendingCookie) pendingCookie = cookieMatch[1];
      if (uaMatch && !pendingUserAgent) pendingUserAgent = uaMatch[1];
    } else if (pending && !line.startsWith("#")) {
      channels.push({
        ...pending,
        url: line,
        cookie: pendingCookie,
        licenseUrl: pendingLicenseUrl,
        licenseKey: pendingLicenseKey,
        userAgent: pendingUserAgent,
        referrer: pendingReferrer,
      });
      pending = null;
      pendingCookie = null;
      pendingLicenseUrl = null;
      pendingLicenseKey = null;
      pendingUserAgent = null;
      pendingReferrer = null;
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

type ParsedChannel = ReturnType<typeof parseM3u>[number];
let channelCache: { key: string; expiresAt: number; channels: ParsedChannel[] } | null = null;
let channelFetchInFlight: { key: string; promise: Promise<ParsedChannel[]> } | null = null;

async function fetchChannelSources(sourceUrls: string[]): Promise<ParsedChannel[]> {
  const key = sourceUrls.join("|");
  if (channelCache?.key === key && channelCache.expiresAt > Date.now()) {
    return channelCache.channels;
  }
  if (channelFetchInFlight?.key === key) return channelFetchInFlight.promise;

  const promise = Promise.all(sourceUrls.map(async (sourceUrl) => {
    const upstream = await fetch(sourceUrl, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok) throw new Error(`Playlist returned ${upstream.status}`);
    return parseM3u(await upstream.text());
  })).then((lists) => {
    const seen = new Set<string>();
    const channels = lists.flat().filter((channel) => {
      if (isKnownNonPlayableUrl(channel.url)) return false;
      const dedupeKey = `${channel.name.trim().toLowerCase()}|${channel.url.trim()}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
    channelCache = { key, channels, expiresAt: Date.now() + 3 * 60 * 1000 };
    return channels;
  }).finally(() => {
    if (channelFetchInFlight?.key === key) channelFetchInFlight = null;
  });

  channelFetchInFlight = { key, promise };
  return promise;
}

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
  const cookie = parsed.data.cookie;
  const ua = parsed.data.ua;
  const referrer = parsed.data.ref;

  if (!isValidUrl(url)) {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  try {
    const headers: Record<string, string> = {
      ...UPSTREAM_HEADERS,
      Referer: referrer || new URL(url).origin,
    };
    if (cookie) headers["Cookie"] = cookie;
    if (ua) headers["User-Agent"] = ua;

    const upstream = await fetch(url, { headers });
    if (!upstream.ok) {
      throw new Error(`Upstream returned ${upstream.status}`);
    }

    const baseUrl = upstream.url;
    const contentType = upstream.headers.get("content-type");
    const isManifest = isManifestContent(baseUrl, contentType);
    const isDash = isDashManifest(baseUrl, contentType);

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
        if ((isManifest || isDash) && lower === "content-length") return;
        res.setHeader(key, value);
      }
    });

    if (isManifest) {
      const text = await upstream.text();
      const rewritten = rewriteM3uManifestWithAuth(baseUrl, text, cookie, ua, referrer);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.send(rewritten);
      return;
    }

    if (isDash) {
      const text = await upstream.text();
      const rewritten = rewriteDashManifest(baseUrl, text, cookie, ua, referrer);
      res.setHeader("Content-Type", "application/dash+xml");
      res.send(rewritten);
      return;
    }

    if (!upstream.body) {
      res.end();
      return;
    }

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

function proxyUrlWithAuth(
  target: string,
  cookie?: string | null,
  ua?: string | null,
  referrer?: string | null
): string {
  let p = `/api/stream?url=${encodeURIComponent(target)}`;
  if (cookie) p += `&cookie=${encodeURIComponent(cookie)}`;
  if (ua) p += `&ua=${encodeURIComponent(ua)}`;
  if (referrer) p += `&ref=${encodeURIComponent(referrer)}`;
  return p;
}

function proxyBaseUrl(
  baseUrl: string,
  cookie?: string | null,
  ua?: string | null,
  referrer?: string | null
): string {
  const payload = Buffer.from(JSON.stringify({ baseUrl, cookie, ua, referrer })).toString("base64url");
  return `/api/stream-base/${payload}/`;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function rewriteDashManifest(
  manifestUrl: string,
  content: string,
  cookie?: string | null,
  ua?: string | null,
  referrer?: string | null
): string {
  let hasBaseUrl = false;
  let rewritten = content.replace(/<BaseURL([^>]*)>([\s\S]*?)<\/BaseURL>/gi, (_match, attrs: string, rawValue: string) => {
    hasBaseUrl = true;
    const value = rawValue.trim();
    try {
      const absolute = new URL(value || ".", manifestUrl).toString();
      const isDirectory = value === "" || value.endsWith("/");
      const directoryUrl = isDirectory && !absolute.endsWith("/") ? `${absolute}/` : absolute;
      const proxied = isDirectory
        ? proxyBaseUrl(directoryUrl, cookie, ua, referrer)
        : proxyUrlWithAuth(absolute, cookie, ua, referrer);
      return `<BaseURL${attrs}>${xmlEscape(proxied)}</BaseURL>`;
    } catch {
      return `<BaseURL${attrs}>${rawValue}</BaseURL>`;
    }
  });

  // Absolute resource attributes are proxied directly. Relative segment templates
  // inherit the proxied MPD base path and keep their DASH substitution tokens intact.
  rewritten = rewritten.replace(/\b(media|initialization|sourceURL)="([^"]+)"/gi, (match, attr: string, value: string) => {
    if (!/^(?:https?:)?\/\//i.test(value)) return match;
    try {
      return `${attr}="${xmlEscape(proxyUrlWithAuth(new URL(value, manifestUrl).toString(), cookie, ua, referrer))}"`;
    } catch {
      return match;
    }
  });

  if (!hasBaseUrl) {
    const base = new URL(".", manifestUrl).toString();
    const proxiedBase = xmlEscape(proxyBaseUrl(base, cookie, ua, referrer));
    rewritten = rewritten.replace(/(<MPD\b[^>]*>)/i, `$1<BaseURL>${proxiedBase}</BaseURL>`);
  }
  return rewritten;
}

function rewriteM3uManifestWithAuth(
  baseUrl: string,
  content: string,
  cookie?: string | null,
  ua?: string | null,
  referrer?: string | null
): string {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (match, uri: string) => {
          try {
            const absolute = new URL(uri, baseUrl).toString();
            return `URI="${proxyUrlWithAuth(absolute, cookie, ua, referrer)}"`;
          } catch {
            return match;
          }
        });
      }

      try {
        const absolute = new URL(trimmed, baseUrl).toString();
        return proxyUrlWithAuth(absolute, cookie, ua, referrer);
      } catch {
        return line;
      }
    })
    .join("\n");
}

router.get(/^\/stream-base\/([^/]+)\/(.*)$/, async (req: Request, res: Response): Promise<void> => {
  try {
    const encodedPayload = req.params["0"];
    const resourcePath = req.params["1"];
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      baseUrl: string;
      cookie?: string;
      ua?: string;
      referrer?: string;
    };
    if (!isValidUrl(payload.baseUrl)) {
      res.status(400).json({ error: "Invalid stream base URL" });
      return;
    }

    const target = new URL(resourcePath, payload.baseUrl).toString();
    const headers: Record<string, string> = {
      ...UPSTREAM_HEADERS,
      Referer: payload.referrer || new URL(target).origin,
    };
    if (payload.cookie) headers.Cookie = payload.cookie;
    if (payload.ua) headers["User-Agent"] = payload.ua;
    const upstream = await fetch(target, { headers });
    if (!upstream.ok) throw new Error(`Upstream returned ${upstream.status}`);
    upstream.headers.forEach((value, key) => {
      if (["content-type", "content-length", "cache-control", "accept-ranges"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.status(upstream.status);
    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body as unknown as import("stream/web").ReadableStream)
      .on("error", (err) => {
        logger.error({ err, target }, "DASH segment proxy error");
        if (!res.writableEnded) res.end();
      })
      .pipe(res);
  } catch (err) {
    logger.error({ err }, "Failed to proxy DASH resource");
    res.status(502).json({ error: "Failed to proxy DASH resource" });
  }
});

router.get("/channels", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetChannelsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const playlist = parsed.data.playlist;
  const playlist2 = parsed.data.playlist2;
  if (!isValidUrl(playlist) || (playlist2 && !isValidUrl(playlist2))) {
    res.status(400).json({ error: "Invalid playlist URL" });
    return;
  }

  try {
    const sourceUrls = [playlist, playlist2].filter((value): value is string => Boolean(value));
    const channels = await fetchChannelSources(sourceUrls);
    res.json(GetChannelsResponse.parse(channels));
  } catch (err) {
    logger.error({ err, playlist, playlist2 }, "Failed to parse channels");
    res.status(500).json({ error: "Failed to parse channels" });
  }
});

export default router;
