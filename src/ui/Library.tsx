import { useMemo, useState } from 'react';
import { FAMILIES, PACKS, allBuiltinPatterns, getPack } from '@/content/library';
import { useLive } from '@/engine/live';
import { keyName } from '@/music/theory';
import type { Pattern, Role } from '@/music/types';
import { ROLES } from '@/music/types';
import { ROLE_META } from '@/project/factory';
import { useStore } from '@/state/store';
import { useUi, type LibraryTab } from '@/state/ui';
import { startTour } from '@/tour/tourStore';
import { PackArt } from './art/PackArt';
import { EnergyDots } from './components';
import { IconChevronLeft, IconGraduation, IconSearch, IconStar, IconStarFilled } from './icons';

const TAGLINE: Record<string, string> = {
  'roots-reggae': 'One drop • Roots • Skank',
  'militant-steppers': 'Steppers • Militant • Heavy',
  dub: 'Dub • Echo • Space',
  rocksteady: 'Rocksteady • Soulful • Sweet',
  'kingston-ska': 'Shuffle • Classic • Horns',
  'two-tone-ska': 'Offbeat • Brass • Two-tone',
  jungle: 'Breaks • Rolling sub • Ragga',
  'trip-hop': 'Downtempo • Moody • Cinematic',
  'classic-house': 'Four-to-the-floor • Classic • Deep',
};

