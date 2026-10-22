import { useMemo, useState } from 'react';
import { AlertCircle, Search, ShieldCheck, Tv } from 'lucide-react';
import './_group.css';

type SampleChannel = {
  id: string;
  name: string;
  group: string;
  short: string;
};

const channels: SampleChannel[] = [
  { id: 'star-plus-hd', name: 'Star Plus HD', group: 'Jio TV+ | Entertainment', short: 'SP' },
  { id: 'star-plus', name: 'Star Plus', group: 'Jio TV+ | Entertainment', short: 'SP' },
  { id: 'star-bharat-hd', name: 'Star Bharat HD', group: 'Jio TV+ | Entertainment', short: 'SB' },
  { id: 'star-bharat', name: 'Star Bharat', group: 'Jio TV+ | Entertainment', short: 'SB' },
  { id: 'colors-hd', name: 'Colors HD', group: 'Jio TV+ | Entertainment', short: 'C' },
  { id: 'colors', name: 'Colors', group: 'Jio TV+ | Entertainment', short: 'C' },
  { id: 'wow-kidz', name: 'Wow Kidz', group: 'Kids', short: 'WK' },
  { id: 'cartoon-network', name: 'Cartoon Network', group: 'Kids', short: 'CN' },
];

export function Current() {
  const [selectedId, setSelectedId] = useState('wow-kidz');
  const [query, setQuery] = useState('');
  const selected = channels.find((channel) => channel.id === selectedId) ?? channels[0];
  const filteredChannels = useMemo(
    () => channels.filter((channel) => channel.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <div className="min-h-screen bg-background pb-8 font-sans text-foreground">
      <header className="sticky top-0 z-10 bg-background/90 px-5 py-5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-1.5 text-2xl font-black tracking-tight text-white">
            <Tv className="h-6 w-6 text-primary" />
            JUGNU<span className="text-primary">TV</span>
          </h1>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
            Live
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4">
        <div className="relative mb-6 aspect-video overflow-hidden rounded-3xl bg-black ring-1 ring-white/10">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          </div>
        </div>

        <section className="mb-9 px-1">
          <h2 className="mb-2 text-3xl font-black leading-none text-white">{selected.name}</h2>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
            <ShieldCheck className="h-4 w-4" />
            <span>Access unlocked</span>
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between gap-3 px-1">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/45">More Channels</h3>
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                aria-label="Find cartoon"
                data-testid="input-find-cartoon-current"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find cartoon..."
                className="w-44 rounded-full border border-white/10 bg-card/80 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-primary/50"
              />
            </label>
          </div>
          {filteredChannels.length ? (
            <div className="grid grid-cols-2 gap-4 px-1 sm:grid-cols-3">
              {filteredChannels.map((channel) => {
                const active = channel.id === selectedId;
                return (
                  <button
                    key={channel.id}
                    data-testid={`button-channel-current-${channel.id}`}
                    onClick={() => setSelectedId(channel.id)}
                    className={`relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-3xl border p-4 text-center transition ${
                      active ? 'border-primary bg-primary text-black' : 'border-white/5 bg-card text-white'
                    }`}
                  >
                    <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-black ${
                      active ? 'bg-black/10' : 'bg-white/10'
                    }`}>
                      {channel.short}
                    </div>
                    <span className="mt-auto line-clamp-2 w-full text-[13px] font-black leading-tight">
                      {channel.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-white/5 bg-card/50 py-12 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-white/30" />
              <p className="font-bold text-white/70">No channels found</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
