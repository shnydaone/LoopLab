import { useEffect, useRef, useState } from 'react';
import { discardPending, resumeTour, startTour, useTour } from '@/tour/tourStore';
import { TOURS } from '@/tour/tours';
import { Segmented } from '@/ui/components';
import { IconClose, IconGraduation, IconSearch } from '@/ui/icons';
import { GLOSSARY, HELP, SHORTCUTS } from './content';
import { useHelp, type HelpLevel } from './helpStore';

type Section = 'lessons' | 'controls' | 'glossary' | 'shortcuts' | 'settings';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'lessons', label: 'Lessons' },
  { id: 'controls', label: 'Controls' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'settings', label: 'Help settings' },
];

function Lessons({ onStart }: { onStart: () => void }) {
  const completed = useTour((s) => s.completed);
  const pending = useTour((s) => s.pending);
  const starting = useTour((s) => s.starting);
  return (
    <div className="hc-lessons">
      <p className="hc-intro">Short, hands-on lessons. Each runs in its own practice project, so your saved work is never changed. The music keeps playing while you learn.</p>
      {pending && (
        <div className="hc-resume">
          <span>
            Unfinished: <b>{TOURS.find((t) => t.id === pending.id)?.title}</b>, step {pending.step + 1}
          </span>
          <button className="btn accent small" onClick={() => { onStart(); void resumeTour(); }}>Resume</button>
          <button className="btn ghost small" onClick={discardPending}>Forget</button>
        </div>
      )}
      <div className="hc-lesson-grid">
        {TOURS.map((t, i) => (
          <article key={t.id} className={`hc-lesson ${i === 0 ? 'primary' : ''}`}>
            <div className="hc-lesson-head">
              <IconGraduation size={20} />
              <h4>{t.title}</h4>
              {completed[t.id] && <span className="hc-done">✓ done</span>}
            </div>
            <p>{t.description}</p>
            <div className="hc-lesson-foot">
              <span className="muted small">{t.minutes} min · {t.steps.length} steps</span>
              <button className={`btn small ${i === 0 ? 'accent' : ''}`} disabled={starting} onClick={() => { onStart(); void startTour(t.id); }}>
                {completed[t.id] ? 'Do it again' : i === 0 ? 'Start the tour' : 'Start'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Controls() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const entries = Object.entries(HELP)
    .filter(([, e]) => !query || `${e.title} ${e.what} ${e.does ?? ''}`.toLowerCase().includes(query))
    .sort((a, b) => a[1].title.localeCompare(b[1].title));
  return (
    <div className="hc-controls">
      <label className="search">
        <IconSearch size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search controls…" aria-label="Search controls" onKeyDown={(e) => e.stopPropagation()} />
      </label>
      <p className="hc-intro">Tip: hover over (or long-press) any control in the app to see this help in place. Turn on Learn mode to tap controls for an explanation instead of using them.</p>
      <dl className="hc-list">
        {entries.map(([id, e]) => (
          <div key={id} className="hc-entry">
            <dt>
              {e.title} {e.status && <span className="soon">{e.status}</span>}
            </dt>
            <dd>
              {e.what} {e.does} {e.how && <em>How: {e.how}</em>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Glossary() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = GLOSSARY.filter((g) => !query || `${g.term} ${g.def}`.toLowerCase().includes(query));
  return (
    <div>
      <label className="search">
        <IconSearch size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search music words…" aria-label="Search glossary" onKeyDown={(e) => e.stopPropagation()} />
      </label>
      <dl className="hc-list">
        {list.map((g) => (
          <div key={g.term} className="hc-entry">
            <dt>{g.term}</dt>
            <dd>{g.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Shortcuts() {
  return (
    <dl className="shortcuts">
      {SHORTCUTS.map(([k, d]) => (
        <div key={k}>
          <dt>
            <kbd>{k}</kbd>
          </dt>
          <dd>{d}</dd>
        </div>
      ))}
    </dl>
  );
}

function Settings() {
  const level = useHelp((s) => s.level);
  const setLevel = useHelp((s) => s.setLevel);
  const learnMode = useHelp((s) => s.learnMode);
  const setLearnMode = useHelp((s) => s.setLearnMode);
  return (
    <div className="hc-settings">
      <h4>How much help?</h4>
      <Segmented<HelpLevel>
        label="Help level"
        value={level}
        onChange={setLevel}
        options={[
          { value: 'beginner', label: 'Beginner' },
          { value: 'standard', label: 'Standard' },
          { value: 'expert', label: 'Expert' },
        ]}
      />
      <p className="hc-intro">
        {level === 'beginner' && 'Beginner: tooltips appear quickly and explain what a control is, what it does, how to use it and when.'}
        {level === 'standard' && 'Standard: short tooltips with the name and a one-line explanation.'}
        {level === 'expert' && 'Expert: tooltips only after a longer hover, name and one line.'}
      </p>
      <h4>Learn mode</h4>
      <label className="menu-check">
        <input type="checkbox" checked={learnMode} onChange={(e) => setLearnMode(e.target.checked)} /> Tap a control to explain it instead of using it (good on touch screens)
      </label>
    </div>
  );
}

export function HelpCenter() {
  const open = useHelp((s) => s.centerOpen);
  const sectionReq = useHelp((s) => s.centerSection);
  const close = useHelp((s) => s.closeCenter);
  const [section, setSection] = useState<Section>('lessons');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSection((SECTIONS.some((s) => s.id === sectionReq) ? sectionReq : 'lessons') as Section);
  }, [open, sectionReq]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', k, true);
    return () => {
      window.removeEventListener('keydown', k, true);
      prev?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="modal-back learn-exempt" onMouseDown={close}>
      <div className="modal help-center" role="dialog" aria-modal="true" aria-label="Help Center" tabIndex={-1} ref={ref} onMouseDown={(e) => e.stopPropagation()}>
        <header className="hc-head">
          <h2>Help Center</h2>
          <button className="ibtn ghost" aria-label="Close Help Center" onClick={close}>
            <IconClose />
          </button>
        </header>
        <div className="hc-split">
          <nav className="hc-nav" role="tablist" aria-label="Help sections" aria-orientation="vertical">
            {SECTIONS.map((s) => (
              <button key={s.id} role="tab" aria-selected={section === s.id} className={section === s.id ? 'on' : ''} onClick={() => setSection(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>
          <div className="hc-body">
            {section === 'lessons' && <Lessons onStart={close} />}
            {section === 'controls' && <Controls />}
            {section === 'glossary' && <Glossary />}
            {section === 'shortcuts' && <Shortcuts />}
            {section === 'settings' && <Settings />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** First-visit welcome, or an offer to resume an unfinished lesson. */
export function WelcomePrompt() {
  const welcomed = useTour((s) => s.welcomed);
  const pending = useTour((s) => s.pending);
  const active = useTour((s) => s.active);
  const dismiss = useTour((s) => s.dismissWelcome);
  const [hidden, setHidden] = useState(false);
  const suppressed = typeof location !== 'undefined' && new URLSearchParams(location.search).has('notour');
  if (active || hidden || suppressed) return null;
  if (pending) {
    const t = TOURS.find((x) => x.id === pending.id);
    if (!t) return null;
    return (
      <div className="welcome learn-exempt" role="dialog" aria-label="Resume lesson">
        <IconGraduation size={26} />
        <div className="welcome-text">
          <b>Pick up where you left off?</b>
          <span>
            {t.title}, step {pending.step + 1} of {t.steps.length}
          </span>
        </div>
        <button className="btn accent" onClick={() => void resumeTour()}>Resume</button>
        <button className="btn" onClick={() => void startTour(t.id)}>Start over</button>
        <button className="btn ghost" onClick={() => setHidden(true)}>Not now</button>
      </div>
    );
  }
  if (welcomed) return null;
  return (
    <div className="welcome learn-exempt" role="dialog" aria-label="Welcome">
      <IconGraduation size={26} />
      <div className="welcome-text">
        <b>New to making music?</b>
        <span>Take the five-minute guided lesson: you will build, mix and save your first track using the real controls.</span>
      </div>
      <button className="btn accent" onClick={() => void startTour('first-mix')}>Start the lesson</button>
      <button className="btn ghost" onClick={dismiss}>Explore on my own</button>
    </div>
  );
}
