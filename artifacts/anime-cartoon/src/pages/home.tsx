import { useEffect, useMemo, useRef, useState } from 'react';
import { useGetChannels } from '@workspace/api-client-react';
import { VideoPlayer } from '@/components/video-player';
import { ChannelLogo, ChannelRail } from '@/components/home/channel-rail';
import {
  AlertCircle,
  ChevronRight,
  CirclePlay,
  House,
  Radio,
  Search,
  Tv,
} from 'lucide-react';
import type { Channel } from '@workspace/api-client-react';

const PLAYLIST_URL = 'https://plugxvipplaylist.lovable.app/api/playlist';
const SECOND_PLAYLIST_URL = 'https://raw.githubusercontent.com/Live-Anime-Cartoon-bot/CompressBot/refs/heads/main/m3u';

export default function Home() {
  const { data: channels, isLoading, isError } = useGetChannels({
    playlist: PLAYLIST_URL,
    playlist2: SECOND_PLAYLIST_URL,
  });
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeNav, setActiveNav] = useState('home');
  const [playerOpen, setPlayerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (channels && channels.length > 0 && (!selectedChannel || !channels.some((channel) => channel.url === selectedChannel.url))) {
      const defaultChannel =
        channels.find((channel) => channel.name.toLowerCase() === 'wow kidz') ??
        channels.find((channel) =>
          channel.group?.toLowerCase().includes('kids') &&
          /\.m3u8(?:$|[?#])/i.test(channel.url)
        ) ??
        channels.find((channel) => channel.group?.toLowerCase().includes('kids')) ??
        channels[0];
      setSelectedChannel(defaultChannel);
    }
  }, [channels, selectedChannel]);

  const channelGroups = useMemo(() => {
    const groups = new Map<string, Channel[]>();
    for (const channel of channels ?? []) {
      const group = channel.group?.trim() || 'More Channels';
      groups.set(group, [...(groups.get(group) ?? []), channel]);
    }
    return [...groups.entries()]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  }, [channels]);

  const categoryTabs = useMemo(() => {
    const topGroups = channelGroups
      .filter(({ name }) => !/kids?|junior|cartoon|hindi/i.test(name))
      .slice(0, 5)
      .map(({ name }) => ({
        id: `group:${name}`,
        label: name.includes('|') ? name.split('|').pop()?.trim() || name : name,
      }));
    return [
      { id: 'all', label: 'All' },
      { id: 'kids', label: 'Kids' },
      { id: 'hindi', label: 'Hindi' },
      ...topGroups,
    ];
  }, [channelGroups]);

  const matchingChannels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (channels ?? []).filter((channel) => {
      const matchesQuery = !query ||
        channel.name.toLowerCase().includes(query) ||
        (channel.group ?? '').toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (activeCategory === 'kids') {
        return /kids?|junior|cartoon|children|animation|pogo|nick jr/i.test(`${channel.name} ${channel.group ?? ''}`);
      }
      if (activeCategory === 'hindi') {
        return /hindi/i.test(`${channel.name} ${channel.group ?? ''}`);
      }
      if (activeCategory.startsWith('group:')) {
        return (channel.group?.trim() || 'More Channels') === activeCategory.slice(6);
      }
      return true;
    });
  }, [activeCategory, channels, searchQuery]);

  const sections = useMemo(() => {
    const groups = new Map<string, Channel[]>();
    for (const channel of matchingChannels) {
      const group = channel.group?.trim() || 'More Channels';
      groups.set(group, [...(groups.get(group) ?? []), channel]);
    }
    const ordered = [...groups.entries()]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
    if (activeCategory === 'all' && !searchQuery.trim()) return ordered.slice(0, 8);
    return ordered.slice(0, 12);
  }, [activeCategory, matchingChannels, searchQuery]);

  const openChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setPlayerOpen(true);
    setActiveNav('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBottomNav = (nav: 'home' | 'search' | 'kids') => {
    setActiveNav(nav);
    if (nav === 'home') {
      setActiveCategory('all');
      setPlayerOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (nav === 'search') {
      setActiveCategory('all');
      searchRef.current?.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveCategory('kids');
      setPlayerOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#080914] px-4 pb-10 pt-6 font-sans text-white">
        <div className="mx-auto max-w-5xl animate-pulse">
          <div className="mb-7 h-12 rounded-2xl bg-white/[0.06]" />
          <div className="mb-8 h-36 rounded-3xl bg-white/[0.06]" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="mb-8">
              <div className="mb-4 h-6 w-48 rounded bg-white/[0.06]" />
              <div className="flex gap-3 overflow-hidden">
                {[0, 1, 2, 3].map((card) => <div key={card} className="h-36 w-32 shrink-0 rounded-2xl bg-white/[0.06]" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !channels) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#080914] px-6 text-center font-sans text-white">
        <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-[#13172a]">
          <AlertCircle className="h-10 w-10 text-rose-400" />
        </div>
        <h2 className="mb-3 text-3xl font-black tracking-tight">Signal Lost</h2>
        <p className="mb-8 max-w-xs text-base leading-relaxed text-slate-400">
          We couldn’t load the channel list. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-violet-600 px-8 py-3.5 text-base font-extrabold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 active:scale-95"
          data-testid="button-retry-channels"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const activeChannel = selectedChannel ?? matchingChannels[0] ?? channels[0];

  return (
    <div className="min-h-[100dvh] bg-[#080914] pb-28 font-sans text-white selection:bg-violet-500/30">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#080914]/95 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-3 pt-4 sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={() => handleBottomNav('home')}
            className="flex shrink-0 items-center gap-2.5"
            aria-label="JUGNU TV home"
            data-testid="button-brand-home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-700 shadow-lg shadow-violet-900/30">
              <Tv className="h-5 w-5 text-white" strokeWidth={2.5} />
            </span>
            <span className="hidden text-xl font-black tracking-tight sm:inline">
              JUGNU<span className="text-violet-400">TV</span>
            </span>
          </button>

          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search channels..."
              aria-label="Search channels"
              data-testid="input-channel-search"
              className="h-11 w-full rounded-2xl border border-white/[0.06] bg-[#141726] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/15"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setPlayerOpen(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-950/30 transition hover:brightness-110 active:scale-95"
            aria-label={`Play ${activeChannel.name}`}
            data-testid="button-play-live"
          >
            <Radio className="h-5 w-5" />
          </button>
        </div>

        <nav
          aria-label="Channel categories"
          className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-8 sm:px-6"
          id="channel-categories"
        >
          {categoryTabs.map((category) => {
            const active = activeCategory === category.id;
            return (
              <button
                type="button"
                key={category.id}
                onClick={() => {
                  setActiveCategory(category.id);
                  setActiveNav(category.id === 'kids' ? 'kids' : 'home');
                }}
                className={`relative shrink-0 pb-3 pt-1 text-sm font-semibold transition ${
                  active ? 'text-violet-300' : 'text-slate-400 hover:text-white'
                }`}
                data-testid={`button-category-${category.id.replace(/[^a-z0-9]+/gi, '-')}`}
                aria-pressed={active}
              >
                {category.label}
                {active && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-violet-500" />}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-7">
        {playerOpen && activeChannel && (
          <section className="mb-7" aria-label={`Now playing ${activeChannel.name}`} data-testid="section-live-player">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                <h2 className="truncate text-sm font-bold text-white">Now Playing · {activeChannel.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setPlayerOpen(false)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"
                data-testid="button-close-player"
              >
                Close
              </button>
            </div>
            <VideoPlayer
              url={activeChannel.url}
              poster={activeChannel.logo}
              cookie={activeChannel.cookie}
              licenseUrl={activeChannel.licenseUrl}
              licenseKey={activeChannel.licenseKey}
              userAgent={activeChannel.userAgent}
              referrer={activeChannel.referrer}
            />
          </section>
        )}

        {activeChannel && (
          <section
            className="relative mb-8 overflow-hidden rounded-[26px] border border-white/[0.07] bg-gradient-to-br from-[#1a1b38] via-[#14162a] to-[#101725] p-5 shadow-[0_20px_60px_rgba(5,7,20,0.35)] sm:mb-10 sm:flex sm:items-center sm:gap-6 sm:p-6"
            aria-label="Featured channel"
            data-testid="section-featured-channel"
          >
            <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-violet-500/15 blur-3xl" />
            <ChannelLogo channel={activeChannel} className="relative mb-4 h-[72px] w-[72px] rounded-2xl ring-1 ring-white/10 sm:mb-0 sm:h-20 sm:w-20" />
            <div className="relative min-w-0 flex-1">
              <div className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Featured</div>
              <h1 className="line-clamp-1 text-xl font-black tracking-tight text-white sm:text-2xl" data-testid="text-featured-channel-name">
                {activeChannel.name}
              </h1>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-400">
                {activeChannel.group?.trim() || 'Live cartoon and entertainment channel'}
                <span className="text-slate-600"> · </span>
                {activeChannel.name.toLowerCase().includes('hd') ? 'HD' : 'Live TV'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openChannel(activeChannel)}
              className="absolute right-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_8px_25px_rgba(124,58,237,0.35)] transition hover:scale-105 hover:bg-violet-500 active:scale-95 sm:static sm:translate-y-0 sm:h-14 sm:w-14"
              aria-label={`Play ${activeChannel.name}`}
              data-testid="button-play-featured"
            >
              <CirclePlay className="h-6 w-6" fill="currentColor" strokeWidth={1.5} />
            </button>
          </section>
        )}

        {searchQuery.trim() && (
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold">Search results</h2>
              <p className="text-sm text-slate-500">{matchingChannels.length} channels found</p>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-white/5"
              data-testid="button-clear-search"
            >
              Clear
            </button>
          </div>
        )}

        {!searchQuery.trim() && activeCategory === 'all' && (
          <ChannelRail
            title="Trending Now"
            channels={matchingChannels.slice(0, 20)}
            onSelect={openChannel}
            countLabel={`${Math.min(20, matchingChannels.length)} channels`}
            testId="trending"
          />
        )}

        {sections.map(({ name, items }, index) => (
          <ChannelRail
            key={name}
            title={activeCategory === 'kids' && !/kids?|cartoon|junior/i.test(name) ? `Kids · ${name}` : name}
            channels={items.slice(0, 24)}
            onSelect={openChannel}
            countLabel={items.length > 24 ? `${items.length} channels` : undefined}
            testId={`category-${index}`}
            showHeaderAction
          />
        ))}

        {matchingChannels.length === 0 && (
          <div className="rounded-3xl border border-white/[0.06] bg-[#111422] px-5 py-14 text-center" data-testid="status-no-channels">
            <Search className="mx-auto mb-3 h-8 w-8 text-slate-500" />
            <h2 className="font-bold text-white">No channels found</h2>
            <p className="mt-1 text-sm text-slate-500">Try another search or choose a different category.</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setActiveCategory('all');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="mx-auto mt-2 flex items-center gap-1 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-400 transition hover:border-violet-400/30 hover:text-white"
          data-testid="button-back-to-all"
        >
          Browse all channels <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </main>

      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.07] bg-[#0d1020]/95 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-2xl"
      >
        <div className="mx-auto flex max-w-xl items-center justify-around px-6 pb-2">
          <button
            type="button"
            onClick={() => handleBottomNav('home')}
            className={`flex min-w-16 flex-col items-center gap-1 px-3 py-1.5 text-xs transition ${
              activeNav === 'home' ? 'text-violet-300' : 'text-slate-500 hover:text-white'
            }`}
            data-testid="button-bottom-home"
            aria-current={activeNav === 'home' ? 'page' : undefined}
          >
            <House className="h-5 w-5" />
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={() => handleBottomNav('search')}
            className={`flex min-w-16 flex-col items-center gap-1 px-3 py-1.5 text-xs transition ${
              activeNav === 'search' ? 'text-violet-300' : 'text-slate-500 hover:text-white'
            }`}
            data-testid="button-bottom-search"
            aria-current={activeNav === 'search' ? 'page' : undefined}
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </button>
          <button
            type="button"
            onClick={() => handleBottomNav('kids')}
            className={`flex min-w-16 flex-col items-center gap-1 px-3 py-1.5 text-xs transition ${
              activeNav === 'kids' ? 'text-violet-300' : 'text-slate-500 hover:text-white'
            }`}
            data-testid="button-bottom-kids"
            aria-current={activeNav === 'kids' ? 'page' : undefined}
          >
            <Tv className="h-5 w-5" />
            <span>Kids</span>
          </button>
        </div>
      </nav>
    </div>
  );
}