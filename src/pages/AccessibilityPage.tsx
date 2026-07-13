import { Eye, LayoutGrid, RotateCcw, Type, Wind } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAppStore } from '../store/appStore';
import { FONT_SCALE_LABELS, type FontScale } from '../types/a11y';

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: typeof Type;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-bc-border bg-bc-elevated p-4">
      <Icon className="mt-0.5 h-6 w-6 shrink-0 text-bc-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-bc-text">{title}</p>
        <p className="mt-1 text-sm text-bc-muted leading-relaxed">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-6 w-6 shrink-0 accent-bc-accent"
        role="switch"
        aria-checked={checked}
      />
    </label>
  );
}

export function AccessibilityPage() {
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();
  const {
    prefs,
    setFontScale,
    setHighContrast,
    setSimpleMode,
    setReduceMotion,
    resetPrefs,
  } = useAccessibility();

  const scales: FontScale[] = ['normal', 'large', 'xlarge'];

  return (
    <div className="page-shell">
      <button
        type="button"
        onClick={() => navigate(user ? '/profil' : '/karte')}
        className="text-sm text-bc-accent"
      >
        ← Zurück
      </button>
      <h1 className="mt-4 font-display text-2xl font-bold text-bc-text">Barrierefreiheit</h1>
      <p className="mt-2 text-sm text-bc-muted leading-relaxed">
        Passen Sie Schrift, Kontrast und Übersichtlichkeit an. Die Einstellungen werden auf diesem Gerät
        gespeichert.
      </p>

      <section className="mt-8" aria-labelledby="a11y-font-heading">
        <h2 id="a11y-font-heading" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Type className="h-5 w-5 text-bc-accent" aria-hidden />
          Schriftgröße
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {scales.map((scale) => (
            <button
              key={scale}
              type="button"
              onClick={() => setFontScale(scale)}
              className={`rounded-xl border px-2 py-3 text-sm font-medium transition ${
                prefs.fontScale === scale
                  ? 'border-bc-accent bg-bc-accent/15 text-bc-accent'
                  : 'border-bc-border bg-bc-elevated text-bc-muted hover:text-bc-text'
              }`}
              aria-pressed={prefs.fontScale === scale}
            >
              {FONT_SCALE_LABELS[scale]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-bc-muted" aria-live="polite">
          Aktuell: {FONT_SCALE_LABELS[prefs.fontScale]}
        </p>
      </section>

      <section className="mt-8 space-y-3" aria-labelledby="a11y-options-heading">
        <h2 id="a11y-options-heading" className="sr-only">
          Weitere Optionen
        </h2>
        <ToggleRow
          icon={Eye}
          title="Hoher Kontrast"
          description="Stärkere Farben und Kanten – besser lesbar bei Sehschwäche oder hellem Umgebungslicht."
          checked={prefs.highContrast}
          onChange={setHighContrast}
        />
        <ToggleRow
          icon={LayoutGrid}
          title="Einfache Ansicht"
          description="Weniger Elemente auf der Startseite, größere Schaltflächen, Fokus auf Laden und Stationen."
          checked={prefs.simpleMode}
          onChange={setSimpleMode}
        />
        <ToggleRow
          icon={Wind}
          title="Bewegungen reduzieren"
          description="Weniger Animationen und Übergänge – hilfreich bei Schwindel oder Unruhe."
          checked={prefs.reduceMotion}
          onChange={setReduceMotion}
        />
      </section>

      <button
        type="button"
        onClick={resetPrefs}
        className="btn-secondary mt-8 flex w-full items-center justify-center gap-2"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        Standard wiederherstellen
      </button>

      <p className="mt-6 text-xs text-bc-muted leading-relaxed">
        Hinweis: Für Screenreader nutzen Sie die System-Einstellungen Ihres Geräts. Bei Fragen:{' '}
        <Link to="/hilfe" className="text-bc-accent">
          Support
        </Link>
        .
      </p>
    </div>
  );
}
