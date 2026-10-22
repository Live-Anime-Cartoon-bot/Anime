<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS, HEAD");
header("Access-Control-Allow-Headers: *");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$url = $_GET["url"] ?? "";
$cookie = $_GET["cookie"] ?? "";
$ua = $_GET["ua"] ?? "";
$referrer = $_GET["ref"] ?? "";
if (!$url || !isHttpUrl($url)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid URL"]);
    exit;
}

$headers = [];
if ($cookie !== "") $headers[] = "Cookie: " . $cookie;
if ($referrer !== "") $headers[] = "Referer: " . $referrer;
if (!empty($_SERVER["HTTP_RANGE"])) $headers[] = "Range: " . $_SERVER["HTTP_RANGE"];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_ENCODING, "");
curl_setopt($ch, CURLOPT_USERAGENT, $ua ?: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36");
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_REFERER, $referrer ?: (parse_url($url, PHP_URL_SCHEME) . "://" . parse_url($url, PHP_URL_HOST)));
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$effectiveUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL) ?: $url;
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: "application/octet-stream";
$error = curl_error($ch);
curl_close($ch);

if ($body === false || $status >= 400) {
    http_response_code(502);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Upstream stream request failed", "status" => $status, "detail" => $error]);
    exit;
}

$isHls = isHlsManifest($effectiveUrl, $contentType);
$isDash = isDashManifest($effectiveUrl, $contentType);
if ($isHls) {
    header("Content-Type: application/vnd.apple.mpegurl");
    echo rewriteHlsManifest($effectiveUrl, $body, $cookie, $ua, $referrer);
    exit;
}
if ($isDash) {
    header("Content-Type: application/dash+xml; charset=utf-8");
    echo rewriteDashManifest($effectiveUrl, $body, $cookie, $ua, $referrer);
    exit;
}

http_response_code($status ?: 200);
header("Content-Type: " . $contentType);
header("Accept-Ranges: bytes");
echo $body;

function isHttpUrl($url) {
    $scheme = strtolower(parse_url($url, PHP_URL_SCHEME) ?? "");
    return ($scheme === "http" || $scheme === "https") && filter_var($url, FILTER_VALIDATE_URL);
}

function isHlsManifest($url, $contentType) {
    return preg_match('/mpegurl|m3u8|m3u/i', $contentType) || preg_match('/\.m3u8?(?:$|[?#])/i', $url);
}

function isDashManifest($url, $contentType) {
    return stripos($contentType, "dash+xml") !== false || preg_match('/\.mpd(?:$|[?#])/i', $url);
}

function proxyUrlWithAuth($target, $cookie, $ua, $referrer) {
    $query = ["url" => $target];
    if ($cookie !== "") $query["cookie"] = $cookie;
    if ($ua !== "") $query["ua"] = $ua;
    if ($referrer !== "") $query["ref"] = $referrer;
    return "/api/stream?" . http_build_query($query, "", "&", PHP_QUERY_RFC3986);
}

function proxyBaseUrl($baseUrl, $cookie, $ua, $referrer) {
    $payload = base64_encode(json_encode([
        "baseUrl" => $baseUrl,
        "cookie" => $cookie,
        "ua" => $ua,
        "referrer" => $referrer,
    ]));
    $payload = rtrim(strtr($payload, "+/", "-_"), "=");
    return "/api/stream-base/" . $payload . "/";
}

function xmlEscape($value) {
    return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, "UTF-8");
}

function resolveUrl($relative, $base) {
    if (preg_match('/^[a-z][a-z0-9+.-]*:/i', $relative)) return $relative;
    $parts = parse_url($base);
    if (!$parts || empty($parts["scheme"]) || empty($parts["host"])) return $relative;
    $origin = $parts["scheme"] . "://" . $parts["host"] . (isset($parts["port"]) ? ":" . $parts["port"] : "");
    if (strpos($relative, "//") === 0) return $parts["scheme"] . ":" . $relative;
    if (strpos($relative, "/") === 0) return $origin . $relative;
    $path = $parts["path"] ?? "/";
    $directory = substr($path, 0, strrpos($path, "/") + 1);
    $combined = $directory . $relative;
    $segments = [];
    foreach (explode("/", $combined) as $segment) {
        if ($segment === "" || $segment === ".") continue;
        if ($segment === "..") array_pop($segments);
        else $segments[] = $segment;
    }
    return $origin . "/" . implode("/", $segments);
}

function rewriteHlsManifest($baseUrl, $content, $cookie, $ua, $referrer) {
    $out = [];
    foreach (preg_split('/\r?\n/', $content) as $line) {
        $trimmed = trim($line);
        if ($trimmed === "") {
            $out[] = $line;
        } elseif (strpos($trimmed, "#") === 0) {
            $out[] = preg_replace_callback('/URI="([^"]+)"/', function ($m) use ($baseUrl, $cookie, $ua, $referrer) {
                return 'URI="' . proxyUrlWithAuth(resolveUrl($m[1], $baseUrl), $cookie, $ua, $referrer) . '"';
            }, $line);
        } else {
            $out[] = proxyUrlWithAuth(resolveUrl($trimmed, $baseUrl), $cookie, $ua, $referrer);
        }
    }
    return implode("\n", $out);
}

function rewriteDashManifest($manifestUrl, $content, $cookie, $ua, $referrer) {
    $hasBaseUrl = false;
    $content = preg_replace_callback('/<BaseURL([^>]*)>([\s\S]*?)<\/BaseURL>/i', function ($m) use ($manifestUrl, $cookie, $ua, $referrer, &$hasBaseUrl) {
        $hasBaseUrl = true;
        $value = trim(strip_tags($m[2]));
        $isDirectory = ($value === "" || substr($value, -1) === "/");
        $absolute = resolveUrl($value === "" ? "." : $value, $manifestUrl);
        if ($isDirectory && substr($absolute, -1) !== "/") $absolute .= "/";
        $proxied = $isDirectory
            ? proxyBaseUrl($absolute, $cookie, $ua, $referrer)
            : proxyUrlWithAuth($absolute, $cookie, $ua, $referrer);
        return "<BaseURL" . $m[1] . ">" . xmlEscape($proxied) . "</BaseURL>";
    }, $content);

    $content = preg_replace_callback('/\b(media|initialization|sourceURL)="([^"]+)"/i', function ($m) use ($manifestUrl, $cookie, $ua, $referrer) {
        if (!preg_match('/^(?:https?:)?\/\//i', $m[2])) return $m[0];
        return $m[1] . '="' . xmlEscape(proxyUrlWithAuth(resolveUrl($m[2], $manifestUrl), $cookie, $ua, $referrer)) . '"';
    }, $content);

    if (!$hasBaseUrl) {
        $base = resolveUrl(".", $manifestUrl);
        if (substr($base, -1) !== "/") $base .= "/";
        $proxiedBase = xmlEscape(proxyBaseUrl($base, $cookie, $ua, $referrer));
        $content = preg_replace('/(<MPD\b[^>]*>)/i', '$1<BaseURL>' . $proxiedBase . '</BaseURL>', $content, 1);
    }
    return $content;
}
