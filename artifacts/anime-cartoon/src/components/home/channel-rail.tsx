import { useState } from 'react';
import { ChevronRight, Tv } from 'lucide-react';
import type { Channel } from '@workspace/api-client-react';

interface ChannelLogoProps {
  channel: Channel;
  className?: string;
}

export function ChannelLogo({ channel, className = '' }: ChannelLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = channel.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ${className}`}>
      {channel.logo && !imageFailed ? (
        <img
          src={channel.logo}
          alt={`${channel.name} logo`}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-2"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-700 text-sm font-black text-white">
          {initials || <Tv className="h-6 w-6" />}
        </div>
      )}
    </div>
  );
}

interface ChannelRailProps {
  title: string;
  channels: Channel[];
  onSelect: (channel: Channel) => void;
  countLabel?: string;
  testId: string;
  showHeaderAction?: boolean;
}

export function ChannelRail({
  title,
  channels,
  onSelect,
  countLabel,
  testId,
  showHeaderAction = false,
}: ChannelRailProps) {
  if (channels.length === 0) return null;

  return (
    <section className="mb-8" aria-label={title} data-testid={`section-${testId}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
          <h2 className="truncate text-lg font-extrabold tracking-tight text-white sm:text-xl">{title}</h2>
        </div>
        {countLabel && (
          <span className="shrink-0 rounded-lg border border-white/5 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
            {countLabel}
          </span>
        )}
        {showHeaderAction && !countLabel && (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-violet-300 transition hover:text-white"
            onClick={() => document.getElementById('channel-categories')?.scrollIntoView({ behavior: 'smooth' })}
            data-testid={`button-see-more-${testId}`}
          >
            Explore <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:gap-4 sm:px-0">
        {channels.map((channel, index) => (
          <button
            type="button"
            key={`${channel.name}-${channel.url}`}
            onClick={() => onSelect(channel)}
            className="group w-[132px] shrink-0 snap-start text-left sm:w-[154px]"
            data-testid={`button-channel-${testId}-${index}`}
            aria-label={`Play ${channel.name}`}
          >
            <div className="relative mb-2.5 flex aspect-[1.25/1] items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#151a2d] to-[#101321] p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-violet-400/50 group-active:scale-[0.98]">
              <ChannelLogo
                channel={channel}
                className="h-[76px] w-[76px] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
              />
              <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/75">
                {channel.name.toLowerCase().includes('hd') ? 'HD' : 'Live'}
              </span>
              <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg">
                  <Tv className="h-4 w-4" />
                </span>
              </span>
            </div>
            <span className="block truncate px-1 text-sm font-bold text-slate-100">{channel.name}</span>
            <span className="mt-0.5 block truncate px-1 text-xs text-slate-500">
              {channel.group?.trim() || 'Live channel'}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
