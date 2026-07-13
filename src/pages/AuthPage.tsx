import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { LegalFooterLinks } from '../components/LegalPageLayout';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';

export function LoginPage() {
  const { t } = useLocale();
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
      else setError(res.error ?? t.errors.invalidCredentials);
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
      <h1 className="mt-10 font-display text-2xl font-bold">{t.auth.login}</h1>
      <p className="mt-2 text-bc-muted">{t.auth.loginSubtitle}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-bc-muted">{t.auth.email}</label>
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
          <label className="mb-1.5 block text-sm text-bc-muted">{t.auth.password}</label>
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
          {loading ? t.auth.loggingIn : t.auth.login}
        </button>
      </form>
      {import.meta.env.DEV && (
        <button type="button" onClick={demoLogin} className="btn-secondary mt-4 w-full" disabled={loading}>
          {t.auth.demoLogin}
        </button>
      )}
      <p className="mt-6 text-center text-sm text-bc-muted">
        {t.auth.noAccount}{' '}
        <Link to="/registrieren" className="font-medium text-bc-accent">
          {t.auth.register}
        </Link>
      </p>
      <LegalFooterLinks className="mt-8" />
    </div>
  );
}

export function RegisterPage() {
  const { t } = useLocale();
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
      setError(t.errors.generic);
      return;
    }
    if (form.password.length < 8) {
      setError(t.errors.generic);
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
      else setError(res.error ?? t.errors.generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10 pb-12">
      <Logo />
      <h1 className="mt-10 font-display text-2xl font-bold">{t.auth.createAccount}</h1>
      <p className="mt-2 text-bc-muted">{t.auth.welcomePoints}</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="reg-firstName" className="mb-1.5 block text-sm text-bc-muted">
              {t.auth.firstName}
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
              {t.auth.lastName}
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
            {t.auth.email}
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
            {t.auth.phone}
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
            {t.auth.passwordHint}
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
              {t.auth.privacyAccept} <span className="text-bc-danger">*</span>
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
              {t.auth.termsAccept} <span className="text-bc-danger">*</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 accent-bc-accent"
            />
            <span className="text-bc-muted">{t.auth.marketingAccept}</span>
          </label>
        </div>

        {error && <p className="text-sm text-bc-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? t.auth.registering : t.auth.register}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-bc-muted">
        {t.auth.alreadyHave}{' '}
        <Link to="/anmelden" className="font-medium text-bc-accent">
          {t.auth.login}
        </Link>
      </p>
      <LegalFooterLinks className="mt-8" />
    </div>
  );
}
