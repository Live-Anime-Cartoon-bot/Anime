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
    userAgent: string | null;
  }[] = [];

  const lines = content.split(/\r?\n/);
  let pending: { name: string; logo: string | null; group: string | null } | null = null;
  let pendingCookie: string | null = null;
  let pendingLicenseUrl: string | null = null;
  let pendingUserAgent: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      pending = parseExtinfLine(line);
      pendingCookie = null;
      pendingLicenseUrl = null;
      pendingUserAgent = null;
    } else if (line.startsWith("#EXTHTTP:")) {
      try {
        const json = JSON.parse(line.slice(9));
        if (json.cookie) pendingCookie = json.cookie;
      } catch { /* ignore */ }
    } else if (line.startsWith("#KODIPROP:inputstream.adaptive.license_key=")) {
      pendingLicenseUrl = line.split("=").slice(1).join("=");
    } else if (line.startsWith("#EXTVLCOPT:http-user-agent=")) {
      pendingUserAgent = line.split("=").slice(1).join("=");
    } else if (pending && !line.startsWith("#")) {
      channels.push({
        ...pending,
        url: line,
        cookie: pendingCookie,
        licenseUrl: pendingLicenseUrl,
        userAgent: pendingUserAgent,
      });
      pending = null;
      pendingCookie = null;
      pendingLicenseUrl = null;
      pendingUserAgent = null;
    }
  }

  return channels;
}

type ChannelCustomization = {
  matchName: string;
  name?: string;
  logo?: string;
  url?: string;
  group?: string;
  addIfMissing: boolean;
};

const CHANNEL_CUSTOMIZATIONS: ChannelCustomization[] = [
  {
    matchName: "POGO",
    name: "POGO",
    logo: "https://static.wikia.nocookie.net/robotwars/images/1/1f/PogoTV.png/revision/latest?cb=20210927185053",
    url: "https://line.sweetv.xyz/play/live.php?mac=00:1A:79:00:03:B2&stream=156128&extension=m3u8&play_token=9sBGXoBcMI",
    addIfMissing: true,
  },
  {
    matchName: "CARTOON NETWORK",
    name: "Cartoon Network - Tataplay",
    logo: "https://yt3.googleusercontent.com/uG9EngVHBNOX4OfWFr17sojyqZo_BHy2tW0_zeXxJHkDrHtyoax2yljfog_55-b0LEPWa_ELPQ=s160-c-k-c0x00ffffff-no-rj",
    url: "http://66.102.126.10:8000/play/a011/index.m3u8",
    addIfMissing: true,
  },
  {
    matchName: "DISNEY JUNIOR",
    name: "Disney Junior - Tataplay",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/36/2019_Disney_Junior_logo.svg",
    url: "http://66.102.126.10:8000/play/a004/index.m3u8",
    addIfMissing: true,
  },
  {
    matchName: "NICK",
    name: "Nick - Tataplay",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/80/Nickelodeon_2009_logo.svg",
    url: "http://66.102.126.10:8000/play/a00w/index.m3u8",
    addIfMissing: true,
  },
  {
    matchName: "NICK JR",
    name: "Nick Jr. - Tataplay",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/98/Nick_Jr._logo_2009.svg",
    url: "http://66.102.126.10:8000/play/a00m/index.m3u8",
    addIfMissing: true,
  },
  {
    matchName: "DISNEY CHANNEL",
    name: "Disney Channel HD - Tataplay",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Disney_Channel_logo_2014.svg/1200px-Disney_Channel_logo_2014.svg.png",
    url: "http://66.102.126.10:8000/play/a013/index.m3u8",
    addIfMissing: true,
  },
  {
    matchName: "MINIMAX",
    name: "Minimax",
    logo: "https://upload.wikimedia.org/wikipedia/en/e/e9/Minimax_%282021%29.webp",
    url: "https://vodzong.mjunoon.tv:8087/streamtest/157-1M/chunks.m3u8",
    addIfMissing: true,
  },
];

function applyChannelCustomizations(
  channels: { name: string; logo: string | null; group: string | null; url: string; cookie: string | null; licenseUrl: string | null; userAgent: string | null }[]
) {
  const result = [...channels];
  for (const customization of CHANNEL_CUSTOMIZATIONS) {
    const idx = result.findIndex((c) =>
      c.name.toLowerCase().includes(customization.matchName.toLowerCase())
    );
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        ...(customization.name ? { name: customization.name } : {}),
        ...(customization.logo ? { logo: customization.logo } : {}),
        ...(customization.url ? { url: customization.url, cookie: null, licenseUrl: null, userAgent: null } : {}),
        ...(customization.group ? { group: customization.group } : {}),
      };
    } else if (customization.addIfMissing && customization.name && customization.url) {
      result.push({
        name: customization.name,
        logo: customization.logo || null,
        group: customization.group || null,
        url: customization.url,
        cookie: null,
        licenseUrl: null,
        userAgent: null,
      });
    }
  }
  return result;
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
  const cookie = typeof req.query.cookie === 'string' ? req.query.cookie : undefined;
  const ua = typeof req.query.ua === 'string' ? req.query.ua : undefined;

  if (!isValidUrl(url)) {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  try {
    const headers: Record<string, string> = {
      ...UPSTREAM_HEADERS,
      Referer: new URL(url).origin,
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
        if (isManifest && lower === "content-length") return;
        res.setHeader(key, value);
      }
    });

    if (isManifest) {
      const text = await upstream.text();
      // Rewrite manifest — preserve cookie/ua in proxied segment URLs
      const rewritten = rewriteM3uManifestWithAuth(baseUrl, text, cookie, ua);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
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

function proxyUrlWithAuth(target: string, cookie?: string | null, ua?: string | null): string {
  let p = `/api/stream?url=${encodeURIComponent(target)}`;
  if (cookie) p += `&cookie=${encodeURIComponent(cookie)}`;
  if (ua) p += `&ua=${encodeURIComponent(ua)}`;
  return p;
}

function rewriteM3uManifestWithAuth(
  baseUrl: string,
  content: string,
  cookie?: string | null,
  ua?: string | null
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
            return `URI="${proxyUrlWithAuth(absolute, cookie, ua)}"`;
          } catch {
            return match;
          }
        });
      }

      try {
        const absolute = new URL(trimmed, baseUrl).toString();
        return proxyUrlWithAuth(absolute, cookie, ua);
      } catch {
        return line;
      }
    })
    .join("\n");
}

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
    const rawChannels = parseM3u(text);
    const channels = applyChannelCustomizations(rawChannels).filter(
      (c) => !isKnownNonPlayableUrl(c.url)
    );
    res.json(GetChannelsResponse.parse(channels));
  } catch (err) {
    logger.error({ err, playlist }, "Failed to parse channels");
    res.status(500).json({ error: "Failed to parse channels" });
  }
});

export default router;
