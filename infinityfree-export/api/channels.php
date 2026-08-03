<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: *");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$playlist = $_GET["playlist"] ?? "https://raw.githubusercontent.com/Sflex0719/m3u/refs/heads/main/Zio.m3u";
if (!$playlist || !filter_var($playlist, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid playlist URL"]);
    exit;
}

$ch = curl_init($playlist);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
$text = curl_exec($ch);
if ($text === false || $text === null || trim($text) === "") {
    http_response_code(502);
    echo json_encode(["error" => "Failed to fetch playlist"]);
    exit;
}
curl_close($ch);

$rawChannels = parseM3u($text);
$channels = applyCustomizations($rawChannels);
$channels = array_values(array_filter($channels, function ($c) {
    return !isKnownNonPlayableUrl($c["url"]);
}));

echo json_encode($channels);

// ────────────────────────────────────────────────
// Helper functions
// ────────────────────────────────────────────────

function parseM3u($content) {
    $channels = [];
    $lines = preg_split('/\r?\n/', $content);
    $pending = null;
    $pendingCookie = null;
    $pendingLicenseUrl = null;
    $pendingUserAgent = null;

    foreach ($lines as $rawLine) {
        $line = trim($rawLine);
        if ($line === "") continue;

        if (strpos($line, "#EXTINF") === 0) {
            $pending = parseExtinfLine($line);
            $pendingCookie = null;
            $pendingLicenseUrl = null;
            $pendingUserAgent = null;
        } elseif (strpos($line, "#EXTHTTP:") === 0) {
            $json = json_decode(substr($line, 9), true);
            if ($json && isset($json["cookie"])) $pendingCookie = $json["cookie"];
        } elseif (strpos($line, "#KODIPROP:inputstream.adaptive.license_key=") === 0) {
            $pendingLicenseUrl = substr($line, strlen("#KODIPROP:inputstream.adaptive.license_key="));
        } elseif (strpos($line, "#EXTVLCOPT:http-user-agent=") === 0) {
            $pendingUserAgent = substr($line, strlen("#EXTVLCOPT:http-user-agent="));
        } elseif ($pending && strpos($line, "#") !== 0) {
            $channels[] = array_merge($pending, [
                "url" => $line,
                "cookie" => $pendingCookie,
                "licenseUrl" => $pendingLicenseUrl,
                "userAgent" => $pendingUserAgent,
            ]);
            $pending = null;
            $pendingCookie = null;
            $pendingLicenseUrl = null;
            $pendingUserAgent = null;
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

function isKnownNonPlayableUrl($url) {
    $lower = strtolower($url);
    return str_ends_with($lower, ".mp4") || str_ends_with($lower, ".mkv");
}

function applyCustomizations($channels) {
    $customizations = [
        [
            "matchName" => "Pogo",
            "name" => "POGO",
            "logo" => "https://static.wikia.nocookie.net/robotwars/images/1/1f/PogoTV.png/revision/latest?cb=20210927185053",
            "url" => "https://line.sweetv.xyz/play/live.php?mac=00:1A:79:00:03:B2&stream=156128&extension=m3u8&play_token=9sBGXoBcMI",
            "addIfMissing" => false,
        ],
        [
            "matchName" => "Cartoon Network",
            "name" => "Cartoon Network - Tataplay",
            "logo" => "https://yt3.googleusercontent.com/uG9EngVHBNOX4OfWFr17sojyqZo_BHy2tW0_zeXxJHkDrHtyoax2yljfog_55-b0LEPWa_ELPQ=s160-c-k-c0x00ffffff-no-rj",
            "url" => "http://66.102.126.10:8000/play/a011/index.m3u8",
            "addIfMissing" => false,
        ],
        [
            "matchName" => "Disney Junior",
            "name" => "Disney Junior - Tataplay",
            "logo" => "https://upload.wikimedia.org/wikipedia/commons/3/36/2019_Disney_Junior_logo.svg",
            "url" => "http://66.102.126.10:8000/play/a004/index.m3u8",
            "addIfMissing" => false,
        ],
        [
            "matchName" => "Nick",
            "name" => "Nick - Tataplay",
            "logo" => "https://upload.wikimedia.org/wikipedia/commons/8/80/Nickelodeon_2009_logo.svg",
            "url" => "http://66.102.126.10:8000/play/a00w/index.m3u8",
            "addIfMissing" => false,
        ],
        [
            "matchName" => "Nick Jr",
            "name" => "Nick Jr. - Tataplay",
            "logo" => "https://upload.wikimedia.org/wikipedia/commons/9/98/Nick_Jr._logo_2009.svg",
            "url" => "http://66.102.126.10:8000/play/a00m/index.m3u8",
            "addIfMissing" => false,
        ],
        [
            "matchName" => "Disney",
            "name" => "Disney Channel HD - Tataplay",
            "logo" => "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Disney_Channel_logo_2014.svg/1200px-Disney_Channel_logo_2014.svg.png",
            "url" => "http://66.102.126.10:8000/play/a013/index.m3u8",
            "addIfMissing" => false,
        ],
        [
            "matchName" => "Minimax",
            "name" => "Minimax",
            "logo" => "https://upload.wikimedia.org/wikipedia/en/e/e9/Minimax_%282021%29.webp",
            "url" => "https://vodzong.mjunoon.tv:8087/streamtest/157-1M/chunks.m3u8",
            "addIfMissing" => true,
        ],
    ];
    foreach ($customizations as $c) {
        $idx = -1;
        foreach ($channels as $i => $ch) {
            if (stripos($ch["name"], $c["matchName"]) !== false) {
                $idx = $i;
                break;
            }
        }
        if ($idx >= 0) {
            if (!empty($c["name"])) $channels[$idx]["name"] = $c["name"];
            if (!empty($c["logo"])) $channels[$idx]["logo"] = $c["logo"];
            if (!empty($c["url"])) {
                $channels[$idx]["url"] = $c["url"];
                $channels[$idx]["cookie"] = null;
                $channels[$idx]["licenseUrl"] = null;
                $channels[$idx]["userAgent"] = null;
            }
            if (!empty($c["group"])) $channels[$idx]["group"] = $c["group"];
        } elseif (!empty($c["addIfMissing"]) && !empty($c["name"]) && !empty($c["url"])) {
            $channels[] = [
                "name" => $c["name"],
                "logo" => $c["logo"] ?? null,
                "group" => $c["group"] ?? null,
                "url" => $c["url"],
                "cookie" => null,
                "licenseUrl" => null,
                "userAgent" => null,
            ];
        }
    }
    return $channels;
}
