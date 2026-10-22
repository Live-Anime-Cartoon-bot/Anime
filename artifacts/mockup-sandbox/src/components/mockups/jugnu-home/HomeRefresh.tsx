import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clapperboard,
  Heart,
  Home,
  Maximize2,
  Pause,
  Play,
  Search,
  Signal,
  Sparkles,
  Star,
  Tv,
  Volume2,
  X,
} from 'lucide-react';
import './_group.css';

type Channel = {
  id: string;
  name: string;
  group: string;
  short: string;
  category: string;
  colors: string;
  tagline: string;
  show: string;
};

const channels: Channel[] = [
  { id: 'wow-kidz', name: 'Wow Kidz', group: 'Kids · Hindi', short: 'WK', category: 'Hindi', colors: 'from-orange-400 to-rose-500', tagline: 'Big laughs, little heroes', show: 'Motu Patlu' },
  { id: 'cartoon-network', name: 'Cartoon Network', group: 'Kids · English', short: 'CN', category: 'English', colors: 'from-sky-400 to-blue-700', tagline: 'The fun never switches off', show: 'The Amazing World of Gumball' },
  { id: 'pogo', name: 'Pogo', group: 'Kids · Hindi', short: 'PG', category: 'Hindi', colors: 'from-amber-300 to-orange-600', tagline: 'Made for masti', show: 'Chhota Bheem' },
  { id: 'disney-channel', name: 'Disney Channel', group: 'Kids · English', short: 'D', category: 'English', colors: 'from-indigo-400 to-violet-700', tagline: 'Stories with a little magic', show: 'Phineas and Ferb' },
  { id: 'nickelodeon', name: 'Nickelodeon', group: 'Kids · Hindi', short: 'nick', category: 'Hindi', colors: 'from-orange-300 to-orange-600', tagline: 'Orange is the new fun', show: 'SpongeBob SquarePants' },
  { id: 'sony-yay', name: 'Sony YAY!', group: 'Kids · Hindi', short: 'YAY!', category: 'Hindi', colors: 'from-fuchsia-400 to-violet-700', tagline: 'Full-on fun, full-on yay', show: 'Baalveer' },
  { id: 'discovery-kids', name: 'Discovery Kids', group: 'Kids · Learning', short: 'DK', category: 'Learning', colors: 'from-emerald-300 to-teal-700', tagline: 'Curiosity looks good on you', show: 'Little Singham' },
  { id: 'hungama', name: 'Hungama', group: 'Kids · Hindi', short: 'H!', category: 'Hindi', colors: 'from-pink-400 to-red-600', tagline: 'Entertainment ka dhamaka', show: 'Shin-chan' },
  { id: 'nick-jr', name: 'Nick Jr.', group: 'Kids · Learning', short: 'jr.', category: 'Learning', colors: 'from-cyan-300 to-blue-500', tagline: 'Play, learn, repeat', show: 'PAW Patrol' },
  { id: 'baby-tv', name: 'BabyTV', group: 'Kids · Learning', short: 'baby', category: 'Learning', colors: 'from-yellow-200 to-pink-400', tagline: 'Gentle moments for little ones', show: 'Little Lola' },
  { id: 'chutti-tv', name: 'Chutti TV', group: 'Kids · Tamil', short: 'CT', category: 'Regional', colors: 'from-yellow-300 to-red-500', tagline: 'Tamil-la jolly time', show: 'Chutti Kuzhandhai' },
  { id: 'gubbare', name: 'Gubbare', group: 'Kids · Hindi', short: 'GB', category: 'Hindi', colors: 'from-blue-300 to-cyan-600', tagline: 'Stories that take you places', show: 'Akbar Birbal' },
];

const categories = ['All', 'Hindi', 'English', 'Learning', 'Regional'];
const featuredDefault = channels[0];
const nowPlaying = 'Motu Patlu: The Great Balloon Race';

