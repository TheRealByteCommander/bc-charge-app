import { Car, CheckCircle2, ChevronRight, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UserProfile } from '../types';

interface ChargingSetupChecklistProps {
  user: UserProfile;
  returnTo?: string;
}

export function ChargingSetupChecklist({ user, returnTo }: ChargingSetupChecklistProps) {
  const hasVehicle = user.vehicles.length > 0;
  const hasPayment = user.paymentMethods.length > 0;
  const ready = hasVehicle && hasPayment;

  if (ready) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-bc-accent/30 bg-bc-accent/10 px-4 py-3 text-sm text-bc-accent">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Bereit zum Laden – Fahrzeug und Zahlung sind hinterlegt.
      </div>
    );
  }

  const returnParam = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';

  const steps = [
    {
      id: 'vehicle',
      done: hasVehicle,
      icon: Car,
      title: 'Fahrzeug hinterlegen',
      hint: 'Damit wir Ladeleistung und Verbrauch zuordnen können.',
      to: `/fahrzeuge${returnParam}`,
    },
    {
      id: 'payment',
      done: hasPayment,
      icon: CreditCard,
      title: 'Zahlungsmethode hinterlegen',
      hint: 'Für die Abrechnung nach dem Ladevorgang.',
      to: `/zahlung${returnParam}`,
    },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-bc-warn/30 bg-bc-warn/10 p-4">
      <p className="text-sm font-semibold text-bc-warn">Noch {steps.filter((s) => !s.done).length} Schritt(e) bis zum Laden</p>
      <ul className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.id}>
            {step.done ? (
              <div className="flex items-center gap-2 text-sm text-bc-accent">
                <CheckCircle2 className="h-4 w-4" />
                {step.title}
              </div>
            ) : (
              <Link
                to={step.to}
                className="flex items-center gap-3 rounded-xl border border-bc-border bg-bc-elevated p-3 transition hover:border-bc-accent/40"
              >
                <step.icon className="h-5 w-5 shrink-0 text-bc-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-bc-muted">{step.hint}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-bc-muted" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
