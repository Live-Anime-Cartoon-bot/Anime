<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: *");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$playlist1 = $_GET["playlist"] ?? "https://plugxvipplaylist.lovable.app/api/playlist";
$playlist2 = $_GET["playlist2"] ?? "https://raw.githubusercontent.com/Live-Anime-Cartoon-bot/CompressBot/refs/heads/main/m3u";
$urls = [$playlist1, $playlist2];
$channels = [];
$seen = [];

foreach ($urls as $playlist) {
    if (!$playlist || !filter_var($playlist, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid playlist URL"]);
        exit;
    }

    $ch = curl_init($playlist);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_ENCODING, "");
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36");
    curl_setopt($ch, CURLOPT_TIMEOUT, 45);
    $text = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($text === false || $status < 200 || $status >= 300 || trim($text) === "") {
        http_response_code(502);
        echo json_encode(["error" => "Failed to fetch a channel playlist", "status" => $status, "detail" => $error]);
        exit;
    }

    foreach (parseM3u($text) as $channel) {
        if (isNonPlayable($channel["url"])) continue;
        $key = strtolower(trim($channel["name"])) . "|" . trim($channel["url"]);
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $channels[] = $channel;
    }
}

echo json_encode($channels, JSON_INVALID_UTF8_SUBSTITUTE);

function parseM3u($content) {
    $channels = [];
    $pending = null;
    $cookie = null;
    $licenseUrl = null;
    $licenseKey = null;
    $userAgent = null;
    $referrer = null;

    foreach (preg_split('/\r?\n/', $content) as $rawLine) {
        $line = trim($rawLine);
        if ($line === "") continue;

        if (strpos($line, "#EXTINF") === 0) {
            $pending = parseExtinfLine($line);
            $cookie = null;
            $licenseUrl = null;
            $licenseKey = null;
            $userAgent = null;
            $referrer = null;
        } elseif (strpos($line, "#EXTHTTP:") === 0) {
            $json = json_decode(substr($line, 9), true);
            if (is_array($json) && !empty($json["cookie"])) $cookie = $json["cookie"];
        } elseif (strpos($line, "#KODIPROP:inputstream.adaptive.license_key=") === 0) {
            $value = substr($line, strlen("#KODIPROP:inputstream.adaptive.license_key="));
            if (preg_match('/^https?:\/\//i', $value)) $licenseUrl = $value;
            else $licenseKey = $value;
        } elseif (strpos($line, "#EXTVLCOPT:http-user-agent=") === 0) {
            $userAgent = substr($line, strlen("#EXTVLCOPT:http-user-agent="));
        } elseif (strpos($line, "#EXTVLCOPT:http-referrer=") === 0) {
            $referrer = substr($line, strlen("#EXTVLCOPT:http-referrer="));
        } elseif (strpos($line, "#KODIPROP:inputstream.adaptive.stream_headers=") === 0) {
            $headers = substr($line, strlen("#KODIPROP:inputstream.adaptive.stream_headers="));
            if (!$cookie && preg_match('/(?:^|&)Cookie=([^&]+)/i', $headers, $m)) $cookie = $m[1];
            if (!$userAgent && preg_match('/(?:^|&)User-Agent=([^&]+)/i', $headers, $m)) $userAgent = $m[1];
        } elseif ($pending && strpos($line, "#") !== 0) {
            $channels[] = array_merge($pending, [
                "url" => $line,
                "cookie" => $cookie,
                "licenseUrl" => $licenseUrl,
                "licenseKey" => $licenseKey,
                "userAgent" => $userAgent,
                "referrer" => $referrer,
            ]);
            $pending = null;
            $cookie = null;
            $licenseUrl = null;
            $licenseKey = null;
            $userAgent = null;
            $referrer = null;
        }
    }
    return $channels;
}

function parseExtinfLine($line) {
    preg_match('/tvg-logo="([^"]*)"/', $line, $logoMatch);
    preg_match('/group-title="([^"]*)"/', $line, $groupMatch);
    $title = "Unknown";
    $titleStart = -1;
    $inQuotes = false;
    for ($i = 0; $i < strlen($line); $i++) {
        if ($line[$i] === '"') $inQuotes = !$inQuotes;
        elseif ($line[$i] === ',' && !$inQuotes) $titleStart = $i;
    }
    if ($titleStart >= 0) $title = trim(substr($line, $titleStart + 1));
    return [
        "name" => $title,
        "logo" => $logoMatch ? $logoMatch[1] : null,
        "group" => $groupMatch ? $groupMatch[1] : null,
    ];
}

function isNonPlayable($url) {
    $path = strtolower(parse_url($url, PHP_URL_PATH) ?? "");
    return str_ends_with($path, ".mp4") || str_ends_with($path, ".mkv");
}
