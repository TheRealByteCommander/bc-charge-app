import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { useLocale } from '../i18n/LocaleContext';
import {
  addStationCheckIn,
  checkInStatusLabels,
  getCheckInsForStation,
  getStationReliabilitySummary,
  type CheckInStatus,
} from '../services/stationCheckIn';
import { formatRelative } from '../utils/format';

const STATUSES: CheckInStatus[] = ['available', 'charging_ok', 'busy', 'broken'];

export function StationCheckInSheet({
  open,
  onClose,
  stationId,
  stationName,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  stationId: string;
  stationName: string;
  onSubmitted?: () => void;
}) {
  const { locale } = useLocale();
  const de = locale === 'de';
  const [status, setStatus] = useState<CheckInStatus>('available');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const summary = getStationReliabilitySummary(stationId);
  const recent = getCheckInsForStation(stationId).slice(0, 3);

  const submit = () => {
    addStationCheckIn({ stationId, status, note: note.trim() || undefined });
    setDone(true);
    setNote('');
    onSubmitted?.();
  };

  const handleClose = () => {
    setDone(false);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={de ? 'Check-in' : 'Check-in'}
    >
      <p className="text-sm text-bc-muted">
        {de
          ? `Kurz melden, wie es an „${stationName}“ gerade aussieht — hilft anderen Fahrern.`
          : `Quickly report how “${stationName}” looks right now — helps other drivers.`}
      </p>

      <div className="mt-3 rounded-xl border border-bc-border bg-bc-surface/60 px-3 py-2 text-xs text-bc-muted">
        <span className="font-medium text-bc-text">{de ? summary.labelDe : summary.labelEn}</span>
        {summary.last7d > 0 && (
          <span className="ml-2">
            · {summary.last7d} {de ? 'in 7 Tagen' : 'in 7 days'}
          </span>
        )}
      </div>

      {done ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-bc-accent" />
          <p className="font-display text-lg font-semibold text-bc-text">
            {de ? 'Danke für deinen Check-in!' : 'Thanks for your check-in!'}
          </p>
          <button type="button" className="btn-primary mt-2 w-full" onClick={handleClose}>
            {de ? 'Fertig' : 'Done'}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {STATUSES.map((s) => {
              const label = checkInStatusLabels[s][de ? 'de' : 'en'];
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${
                    active
                      ? 'border-bc-accent bg-bc-accent/15 text-bc-accent'
                      : 'border-bc-border bg-bc-elevated text-bc-text hover:border-bc-accent/40'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-bc-muted">
            {de ? 'Notiz (optional)' : 'Note (optional)'}
          </label>
          <textarea
            className="input-field mt-1 min-h-[72px] resize-none"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={de ? 'z. B. nur CCS1 frei, Kaffee geöffnet…' : 'e.g. only CCS1 free, café open…'}
          />

          <button type="button" className="btn-primary mt-4 w-full" onClick={submit}>
            {de ? 'Check-in senden' : 'Submit check-in'}
          </button>

          {recent.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-bc-muted">
                {de ? 'Zuletzt hier' : 'Recent here'}
              </p>
              <ul className="mt-2 space-y-2">
                {recent.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-bc-border/80 bg-bc-surface/40 px-3 py-2 text-xs text-bc-muted"
                  >
                    <span className="font-medium text-bc-text">
                      {checkInStatusLabels[c.status][de ? 'de' : 'en']}
                    </span>
                    <span className="ml-2">{formatRelative(c.createdAt)}</span>
                    {c.note ? <p className="mt-0.5 text-bc-muted/90">{c.note}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}
