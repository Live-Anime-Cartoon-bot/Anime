<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS, HEAD");
header("Access-Control-Allow-Headers: *");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$url = $_GET["url"] ?? "";
if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid URL"]);
    exit;
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
curl_setopt($ch, CURLOPT_REFERER, parse_url($url, PHP_URL_SCHEME) . "://" . parse_url($url, PHP_URL_HOST));
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

// Forward Range header so video seeking works for VOD segments
if (!empty($_SERVER["HTTP_RANGE"])) {
    curl_setopt($ch, CURLOPT_RANGE, substr($_SERVER["HTTP_RANGE"], 6));
}

$contentType = null;
$effectiveUrl = null;
$isManifest = null;
$manifestBuffer = "";
$started = false;
$errored = false;

// Capture Content-Type from response headers
$headerFn = function ($ch, $header) use (&$contentType, &$started, &$errored) {
    if (!$started) {
        $started = true;
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($status >= 400) {
            $errored = true;
        } else {
            http_response_code($status);
        }
    }
    if (stripos($header, "Content-Type:") === 0) {
        $contentType = trim(substr($header, 13));
    }
    return strlen($header);
};

$writeFn = function ($ch, $data) use (&$effectiveUrl, &$contentType, &$isManifest, &$manifestBuffer, &$started, &$errored) {
    if (!$started) {
        $started = true;
        $effectiveUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        $isManifest = isManifestContent($effectiveUrl, $contentType);
        if ($isManifest) {
            header("Content-Type: application/vnd.apple.mpegurl");
        } elseif ($contentType) {
            header("Content-Type: $contentType");
        }
    }
    if ($errored) {
        return strlen($data);
    }
    if ($isManifest) {
        $manifestBuffer .= $data;
    } else {
        echo $data;
    }
    return strlen($data);
};

curl_setopt($ch, CURLOPT_HEADERFUNCTION, $headerFn);
curl_setopt($ch, CURLOPT_WRITEFUNCTION, $writeFn);

$result = curl_exec($ch);

if ($result === false) {
    curl_close($ch);
    http_response_code(502);
    echo json_encode(["error" => "Failed to proxy stream: " . curl_error($ch)]);
    exit;
}

$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status >= 400) {
    http_response_code(502);
    echo json_encode(["error" => "Upstream returned $status"]);
    exit;
}

if ($isManifest) {
    $rewritten = rewriteM3uManifest($effectiveUrl, $manifestBuffer);
    echo $rewritten;
}

function isManifestContent($url, $contentType) {
    $ct = strtolower($contentType ?: "");
    if (preg_match('/mpegurl|m3u8|m3u/', $ct)) return true;
    $lower = strtolower($url);
    return str_ends_with($lower, ".m3u8") || str_ends_with($lower, ".m3u");
}

function proxyUrl($target) {
    return "/api/stream?url=" . urlencode($target);
}

function rewriteM3uManifest($baseUrl, $content) {
    $lines = preg_split('/\r?\n/', $content);
    $out = [];
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === "") {
            $out[] = $line;
            continue;
        }
        if (strpos($trimmed, "#") === 0) {
            $out[] = preg_replace_callback('/URI="([^"]+)"/', function ($m) use ($baseUrl) {
                $absolute = rel2abs($m[1], $baseUrl);
                return 'URI="' . proxyUrl($absolute) . '"';
            }, $line);
            continue;
        }
        $absolute = rel2abs($trimmed, $baseUrl);
        $out[] = proxyUrl($absolute);
    }
    return implode("\n", $out);
}

function rel2abs($rel, $base) {
    if (preg_match('/^[a-z][a-z0-9+.-]*:/i', $rel)) return $rel;
    $baseParts = parse_url($base);
    if (strpos($rel, "//") === 0) {
        return $baseParts["scheme"] . ":" . $rel;
    }
    $basePath = isset($baseParts["path"]) ? $baseParts["path"] : "/";
    $baseDir = dirname($basePath);
    if (strpos($rel, "/") === 0) {
        return $baseParts["scheme"] . "://" . $baseParts["host"] . (isset($baseParts["port"]) ? ":" . $baseParts["port"] : "") . $rel;
    }
    if ($baseDir === "/") $baseDir = "";
    return $baseParts["scheme"] . "://" . $baseParts["host"] . (isset($baseParts["port"]) ? ":" . $baseParts["port"] : "") . $baseDir . "/" . $rel;
}
