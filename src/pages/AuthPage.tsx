import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAppStore } from '../store/appStore';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAppStore((s) => s.login);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await login(email, password);
    if (res.ok) navigate('/', { replace: true });
    else setError(res.error ?? 'Anmeldung fehlgeschlagen');
  };

  const demoLogin = async () => {
    const res = await login('demo@bc-charge.com', 'demo123');
    if (res.ok) navigate('/', { replace: true });
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
        <button type="submit" className="btn-primary w-full">
          Anmelden
        </button>
      </form>
      {import.meta.env.DEV && (
        <button type="button" onClick={demoLogin} className="btn-secondary mt-4 w-full">
          Demo-Konto testen
        </button>
      )}
      <p className="mt-6 text-center text-sm text-bc-muted">
        Noch kein Konto?{' '}
        <Link to="/registrieren" className="font-medium text-bc-accent">
          Registrieren
        </Link>
      </p>
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
  const [error, setError] = useState('');
  const register = useAppStore((s) => s.register);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) {
      setError('Passwort mindestens 6 Zeichen.');
      return;
    }
    const res = await register(form);
    if (res.ok) navigate('/', { replace: true });
    else setError(res.error ?? 'Registrierung fehlgeschlagen');
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      <Logo />
      <h1 className="mt-10 font-display text-2xl font-bold">Konto erstellen</h1>
      <p className="mt-2 text-bc-muted">Starten Sie mit 250 Willkommens-BC-Points.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            className="input-field"
            placeholder="Vorname"
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            className="input-field"
            placeholder="Nachname"
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
        <input
          type="email"
          className="input-field"
          placeholder="E-Mail"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="tel"
          className="input-field"
          placeholder="Telefon"
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="password"
          className="input-field"
          placeholder="Passwort"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && <p className="text-sm text-bc-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full">
          Registrieren
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-bc-muted">
        Bereits registriert?{' '}
        <Link to="/anmelden" className="font-medium text-bc-accent">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
