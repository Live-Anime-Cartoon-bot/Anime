import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Loader2, AlertCircle } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  poster?: string | null;
  autoPlay?: boolean;
}

export function VideoPlayer({ url, poster, autoPlay = true }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    let hls: Hls | null = null;
    setIsLoading(true);
    setError(null);
    setIsPlaying(false);

    // Use the backend proxy for the stream URL to bypass CORS
    const streamUrl = `/api/stream?url=${encodeURIComponent(url)}`;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(e => console.error("Autoplay failed:", e));
        }
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              setError("Unable to play this channel");
              setIsLoading(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // For Safari which has native HLS support
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(e => console.error("Autoplay failed:", e));
        }
      });
      video.addEventListener('error', () => {
         setError("Unable to play this channel");
         setIsLoading(false);
      });
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.src = '';
    };
  }, [url, autoPlay]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.error(e));
      }
    }
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden group shadow-2xl ring-1 ring-white/10">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        poster={poster || undefined}
        onClick={togglePlay}
      />

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
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white/80 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          Playing
        </div>
      )}
    </div>
  );
}