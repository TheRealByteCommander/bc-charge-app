import { Camera, ImageIcon, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  addStationReport,
  getReportsForStation,
  reportCategoryLabels,
  type ReportCategory,
} from '../services/community';
import { useLocale } from '../i18n/LocaleContext';

const CATEGORIES: ReportCategory[] = ['defect', 'blocked', 'offline_wrong', 'price_wrong', 'other'];
const MAX_IMAGE_SIZE = 800;
const MAX_FILE_SIZE_MB = 5;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_SIZE) / width);
            width = MAX_IMAGE_SIZE;
          } else {
            width = Math.round((width * MAX_IMAGE_SIZE) / height);
            height = MAX_IMAGE_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CommunityReportForm({ stationId, onSubmitted }: { stationId: string; onSubmitted?: () => void }) {
  const { locale } = useLocale();
  const [category, setCategory] = useState<ReportCategory>('defect');
  const [message, setMessage] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reports = getReportsForStation(stationId);

  const recordCommunityReport = useAppStore((s) => s.recordCommunityReport);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setPhotoError(null);
    
    if (!file.type.startsWith('image/')) {
      setPhotoError(locale === 'de' ? 'Bitte wählen Sie ein Bild aus.' : 'Please select an image file.');
      return;
    }
    
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setPhotoError(locale === 'de' ? `Bild zu groß (max. ${MAX_FILE_SIZE_MB} MB).` : `Image too large (max ${MAX_FILE_SIZE_MB} MB).`);
      return;
    }
    
    try {
      const resized = await resizeImage(file);
      setPhotoBase64(resized);
    } catch {
      setPhotoError(locale === 'de' ? 'Fehler beim Laden des Bildes.' : 'Error loading image.');
    }
  };

  const removePhoto = () => {
    setPhotoBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = () => {
    if (!message.trim()) return;
    addStationReport({ stationId, category, message, photoBase64: photoBase64 ?? undefined });
    recordCommunityReport();
    setMessage('');
    setPhotoBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setDone(true);
    onSubmitted?.();
  };

  return (
    <div className="mt-6 rounded-2xl border border-bc-border bg-bc-elevated p-4">
      <h2 className="font-display font-semibold">
        {locale === 'de' ? 'Community-Meldung' : 'Community report'}
      </h2>
      <p className="mt-1 text-xs text-bc-muted">
        {locale === 'de'
          ? 'Hilft anderen Fahrern und verbessert den PlugScore.'
          : 'Helps other drivers and improves PlugScore.'}
      </p>
      <select
        className="input-field mt-3"
        value={category}
        onChange={(e) => setCategory(e.target.value as ReportCategory)}
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {reportCategoryLabels[c][locale]}
          </option>
        ))}
      </select>
      <textarea
        className="input-field mt-2 min-h-[80px]"
        placeholder={locale === 'de' ? 'Was ist los? (z. B. Kabel defekt)' : 'What is wrong?'}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      
      <div className="mt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        
        {photoBase64 ? (
          <div className="relative">
            <img
              src={photoBase64}
              alt={locale === 'de' ? 'Foto-Vorschau' : 'Photo preview'}
              className="h-32 w-full rounded-xl object-cover"
            />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute right-2 top-2 rounded-full bg-bc-ink/80 p-1.5 text-white transition hover:bg-bc-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-bc-border bg-bc-surface/50 py-4 text-sm text-bc-muted transition hover:border-bc-accent hover:text-bc-accent"
          >
            <Camera className="h-5 w-5" />
            {locale === 'de' ? 'Foto hinzufügen (optional)' : 'Add photo (optional)'}
          </button>
        )}
        
        {photoError && (
          <p className="mt-1 text-xs text-bc-danger">{photoError}</p>
        )}
      </div>
      
      <button type="button" className="btn-primary mt-3 w-full py-2.5 text-sm" onClick={submit}>
        {locale === 'de' ? 'Meldung senden' : 'Submit report'}
      </button>
      {done && (
        <p className="mt-2 text-sm text-bc-accent">
          {locale === 'de' ? 'Danke für Ihre Meldung.' : 'Thanks for your report.'}
        </p>
      )}
      {reports.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-bc-border pt-3">
          {reports.slice(0, 5).map((r) => (
            <li key={r.id} className="text-xs text-bc-muted">
              <div className="flex items-start gap-2">
                {r.photoBase64 && (
                  <img
                    src={r.photoBase64}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-bc-text">{reportCategoryLabels[r.category][locale]}</span>
                  {r.message && <p className="mt-0.5 break-words">{r.message}</p>}
                </div>
                {r.photoBase64 && (
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-bc-accent" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