function Logo({ channel, compact = false }: { channel: Channel; compact?: boolean }) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-gradient-to-br ${channel.colors} text-white shadow-[inset_0_1px_0_rgba(255,255,255,.32)] ${compact ? 'h-[58px] w-[58px] rounded-[19px]' : 'h-[76px] w-[76px]'}`}
      aria-label={`${channel.name} logo`}
    >
      <div className="absolute -right-4 -top-5 h-14 w-14 rounded-full border border-white/25" />
      <div className="absolute -bottom-6 -left-2 h-12 w-12 rounded-full border border-white/20" />
      <span className={`relative font-black tracking-tight ${compact ? 'text-[15px]' : 'text-[19px]'}`}>{channel.short}</span>
    </div>
  );
}

export function HomeRefresh() {
  const [selectedId, setSelectedId] = useState(featuredDefault.id);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [playerOpen, setPlayerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeNav, setActiveNav] = useState<'Home' | 'Search' | 'Saved'>('Home');
  const [savedIds, setSavedIds] = useState<string[]>(['cartoon-network']);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = channels.find((channel) => channel.id === selectedId) ?? featuredDefault;

  const matchingChannels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return channels.filter((channel) => {
      const matchesQuery = !normalized || `${channel.name} ${channel.group} ${channel.show}`.toLowerCase().includes(normalized);
      const matchesCategory = category === 'All' || channel.category === category;
      const matchesSaved = activeNav !== 'Saved' || savedIds.includes(channel.id);
      return matchesQuery && matchesCategory && matchesSaved;
    });
  }, [activeNav, category, query, savedIds]);

  const trending = matchingChannels.slice(0, 6);
  const categoryRails = category === 'All'
    ? ['Hindi', 'English', 'Learning']
    : [category];

  const selectChannel = (channel: Channel) => {
    setSelectedId(channel.id);
    setActiveNav('Home');
  };

  const openSearch = () => {
    setActiveNav('Search');
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const toggleSaved = (id: string) => {
    setSavedIds((current) => current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id]);
  };

  const playSelected = () => {
    setIsPlaying(true);
    setPlayerOpen(true);
  };

  const ChannelRail = ({ title, items }: { title: string; items: Channel[] }) => (
    <section className="mb-9" aria-label={title}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-[3px] rounded-full bg-[#b89cff]" />
          <h3 className="text-[16px] font-bold tracking-[-.02em] text-[#f4f0ff] sm:text-[18px]">{title}</h3>
        </div>
        <span className="rounded-full border border-white/[.07] bg-white/[.035] px-3 py-1 text-[11px] font-medium text-[#8e8aa3]">
          {items.length} {items.length === 1 ? 'channel' : 'channels'}
        </span>
      </div>
      {items.length ? (
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:gap-4 sm:px-0">
          {items.map((channel, index) => (
            <button
              key={channel.id}
              type="button"
              data-testid={`button-channel-${channel.id}`}
              onClick={() => selectChannel(channel)}
              className={`group relative flex w-[132px] shrink-0 flex-col rounded-[18px] border p-3 text-left transition duration-200 hover:-translate-y-1 hover:border-[#a88aff]/40 sm:w-[158px] sm:p-3.5 ${channel.id === selectedId ? 'border-[#a88aff]/45 bg-[#211d34]' : 'border-white/[.055] bg-[#11111d]'}`}
            >
              <div className="relative mb-3 flex aspect-[1.35/1] w-full items-center justify-center overflow-hidden rounded-[14px] bg-[#171627]">
                <div className={`absolute inset-0 bg-gradient-to-br ${channel.colors} opacity-[.18]`} />
                <div className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/[.04]" />
                <Logo channel={channel} compact />
                {index < 2 && (
                  <span className="absolute left-2 top-2 rounded-full bg-[#cf5b79] px-2 py-1 text-[8px] font-black uppercase tracking-[.13em] text-white">
                    Live
                  </span>
                )}
              </div>
              <span className="truncate text-[12px] font-bold text-[#f2effb] sm:text-[13px]">{channel.name}</span>
              <span className="mt-1 truncate text-[10px] text-[#77738b]">{channel.group}</span>
              {channel.id === selectedId && <span className="mt-2 h-[2px] w-9 rounded-full bg-[#b89cff]" />}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#11111d] px-5 py-8 text-center">
          <Tv className="mx-auto mb-2 h-5 w-5 text-[#8f88a8]" />
          <p className="text-sm font-semibold text-[#e9e4f5]">Nothing in this row yet</p>
          <p className="mt-1 text-xs text-[#77738b]">Try another category or search.</p>
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-[100dvh] overflow-hidden bg-[#090911] pb-28 font-['Outfit',sans-serif] text-white selection:bg-[#a58af2]/40">
      <header className="sticky top-0 z-20 border-b border-white/[.045] bg-[#090911]/95 px-4 py-3 backdrop-blur-xl sm:px-7 sm:py-4">
        <div className="mx-auto flex max-w-[1240px] items-center gap-4">
          <button type="button" data-testid="button-home-logo" onClick={() => { setActiveNav('Home'); setCategory('All'); }} className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#b18aff] to-[#7051da] text-sm font-black text-white shadow-[0_8px_28px_rgba(131,95,227,.24)]">J</span>
            <span className="hidden text-[20px] font-black tracking-[-.055em] sm:inline">JUGNU<span className="text-[#ba9dff]"> TV</span></span>
          </button>
          <label className="relative ml-auto block w-full max-w-[410px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#817c96]" />
            <input
              ref={searchRef}
              type="search"
              aria-label="Search channels and shows"
              data-testid="input-search-channels"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search channels, shows..."
              className="h-11 w-full rounded-full border border-white/[.07] bg-[#151520] pl-11 pr-10 text-[13px] text-[#f6f2ff] outline-none transition placeholder:text-[#6e6a7e] focus:border-[#a58af2]/55 focus:bg-[#1a1927]"
            />
            {query && (
              <button type="button" data-testid="button-clear-search" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#908aa5] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <button type="button" data-testid="button-live-status" onClick={playSelected} className="hidden shrink-0 items-center gap-2 rounded-full border border-[#e07c93]/20 bg-[#e07c93]/[.09] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#f09bb0] sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f28da4]" /> Live now
          </button>
        </div>
      </header>

      <div className="sticky top-[65px] z-10 border-b border-white/[.04] bg-[#090911]/95 backdrop-blur-xl sm:top-[73px]">
        <nav aria-label="Channel categories" className="mx-auto flex max-w-[1240px] gap-7 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-7">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              data-testid={`button-category-${item.toLowerCase()}`}
              onClick={() => { setCategory(item); setActiveNav('Home'); }}
              className={`relative shrink-0 py-[15px] text-[13px] font-semibold transition ${category === item ? 'text-[#c2a9ff]' : 'text-[#858197] hover:text-[#eae5f7]'}`}
            >
              {item === 'All' ? 'For you' : item === 'Hindi' ? 'Hindi' : item === 'English' ? 'English' : item === 'Learning' ? 'Learn & play' : 'Regional'}
              {category === item && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[#b391ff]" />}
            </button>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-[1240px] px-5 pt-5 sm:px-7 sm:pt-7">
        <section className="relative mb-8 overflow-hidden rounded-[26px] border border-white/[.075] bg-[#171629] sm:mb-10 sm:rounded-[30px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_24%,rgba(142,105,213,.30),transparent_40%),radial-gradient(ellipse_at_12%_100%,rgba(214,116,143,.13),transparent_43%)]" />
          <div className="absolute -right-8 top-[-90px] h-[300px] w-[300px] rounded-full border border-white/[.06] sm:right-[16%] sm:h-[420px] sm:w-[420px]" />
          <div className="absolute right-[8%] top-[12%] hidden h-[250px] w-[250px] rounded-full border border-white/[.06] sm:block" />
          <div className="relative grid min-h-[248px] grid-cols-1 items-center gap-5 p-5 sm:min-h-[270px] sm:grid-cols-[1fr_auto] sm:px-8 sm:py-7 lg:min-h-[300px] lg:px-11">
            <div className="relative z-[1] max-w-[600px]">
              <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-[#d7baff] sm:text-[11px]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#b491f2]/15"><Sparkles className="h-3.5 w-3.5" /></span>
                Tonight's little adventure
              </div>
              <h1 className="max-w-[560px] text-[31px] font-black leading-[1.03] tracking-[-.055em] text-[#fffaff] sm:text-[42px] lg:text-[52px]">
                Big stories.<br className="hidden sm:block" /> Little screen time.
              </h1>
              <p className="mt-3 max-w-[390px] text-[13px] leading-5 text-[#a5a0b5] sm:text-[14px]">{selected.tagline}. Catch {selected.show} and more, live on {selected.name}.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="button" data-testid="button-play-featured" onClick={playSelected} className="flex h-11 items-center gap-2.5 rounded-full bg-[#b79bff] px-5 text-[13px] font-extrabold text-[#171222] transition hover:bg-[#c7b3ff] active:scale-[.98]">
                  <Play className="h-4 w-4 fill-current" /> Watch live
                </button>
                <button type="button" data-testid="button-save-featured" onClick={() => toggleSaved(selected.id)} aria-pressed={savedIds.includes(selected.id)} className={`flex h-11 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold transition ${savedIds.includes(selected.id) ? 'border-[#b79bff]/40 bg-[#b79bff]/10 text-[#d0bbff]' : 'border-white/10 bg-white/[.045] text-[#c1bdce] hover:bg-white/[.08]'}`}>
                  {savedIds.includes(selected.id) ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                  {savedIds.includes(selected.id) ? 'In My channels' : 'Add channel'}
                </button>
              </div>
              <div className="mt-5 flex items-center gap-2 text-[10px] font-medium text-[#79758a]">
                <Signal className="h-3.5 w-3.5 text-[#b89cff]" /> Live channel
                <span className="text-[#514d60]">·</span><span>{selected.group}</span>
              </div>
            </div>
            <div className="relative mx-auto flex w-full max-w-[370px] items-center justify-center sm:mr-2 sm:h-full sm:w-[290px] lg:mr-8 lg:w-[360px]">
              <div className={`relative flex aspect-square w-[168px] items-center justify-center rounded-[34px] bg-gradient-to-br ${selected.colors} shadow-[0_24px_70px_rgba(7,5,16,.4)] sm:w-[205px] lg:w-[240px]`}>
                <div className="absolute inset-3 rounded-[27px] border border-white/20" />
                <div className="absolute -right-5 -top-4 h-16 w-16 rounded-full border border-white/20 bg-white/[.035]" />
                <div className="absolute -bottom-3 -left-6 h-12 w-12 rounded-full border border-white/20" />
                <span className="text-[44px] font-black tracking-[-.08em] text-white drop-shadow-lg sm:text-[54px]">{selected.short}</span>
                <span className="absolute bottom-4 rounded-full bg-black/20 px-3 py-1 text-[9px] font-extrabold uppercase tracking-[.16em] text-white/90">JUGNU original</span>
              </div>
              <button type="button" data-testid="button-hero-play" onClick={playSelected} aria-label={`Play ${selected.name}`} className="absolute right-[7%] top-[15%] flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white text-[#272039] shadow-xl transition hover:scale-105 sm:right-0 sm:top-[22%] sm:h-[58px] sm:w-[58px]">
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </button>
              <span className="absolute bottom-[2%] left-[9%] flex items-center gap-1.5 rounded-full border border-white/[.09] bg-[#12111d]/80 px-3 py-1.5 text-[9px] font-bold text-white/80 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f1859a]" /> ON AIR
              </span>
            </div>
          </div>
        </section>

        {activeNav === 'Saved' && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#b79bff]/15 bg-[#171426] px-4 py-3 text-xs text-[#c9b6f9]">
            <Heart className="h-4 w-4" /> Your saved channels, all in one place.
          </div>
        )}

        {activeNav === 'Search' && query && (
          <p className="mb-5 px-1 text-[13px] text-[#9994a9]">
            {matchingChannels.length} {matchingChannels.length === 1 ? 'result' : 'results'} for <span className="font-semibold text-[#eee8ff]">“{query}”</span>
          </p>
        )}

        <ChannelRail title={activeNav === 'Saved' ? 'My channels' : query ? 'Search results' : 'Trending now'} items={trending} />

        {categoryRails.map((railCategory) => {
          const items = matchingChannels.filter((channel) => channel.category === railCategory).slice(0, 6);
          return (
            <ChannelRail
              key={railCategory}
              title={railCategory === 'Hindi' ? 'Hindi favourites' : railCategory === 'English' ? 'Adventure in English' : railCategory === 'Learning' ? 'Curious minds' : 'Regional favourites'}
              items={items}
            />
          );
        })}

        <section className="mb-8 rounded-[22px] border border-white/[.06] bg-[#11111c] p-5 sm:flex sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#b79bff]/10 text-[#c6adff]"><Clapperboard className="h-5 w-5" /></div>
            <div>
              <p className="text-[14px] font-bold text-[#f4efff]">A channel for every kind of curious</p>
              <p className="mt-1 text-[11px] text-[#858095]">Fresh cartoons, familiar favourites, all together.</p>
            </div>
          </div>
          <button type="button" data-testid="button-browse-categories" onClick={() => { setCategory('All'); setActiveNav('Home'); setQuery(''); }} className="mt-4 flex items-center gap-1 text-[12px] font-bold text-[#c0a7ff] hover:text-white sm:mt-0">
            Browse all channels <ChevronRight className="h-4 w-4" />
          </button>
        </section>
      </main>

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[.07] bg-[#10101b]/95 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl sm:left-1/2 sm:right-auto sm:bottom-5 sm:w-[410px] sm:-translate-x-1/2 sm:rounded-full sm:border sm:px-8 sm:pb-2 sm:shadow-[0_14px_55px_rgba(0,0,0,.45)]">
        <div className="mx-auto flex max-w-[420px] items-center justify-around">
          <button type="button" data-testid="nav-home" onClick={() => { setActiveNav('Home'); setCategory('All'); }} className={`flex min-w-[74px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition ${activeNav === 'Home' ? 'text-[#c0a5ff]' : 'text-[#736f82] hover:text-[#cfcae0]'}`}>
            <Home className="h-[19px] w-[19px]" strokeWidth={activeNav === 'Home' ? 2.5 : 1.8} /><span className="text-[10px] font-semibold">Home</span>
          </button>
          <button type="button" data-testid="nav-search" onClick={openSearch} className={`flex min-w-[74px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition ${activeNav === 'Search' ? 'text-[#c0a5ff]' : 'text-[#736f82] hover:text-[#cfcae0]'}`}>
            <Search className="h-[19px] w-[19px]" strokeWidth={activeNav === 'Search' ? 2.5 : 1.8} /><span className="text-[10px] font-semibold">Search</span>
          </button>
          <button type="button" data-testid="nav-saved" onClick={() => setActiveNav('Saved')} className={`flex min-w-[74px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition ${activeNav === 'Saved' ? 'text-[#c0a5ff]' : 'text-[#736f82] hover:text-[#cfcae0]'}`}>
            <Heart className="h-[19px] w-[19px]" strokeWidth={activeNav === 'Saved' ? 2.5 : 1.8} /><span className="text-[10px] font-semibold">My channels</span>
          </button>
        </div>
      </nav>

      {playerOpen && (
        <div role="dialog" aria-modal="true" aria-label={`Now playing ${selected.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-[#05050a]/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-[920px] overflow-hidden rounded-[24px] border border-white/[.11] bg-[#11111c] shadow-[0_30px_100px_rgba(0,0,0,.6)]">
            <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button type="button" data-testid="button-player-back" onClick={() => setPlayerOpen(false)} className="rounded-full p-2 text-[#aaa5ba] hover:bg-white/[.08] hover:text-white" aria-label="Close player"><ArrowLeft className="h-4 w-4" /></button>
                <div><p className="text-[13px] font-bold text-white">{selected.name}</p><p className="text-[10px] text-[#8b869b]">{selected.group} · Live</p></div>
              </div>
              <button type="button" data-testid="button-close-player" onClick={() => setPlayerOpen(false)} aria-label="Close player" className="rounded-full p-2 text-[#aaa5ba] hover:bg-white/[.08] hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="relative aspect-video overflow-hidden bg-[#171529]">
              <div className={`absolute inset-0 bg-gradient-to-br ${selected.colors} opacity-25`} />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(181,148,255,.2),transparent_48%),linear-gradient(135deg,rgba(8,8,15,.1),rgba(8,8,15,.75))]" />
              <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f1859a]" /> LIVE</div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="mb-5 flex h-[82px] w-[82px] items-center justify-center rounded-[27px] border border-white/25 bg-white/10 shadow-2xl backdrop-blur"><Logo channel={selected} compact /></div>
                <p className="text-center text-[19px] font-black tracking-tight text-white sm:text-[24px]">{selected.show}</p>
                <p className="mt-1 text-xs text-white/65">{nowPlaying}</p>
                <button type="button" data-testid="button-player-toggle" onClick={() => setIsPlaying((playing) => !playing)} aria-label={isPlaying ? 'Pause playback' : 'Resume playback'} className="mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#201a2d] transition hover:scale-105">
                  {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                </button>
              </div>
              <div className="absolute inset-x-5 bottom-4 flex items-center gap-3 text-[10px] text-white/70">
                <span>LIVE</span><div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"><div className="h-full w-[68%] rounded-full bg-[#c2aaff]" /></div><Volume2 className="h-4 w-4" /><Maximize2 className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <div><p className="text-[12px] font-semibold text-[#f5f1ff]">Now playing</p><p className="mt-1 text-[11px] text-[#858095]">{selected.show} · {selected.tagline}</p></div>
              <button type="button" data-testid="button-player-save" onClick={() => toggleSaved(selected.id)} className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold text-[#c6bfda] hover:bg-white/[.06]">
                {savedIds.includes(selected.id) ? <Check className="h-3.5 w-3.5 text-[#c0a5ff]" /> : <Heart className="h-3.5 w-3.5" />}
                {savedIds.includes(selected.id) ? 'Saved' : 'Save channel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
