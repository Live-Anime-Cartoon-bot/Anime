<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS, HEAD");
header("Access-Control-Allow-Headers: *");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$encoded = $_GET["payload"] ?? "";
$resource = $_GET["resource"] ?? "";
$json = base64_decode(strtr($encoded, "-_", "+/"), true);
$payload = $json ? json_decode($json, true) : null;
if (!$payload || empty($payload["baseUrl"]) || !isHttpUrl($payload["baseUrl"])) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid DASH base URL"]);
    exit;
}

$target = resolveResourceUrl($resource, $payload["baseUrl"]);
$headers = [];
if (!empty($payload["cookie"])) $headers[] = "Cookie: " . $payload["cookie"];
if (!empty($payload["referrer"])) $headers[] = "Referer: " . $payload["referrer"];
if (!empty($_SERVER["HTTP_RANGE"])) $headers[] = "Range: " . $_SERVER["HTTP_RANGE"];

$ch = curl_init($target);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_ENCODING, "");
curl_setopt($ch, CURLOPT_USERAGENT, $payload["ua"] ?? "Mozilla/5.0");
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_REFERER, $payload["referrer"] ?? (parse_url($target, PHP_URL_SCHEME) . "://" . parse_url($target, PHP_URL_HOST)));
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: "application/octet-stream";
$error = curl_error($ch);
curl_close($ch);

if ($body === false || $status >= 400) {
    http_response_code(502);
    header("Content-Type: application/json");
    echo json_encode(["error" => "DASH resource request failed", "status" => $status, "detail" => $error]);
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

function resolveResourceUrl($relative, $base) {
    $relative = rawurldecode($relative);
    if (preg_match('/^[a-z][a-z0-9+.-]*:/i', $relative)) return $relative;
    $parts = parse_url($base);
    $origin = $parts["scheme"] . "://" . $parts["host"] . (isset($parts["port"]) ? ":" . $parts["port"] : "");
    if (strpos($relative, "//") === 0) return $parts["scheme"] . ":" . $relative;
    if (strpos($relative, "/") === 0) return $origin . $relative;
    $path = $parts["path"] ?? "/";
    $directory = substr($path, 0, strrpos($path, "/") + 1);
    $segments = [];
    foreach (explode("/", $directory . $relative) as $segment) {
        if ($segment === "" || $segment === ".") continue;
        if ($segment === "..") array_pop($segments);
        else $segments[] = $segment;
    }
    return $origin . "/" . implode("/", $segments);
}
