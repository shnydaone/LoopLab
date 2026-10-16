import { useMemo, useState } from 'react';
import { PACKS, allBuiltinPatterns } from '@/content/library';
import { keyName } from '@/music/theory';
import type { Pattern, Role } from '@/music/types';
import { ROLES } from '@/music/types';
import { ROLE_META } from '@/project/factory';
import { useStore } from '@/state/store';
import { EnergyDots } from './controls';
import { useLive } from '@/engine/live';

function PackCard({ packId }: { packId: string }) {
  const pack = PACKS.find((p) => p.id === packId)!;
  const project = useStore((s) => s.project);
  const { loadGroove, launchSection } = useStore.getState();
  const isBase = project.basePackId === pack.id;
  const harmonyPending = useLive((s) => s.harmonyPending);

  return (
    <article className={`pack-card ${isBase ? 'base' : ''}`} style={{ ['--accent' as string]: pack.accent }}>
      <header>
        <div>
          <div className="pack-family">{pack.family}</div>
          <h3>{pack.name}</h3>
        </div>
        <button className="btn accent" onClick={() => loadGroove(pack.id)} title="Load this full band">
          {isBase ? 'Reload' : 'Load groove'}
        </button>
      </header>
      <p>{pack.description}</p>
      <div className="pack-meta mono">
        <span>{pack.bpm} BPM</span>
        <span>{keyName(pack.harmony)}</span>
        <span>{pack.patterns.length} parts</span>
      </div>
      <div className="pack-sections" role="group" aria-label={`${pack.name} sections`}>
        {pack.sections.map((s) => {
          const current = isBase && project.sectionId === s.id;
          return (
            <button
              key={s.id}
              className={`chip ${current ? 'on' : ''} ${current && harmonyPending ? 'queued' : ''}`}
              onClick={() => launchSection(pack.id, s.id)}
              title={`Launch ${s.name} on the next boundary`}
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function PartRow({ p }: { p: Pattern }) {
  const project = useStore((s) => s.project);
  const { setTrackPattern, selectTrack } = useStore.getState();
  const target = project.tracks.find((t) => t.role === p.role);
  const active = target?.patternId === p.id;
  const accent = PACKS.find((k) => k.id === p.packId)?.accent;
  return (
    <button
      className={`part-row ${active ? 'on' : ''}`}
      onClick={() => {
        if (!target) return;
        setTrackPattern(target.id, active ? null : p.id);
        selectTrack(target.id);
      }}
      title={`${p.description ?? p.name}\n${active ? 'Click to remove' : 'Click to queue on the ' + ROLE_META[p.role].name + ' track'}`}
      style={{ ['--role' as string]: ROLE_META[p.role].color }}
    >
      <span className="part-dot" />
      <span className="part-name">{p.name}</span>
      <span className="part-pack" style={{ color: accent }}>{p.sourceId ? '✦ variation' : p.genre}</span>
      <EnergyDots energy={p.energy} color={ROLE_META[p.role].color} />
    </button>
  );
}

export function Browser() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | 'all'>('all');
  const userPatterns = useStore((s) => s.project.userPatterns);
  const parts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...allBuiltinPatterns(), ...userPatterns].filter(
      (p) =>
        !p.tags.includes('fill') &&
        (role === 'all' || p.role === role) &&
        (!q || `${p.name} ${p.genre} ${p.tags.join(' ')} ${p.role}`.toLowerCase().includes(q)),
    );
  }, [query, role, userPatterns]);

  return (
    <div className="panel browser">
      <div className="panel-head">
        <h2>Grooves</h2>
        <span className="muted small">{PACKS.length} packs</span>
      </div>
      <div className="panel-scroll">
        <div className="pack-list">
          {PACKS.map((p) => (
            <PackCard key={p.id} packId={p.id} />
          ))}
          <div className="pack-soon">More genres are on the roadmap: rock, funk, hip-hop, electronic and more.</div>
        </div>

        <div className="parts">
          <div className="parts-head">
            <h2>Parts</h2>
            <input
              className="search"
              placeholder="Search parts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Search parts"
            />
          </div>
          <div className="role-filter" role="group" aria-label="Filter by instrument">
            <button className={role === 'all' ? 'on' : ''} onClick={() => setRole('all')}>All</button>
            {ROLES.map((r) => (
              <button
                key={r}
                className={role === r ? 'on' : ''}
                onClick={() => setRole(r)}
                style={{ ['--role' as string]: ROLE_META[r].color }}
              >
                {ROLE_META[r].name}
              </button>
            ))}
          </div>
          {(role === 'all' ? ROLES : [role]).map((r) => {
            const list = parts.filter((p) => p.role === r);
            if (list.length === 0) return null;
            return (
              <section key={r} className="part-group">
                <h4 style={{ color: ROLE_META[r].color }}>
                  {ROLE_META[r].icon} {ROLE_META[r].name}
                </h4>
                {list.map((p) => (
                  <PartRow key={p.id} p={p} />
                ))}
              </section>
            );
          })}
          {parts.length === 0 && <div className="muted small pad">No parts match “{query}”.</div>}
        </div>
      </div>
    </div>
  );
}
