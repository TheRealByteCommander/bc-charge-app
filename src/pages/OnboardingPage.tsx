import { motion } from 'framer-motion';
import { BatteryCharging, Gift, MapPin } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { companyInfo } from '../data/company';
import { useAppStore } from '../store/appStore';

const slides = [
  {
    icon: MapPin,
    title: 'Ladestationen in Sekunden finden',
    text: 'Karte, Filter und Favoriten – alle BC-Charge-Standorte in Sachsen auf einen Blick.',
  },
  {
    icon: BatteryCharging,
    title: 'Laden starten & live verfolgen',
    text: 'Mit Ladepunkt-ID oder Direktwahl: kWh, Kosten und Fortschritt in Echtzeit.',
  },
  {
    icon: Gift,
    title: 'BC Points sammeln',
    text: 'Mit Konto: Prämien, Rabatte und exklusive Vorteile für Stammkunden.',
  },
];

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const complete = useAppStore((s) => s.completeOnboarding);
  const SlideIcon = slides[step].icon;

  const finishAsGuest = () => {
    complete();
    navigate('/karte', { replace: true });
  };

  const finishToLogin = () => {
    complete();
    navigate('/anmelden', { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-12">
      <Logo size="lg" />
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        className="mt-16 flex flex-1 flex-col"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-bc-accent/15 text-bc-accent">
          <SlideIcon className="h-12 w-12" />
        </div>
        <h1 className="mt-8 font-display text-3xl font-bold leading-tight text-bc-text">{slides[step].title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-bc-muted">{slides[step].text}</p>
      </motion.div>
      <div className="flex gap-2">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${i === step ? 'bg-bc-accent' : 'bg-bc-border'}`}
          />
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {step < slides.length - 1 ? (
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={finishAsGuest}>
              Als Gast
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => setStep((s) => s + 1)}>
              Weiter
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="btn-primary w-full" onClick={finishToLogin}>
              Anmelden & laden
            </button>
            <button type="button" className="btn-secondary w-full" onClick={finishAsGuest}>
              Als Gast zur Karte
            </button>
          </>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-bc-muted">
        Ein Angebot der {companyInfo.legalName} · {companyInfo.city} ({companyInfo.region})
      </p>
    </div>
  );
}
