import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, AlertCircle, ChevronDown } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  cookie?: string | null;
  licenseUrl?: string | null;
  licenseKey?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  poster?: string | null;
  autoPlay?: boolean;
}

export function VideoPlayer({ url, cookie, licenseUrl, licenseKey, userAgent, referrer, poster, autoPlay = true }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shakaRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shakaVariantsRef = useRef<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ index: number; label: string }[]>([]);
  const [audioTracks, setAudioTracks] = useState<{ id: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);

  const isDash = /\.mpd(?:$|[?#])/i.test(url);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setIsLoading(true);
    setError(null);
    setIsPlaying(false);
    setLevels([]);
    setAudioTracks([]);
    setCurrentLevel(-1);
    setCurrentAudioTrack(-1);

    // Destroy previous instances
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (shakaRef.current) { shakaRef.current.destroy(); shakaRef.current = null; }

    if (isDash) {
      // Use shaka-player for DASH/MPD streams
      loadShaka(video);
    } else {
      // Use hls.js for HLS streams
      const streamUrl = buildProxyUrl(url, cookie, userAgent, referrer);
      loadHls(video, streamUrl);
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => { setIsLoading(false); setIsPlaying(true); };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (shakaRef.current) { shakaRef.current.destroy(); shakaRef.current = null; }
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.src = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, cookie, licenseUrl, licenseKey, userAgent, referrer, autoPlay]);

  function buildProxyUrl(streamUrl: string, c?: string | null, ua?: string | null, ref?: string | null): string {
    let p = `/api/stream?url=${encodeURIComponent(streamUrl)}`;
    if (c) p += `&cookie=${encodeURIComponent(c)}`;
    if (ua) p += `&ua=${encodeURIComponent(ua)}`;
    if (ref) p += `&ref=${encodeURIComponent(ref)}`;
    return p;
  }

  function loadHls(video: HTMLVideoElement, streamUrl: string) {
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        const lvlList = (hls.levels ?? []).map((l, i) => ({
          index: i,
          label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}k`,
        }));
        setLevels(lvlList);
        setCurrentLevel(hls.currentLevel);
        const audioList = (hls.audioTracks ?? []).map((t) => ({
          id: t.id,
          label: t.name || t.lang || `Track ${t.id}`,
        }));
        setAudioTracks(audioList);
        setCurrentAudioTrack(hls.audioTrack);
        if (autoPlay) video.play().catch(console.error);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, () => setCurrentLevel(hls.currentLevel));
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => setCurrentAudioTrack(hls.audioTrack));

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { hls.destroy(); setError("Unable to play this channel"); setIsLoading(false); }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        if (autoPlay) video.play().catch(console.error);
      });
      video.addEventListener('error', () => { setError("Unable to play this channel"); setIsLoading(false); });
    }
  }

  async function loadShaka(video: HTMLVideoElement) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shaka = await import('shaka-player') as any;
      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        setError("DASH playback not supported in this browser");
        setIsLoading(false);
        return;
      }

      const player = new shaka.Player();
      await player.attach(video);
      shakaRef.current = player;

      // ClearKey playlists may provide inline KID:key pairs or a license endpoint.
      const clearKeys: Record<string, string> = {};
      for (const pair of (licenseKey || '').split(',')) {
        const [kid, key] = pair.split(':');
        if (kid && key) clearKeys[kid.trim().toLowerCase()] = key.trim().toLowerCase();
      }
      if (Object.keys(clearKeys).length) {
        player.configure({ drm: { clearKeys } });
      } else if (licenseUrl) {
        player.configure({
          drm: {
            servers: { 'org.w3.clearkey': licenseUrl },
          },
        });
      }

      player.addEventListener('error', (event: { detail: { code: number; message: string } }) => {
        logger_err(`Shaka error: ${event.detail?.code} ${event.detail?.message}`);
        setError("Unable to play this channel");
        setIsLoading(false);
      });

      // Requests go through our same-origin proxy; upstream auth is carried there.
      await player.load(buildProxyUrl(url, cookie, userAgent, referrer));
      setIsLoading(false);

      // Quality and audio choices from the DASH variants.
      const tracks = player.getVariantTracks();
      shakaVariantsRef.current = tracks;
      const qualityTracks = tracks.filter((track: { height?: number; bandwidth?: number }) => track.height || track.bandwidth);
      const qualityOptions = new Map<string, { index: number; label: string }>();
      qualityTracks.forEach((track: { id: number; height?: number; bandwidth?: number }) => {
        const label = track.height ? `${track.height}p` : `${Math.round((track.bandwidth || 0) / 1000)}k`;
        if (!qualityOptions.has(label)) qualityOptions.set(label, { index: track.id, label });
      });
      setLevels([...qualityOptions.values()]);
      setCurrentLevel(-1);
      const langs = [...new Set(tracks.map((t: { language: string }) => t.language).filter(Boolean))];
      if (langs.length > 1) {
        setAudioTracks(langs.map((lang, id) => ({ id, label: String(lang) })));
        setCurrentAudioTrack(0);
      }

      if (autoPlay) video.play().catch(console.error);
    } catch (err) {
      console.error("Shaka load error:", err);
      setError("Unable to play this channel");
      setIsLoading(false);
    }
  }

  function logger_err(msg: string) { console.error(msg); }

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(console.error);
    }
  };

  const hasControls = levels.length > 1 || audioTracks.length > 1;

  return (
    <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden group shadow-2xl ring-1 ring-white/10">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        poster={poster || undefined}
        onClick={togglePlay}
      />

      {hasControls && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
          {levels.length > 1 && (
            <div className="relative">
              <select
                value={currentLevel}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (hlsRef.current) hlsRef.current.currentLevel = value;
                  else if (shakaRef.current) {
                    if (value === -1) shakaRef.current.configure({ abr: { enabled: true } });
                    else {
                      const selected = shakaVariantsRef.current.find((track) => track.id === value);
                      if (selected) {
                        shakaRef.current.configure({ abr: { enabled: false } });
                        shakaRef.current.selectVariantTrack(selected, true);
                      }
                    }
                  }
                  setCurrentLevel(value);
                }}
                className="appearance-none bg-black/70 hover:bg-black/90 text-white text-xs font-bold px-3 py-1.5 pr-8 rounded-xl border border-white/20 backdrop-blur-md focus:outline-none cursor-pointer"
              >
                <option value={-1}>Auto</option>
                {levels.map((l) => <option key={l.index} value={l.index}>{l.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none" />
            </div>
          )}
          {audioTracks.length > 1 && (
            <div className="relative">
              <select
                value={currentAudioTrack}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setCurrentAudioTrack(idx);
                  if (hlsRef.current) hlsRef.current.audioTrack = idx;
                  if (shakaRef.current) {
                    const tracks = shakaRef.current.getVariantTracks();
                    const lang = audioTracks[idx]?.label;
                    const match = tracks.find((t: { language: string }) => t.language === lang);
                    if (match) shakaRef.current.selectAudioLanguage(match.language);
                  }
                }}
                className="appearance-none bg-black/70 hover:bg-black/90 text-white text-xs font-bold px-3 py-1.5 pr-8 rounded-xl border border-white/20 backdrop-blur-md focus:outline-none cursor-pointer"
              >
                {audioTracks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none" />
            </div>
          )}
        </div>
      )}

      {!isPlaying && !isLoading && !error && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer" onClick={togglePlay}>
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_0_30px_rgba(214,243,47,0.4)] transform hover:scale-105 transition-transform">
            <Play className="w-8 h-8 ml-1" fill="currentColor" />
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-md pointer-events-none">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-md text-white px-4 text-center pointer-events-none">
          <AlertCircle className="w-12 h-12 text-destructive mb-3" />
          <p className="font-bold text-lg">{error}</p>
          <p className="text-sm text-white/60 mt-1 font-medium">Please try another channel</p>
        </div>
      )}

      {isPlaying && (
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white/80 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          Playing
        </div>
      )}
    </div>
  );
}
