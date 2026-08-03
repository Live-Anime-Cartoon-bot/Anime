import React, { useEffect, useState } from 'react';
import { useGetChannels } from '@workspace/api-client-react';
import { VideoPlayer } from '@/components/video-player';
import { AlertCircle, ShieldCheck, Tv, Search } from 'lucide-react';
import type { Channel } from '@workspace/api-client-react';

const PLAYLIST_URL = 'https://raw.githubusercontent.com/Sflex0719/m3u/refs/heads/main/Zio.m3u';

export default function Home() {
  const { data: channels, isLoading, isError } = useGetChannels({ playlist: PLAYLIST_URL });
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannel) {
      // Pick the first channel from the list. The original JUGNU TV stream is
      // intermittently offline at the source, so we start with the first available
      // channel (24/7 Little Singham) instead of defaulting to JUGNU TV.
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center text-white font-sans">
        <div className="w-20 h-20 relative mb-8">
           <div className="absolute inset-0 border-[6px] border-primary/20 rounded-full"></div>
           <div className="absolute inset-0 border-[6px] border-primary rounded-full border-t-transparent animate-spin"></div>
        </div>
        <h1 className="text-3xl font-black tracking-tighter">JUGNU<span className="text-primary">TV</span></h1>
        <p className="text-primary/70 font-bold uppercase tracking-widest mt-3 text-sm animate-pulse">Tuning in...</p>
      </div>
    );
  }

  if (isError || !channels) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center text-white px-6 text-center font-sans">
        <div className="w-24 h-24 bg-card border border-white/5 rounded-full flex items-center justify-center mb-8 shadow-xl">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <h2 className="text-3xl font-black tracking-tight mb-3">Signal Lost</h2>
        <p className="text-muted-foreground font-medium mb-10 max-w-xs text-lg leading-relaxed">
          We couldn't connect to the cartoon network. Please check your connection.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-primary-foreground font-black text-lg px-10 py-4 rounded-full active:scale-95 transition-transform hover:brightness-110 shadow-[0_0_30px_rgba(214,243,47,0.3)]"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const filteredChannels = channels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-24 selection:bg-primary/30 font-sans">
      {/* App Header */}
      <div className="px-5 pt-6 pb-5 sticky top-0 bg-background/80 backdrop-blur-xl z-50">
        <div className="flex items-center justify-between">
           <h1 className="text-2xl font-black tracking-tighter text-white flex items-center gap-1.5">
              <Tv className="w-6 h-6 text-primary" strokeWidth={2.5} />
              JUGNU<span className="text-primary">TV</span>
           </h1>
           <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20 shadow-[0_0_15px_rgba(214,243,47,0.15)]">
             <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(214,243,47,0.8)]" />
             Live
           </div>
        </div>
      </div>

      {/* Main Video Section */}
      <div className="px-4 md:px-6 mb-10 max-w-4xl mx-auto">
        {selectedChannel && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <VideoPlayer
              url={selectedChannel.url}
              poster={selectedChannel.logo}
              cookie={selectedChannel.cookie}
              licenseUrl={selectedChannel.licenseUrl}
              userAgent={selectedChannel.userAgent}
            />

            <div className="mt-6 px-1 space-y-2">
              <h2 className="text-3xl font-black text-white line-clamp-2 tracking-tight leading-none">
                {selectedChannel.name}
              </h2>
              <div className="flex items-center gap-2 text-sm text-primary font-black uppercase tracking-wider">
                 <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
                 <span>Access unlocked</span>
                 <span className="text-muted-foreground font-bold">·</span>
                 <span className="text-muted-foreground font-bold normal-case tracking-normal">expires 11:35 PM</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Channel Grid */}
      <div className="px-4 md:px-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 px-1">
          <h3 className="text-sm font-black text-white/40 uppercase tracking-widest">More Channels</h3>
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Find cartoon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card/50 border border-white/5 text-white font-medium text-sm rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 w-44 placeholder:text-white/30 transition-all focus:w-56 focus:bg-card"
            />
          </div>
        </div>

        {filteredChannels.length === 0 ? (
          <div className="text-center py-16 bg-card/30 rounded-3xl border border-white/5 mx-1">
            <Search className="w-10 h-10 text-white/20 mx-auto mb-4" />
            <p className="text-muted-foreground font-bold text-lg">No channels found</p>
            <p className="text-sm text-white/40 mt-1 font-medium">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 px-1">
            {filteredChannels.map((channel, idx) => {
              const isSelected = selectedChannel?.url === channel.url;
              return (
                <button
                  key={`${channel.url}-${idx}`}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setSelectedChannel(channel);
                  }}
                  className={`
                    relative aspect-[4/3] rounded-3xl overflow-hidden flex flex-col items-center justify-center p-4 transition-all duration-300 active:scale-95 text-center group
                    ${isSelected
                      ? 'bg-primary text-primary-foreground shadow-[0_0_30px_rgba(214,243,47,0.25)] ring-4 ring-primary ring-offset-4 ring-offset-background z-10 scale-[1.02]'
                      : 'bg-card hover:bg-card/80 border border-white/5 hover:border-white/10 hover:shadow-xl'
                    }
                  `}
                >
                  {channel.logo ? (
                    <div className="w-16 h-16 flex items-center justify-center mb-3">
                      <img
                        src={channel.logo || undefined}
                        alt={channel.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        className="max-w-full max-h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`w-16 h-16 mb-3 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${isSelected ? 'bg-black/10' : 'bg-white/5'}`}>
                      <Tv className={`w-8 h-8 ${isSelected ? 'text-black/50' : 'text-white/20'}`} />
                    </div>
                  )}
                  <span className={`text-[13px] font-black line-clamp-2 w-full mt-auto leading-tight ${isSelected ? 'text-black' : 'text-white/80 group-hover:text-white'}`}>
                    {channel.name}
                  </span>

                  {isSelected && (
                    <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-black rounded-full animate-pulse shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}