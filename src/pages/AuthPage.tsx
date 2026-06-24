import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { LegalFooterLinks } from '../components/LegalPageLayout';
import { useAppStore } from '../store/appStore';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAppStore((s) => s.login);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      if (res.ok) navigate('/', { replace: true });
      else setError(res.error ?? 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await login('demo@bc-charge.com', 'demo123');
      if (res.ok) navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      <Logo />
      <h1 className="mt-10 font-display text-2xl font-bold">Willkommen zurück</h1>
      <p className="mt-2 text-bc-muted">Melden Sie sich an, um zu laden und BC Points zu sammeln.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-bc-muted">E-Mail</label>
          <input
            type="email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-bc-muted">Passwort</label>
          <input
            type="password"
            required
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm text-bc-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Wird angemeldet…' : 'Anmelden'}
        </button>
      </form>
      {import.meta.env.DEV && (
        <button type="button" onClick={demoLogin} className="btn-secondary mt-4 w-full" disabled={loading}>
          Demo-Konto testen
        </button>
      )}
      <p className="mt-6 text-center text-sm text-bc-muted">
        Noch kein Konto?{' '}
        <Link to="/registrieren" className="font-medium text-bc-accent">
          Registrieren
        </Link>
      </p>
      <LegalFooterLinks className="mt-8" />
    </div>
  );
}

export function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAppStore((s) => s.register);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptPrivacy || !acceptTerms) {
      setError('Bitte Datenschutzerklärung und Nutzungsbedingungen bestätigen.');
      return;
    }
    if (form.password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await register({
        ...form,
        acceptPrivacy,
        acceptTerms,
        marketingOptIn,
      });
      if (res.ok) navigate('/', { replace: true });
      else setError(res.error ?? 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10 pb-12">
      <Logo />
      <h1 className="mt-10 font-display text-2xl font-bold">Konto erstellen</h1>
      <p className="mt-2 text-bc-muted">Starten Sie mit 250 Willkommens-BC-Points.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="reg-firstName" className="mb-1.5 block text-sm text-bc-muted">
              Vorname
            </label>
            <input
              id="reg-firstName"
              className="input-field"
              required
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="reg-lastName" className="mb-1.5 block text-sm text-bc-muted">
              Nachname
            </label>
            <input
              id="reg-lastName"
              className="input-field"
              required
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-sm text-bc-muted">
            E-Mail
          </label>
          <input
            id="reg-email"
            type="email"
            className="input-field"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="reg-phone" className="mb-1.5 block text-sm text-bc-muted">
            Telefon
          </label>
          <input
            id="reg-phone"
            type="tel"
            className="input-field"
            required
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-sm text-bc-muted">
            Passwort (min. 8 Zeichen)
          </label>
          <input
            id="reg-password"
            type="password"
            className="input-field"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <div className="space-y-3 rounded-xl border border-bc-border bg-bc-elevated p-3 text-sm">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="mt-0.5 accent-bc-accent"
              required
            />
            <span className="text-bc-muted">
              Ich habe die{' '}
              <Link to="/datenschutz" className="text-bc-accent underline" target="_blank">
                Datenschutzerklärung
              </Link>{' '}
              gelesen. <span className="text-bc-danger">*</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 accent-bc-accent"
              required
            />
            <span className="text-bc-muted">
              Ich akzeptiere die{' '}
              <Link to="/nutzungsbedingungen" className="text-bc-accent underline" target="_blank">
                Nutzungsbedingungen
              </Link>
              . <span className="text-bc-danger">*</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 accent-bc-accent"
            />
            <span className="text-bc-muted">
              Ich möchte optional Werbe-Hinweise zu Aktionen per App-Benachrichtigung erhalten
              (jederzeit widerrufbar).
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-bc-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Konto wird erstellt…' : 'Registrieren'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-bc-muted">
        Bereits registriert?{' '}
        <Link to="/anmelden" className="font-medium text-bc-accent">
          Anmelden
        </Link>
      </p>
      <LegalFooterLinks className="mt-8" />
    </div>
  );
}
