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
    text: 'Per QR-Code oder Direktwahl: kWh, Kosten und Ladekurve in Echtzeit.',
  },
  {
    icon: Gift,
    title: 'BC Points sammeln',
    text: 'Jede Ladung bringt Prämien, Rabatte und exklusive Vorteile für Stammkunden.',
  },
];

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const complete = useAppStore((s) => s.completeOnboarding);
  const SlideIcon = slides[step].icon;

  const finish = () => {
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
        <p className="mt-4 text-lg text-bc-muted leading-relaxed">{slides[step].text}</p>
      </motion.div>
      <div className="flex gap-2">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${i === step ? 'bg-bc-accent' : 'bg-bc-border'}`}
          />
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        {step < slides.length - 1 ? (
          <>
            <button type="button" className="btn-secondary flex-1" onClick={finish}>
              Überspringen
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => setStep((s) => s + 1)}>
              Weiter
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary w-full" onClick={finish}>
            Jetzt starten
          </button>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-bc-muted">
        Ein Angebot der {companyInfo.legalName} · {companyInfo.city} ({companyInfo.region})
      </p>
    </div>
  );
}