function PackRow({ packId }: { packId: string }) {
  const pack = getPack(packId)!;
  const project = useStore((s) => s.project);
  const { loadGroove, launchSection } = useStore.getState();
  const favorites = useUi((s) => s.favorites);
  const toggleFavorite = useUi((s) => s.toggleFavorite);
  const harmonyPending = useLive((s) => s.harmonyPending);
  const isBase = project.basePackId === pack.id;
  const [open, setOpen] = useState(isBase);
  const fav = favorites.includes(pack.id);

  return (
    <article className={`pack ${isBase ? 'base' : ''} ${open ? 'open' : ''}`} style={{ ['--accent' as string]: pack.accent }} data-tour={`pack-${pack.id}`}>
      <div className="pack-row">
        <button className="pack-hit" onClick={() => setOpen(!open)} aria-expanded={open} data-help="pack-card">
          <PackArt packId={pack.id} className="pack-thumb" />
          <span className="pack-info">
            <span className="pack-name">{pack.name}</span>
            <span className="pack-tags">{TAGLINE[pack.id] ?? pack.family}</span>
            <span className="pack-count">{pack.patterns.length} parts · {pack.bpm} BPM</span>
          </span>
        </button>
        <button className={`star ${fav ? 'on' : ''}`} aria-label={fav ? `Unfavourite ${pack.name}` : `Favourite ${pack.name}`} aria-pressed={fav} data-help="favorite" onClick={() => toggleFavorite(pack.id)}>
          {fav ? <IconStarFilled size={16} /> : <IconStar size={16} />}
        </button>
      </div>
      {open && (
        <div className="pack-detail">
          <p>{pack.description}</p>
          <div className="pack-meta">
            <span>{keyName(pack.harmony)}</span>
            <span>{pack.family}</span>
          </div>
          <button className="btn accent block" onClick={() => loadGroove(pack.id)} data-tour={`load-${pack.id}`} data-help="pack-card">
            {isBase ? 'Reload this groove' : `Load ${pack.name}`}
          </button>
          <div className="pack-sections" role="group" aria-label={`${pack.name} sections`}>
            {pack.sections.map((s) => {
              const current = isBase && project.sectionId === s.id;
              return (
                <button
                  key={s.id}
                  className={`chip kind-${s.kind} ${current ? 'on' : ''} ${current && harmonyPending ? 'queued' : ''}`}
                  onClick={() => launchSection(pack.id, s.id)}
                  data-help={`section-${s.kind}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

function PartRow({ p }: { p: Pattern }) {
  const project = useStore((s) => s.project);
  const { setTrackPattern, selectTrack } = useStore.getState();
  const target = project.tracks.find((t) => t.role === p.role);
  const active = target?.patternId === p.id;
  const accent = getPack(p.packId)?.accent;
  return (
    <button
      className={`part-row ${active ? 'on' : ''}`}
      onClick={() => {
        if (!target) return;
        setTrackPattern(target.id, active ? null : p.id);
        selectTrack(target.id);
      }}
      data-help="part"
      style={{ ['--role' as string]: ROLE_META[p.role].color }}
    >
      <span className="part-dot" />
      <span className="part-name">{p.name}</span>
      <span className="part-pack" style={{ color: accent }}>{p.sourceId ? '✦ variation' : p.genre}</span>
      <EnergyDots energy={p.energy} color={ROLE_META[p.role].color} />
    </button>
  );
}

function PartsList({ parts }: { parts: Pattern[] }) {
  const [role, setRole] = useState<Role | 'all'>('all');
  const list = parts.filter((p) => role === 'all' || p.role === role);
  return (
    <>
      <div className="chips-row" role="group" aria-label="Filter by instrument">
        <button className={`chip ${role === 'all' ? 'on' : ''}`} onClick={() => setRole('all')}>All</button>
        {ROLES.map((r) => (
          <button key={r} className={`chip ${role === r ? 'on' : ''}`} onClick={() => setRole(r)} style={{ ['--accent' as string]: ROLE_META[r].color }}>
            {ROLE_META[r].name}
          </button>
        ))}
      </div>
      {(role === 'all' ? ROLES : [role]).map((r) => {
        const rows = list.filter((p) => p.role === r);
        if (!rows.length) return null;
        return (
          <section key={r} className="part-group">
            <h4 style={{ color: ROLE_META[r].color }}>{ROLE_META[r].name}</h4>
            {rows.map((p) => (
              <PartRow key={p.id} p={p} />
            ))}
          </section>
        );
      })}
      {list.length === 0 && <p className="empty">Nothing here yet.</p>}
    </>
  );
}

export function Library() {
  const tab = useUi((s) => s.libraryTab);
  const family = useUi((s) => s.family);
  const favorites = useUi((s) => s.favorites);
  const setUi = useUi((s) => s.set);
  const togglePanel = useUi((s) => s.togglePanel);
  const userPatterns = useStore((s) => s.project.userPatterns);
  const query = useUi((s) => s.query);
  const setQuery = (v: string) => setUi({ query: v });
  const q = query.trim().toLowerCase();

  const packs = PACKS.filter(
    (p) =>
      (family === 'All' || p.family === family) &&
      (!q || `${p.name} ${p.genre} ${p.family} ${TAGLINE[p.id] ?? ''}`.toLowerCase().includes(q)),
  );
  const parts = useMemo(
    () =>
      allBuiltinPatterns().filter(
        (p) =>
          !p.tags.includes('fill') &&
          (family === 'All' || getPack(p.packId)?.family === family) &&
          (!q || `${p.name} ${p.genre} ${p.role} ${p.tags.join(' ')}`.toLowerCase().includes(q)),
      ),
    [family, q],
  );

  const tabs: { id: LibraryTab; label: string }[] = [
    { id: 'packs', label: 'Packs' },
    { id: 'parts', label: 'Parts' },
    { id: 'favorites', label: 'Favourites' },
    { id: 'yours', label: 'Yours' },
  ];

  return (
    <section className="panel library" aria-label="Groove Library" data-tour="library">
      <header className="panel-head">
        <h2 data-help="library">Groove Library</h2>
        <button className="ibtn ghost" aria-label="Hide Groove Library" onClick={() => togglePanel('library')}>
          <IconChevronLeft />
        </button>
      </header>
      <nav className="tabs" role="tablist" aria-label="Library views" data-help="library-tabs">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setUi({ libraryTab: t.id })}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="lib-tools">
        <label className="search" data-help="search">
          <IconSearch size={16} />
          <input placeholder="Search genres, moods, instruments…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} aria-label="Search" />
        </label>
        <select className="family-select" value={family} onChange={(e) => setUi({ family: e.target.value })} aria-label="Genre family" data-help="family">
          <option value="All">All genres</option>
          {FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="panel-scroll">
        {tab === 'packs' && (
          <div className="pack-list">
            {packs.map((p) => (
              <PackRow key={p.id} packId={p.id} />
            ))}
            {packs.length === 0 && <p className="empty">No packs match “{query}”.</p>}
          </div>
        )}
        {tab === 'parts' && <PartsList parts={parts} />}
        {tab === 'favorites' && (
          <div className="pack-list">
            {PACKS.filter((p) => favorites.includes(p.id)).map((p) => (
              <PackRow key={p.id} packId={p.id} />
            ))}
            {favorites.length === 0 && <p className="empty">Tap the ☆ on any pack to keep it here.</p>}
          </div>
        )}
        {tab === 'yours' && <PartsList parts={userPatterns} />}
      </div>
      <button className="lib-cta" onClick={() => startTour('first-mix')} data-help="help">
        <IconGraduation size={22} />
        <span>
          <b>Make your first mix</b>
          <small>A five-minute guided lesson using the real controls.</small>
        </span>
      </button>
    </section>
  );
}
