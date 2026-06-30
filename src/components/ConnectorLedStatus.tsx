import { motion } from 'framer-motion';
import type { ConnectorStatus } from '../types';

interface ConnectorLedStatusProps {
  status: ConnectorStatus;
  isH2Hardware?: boolean;
  className?: string;
}

const LED_COLORS: Record<ConnectorStatus, { base: string; glow: string }> = {
  available: { base: 'bg-bc-accent', glow: 'shadow-[0_0_8px_2px_rgba(46,229,157,0.6)]' },
  occupied: { base: 'bg-bc-blue', glow: 'shadow-[0_0_8px_2px_rgba(59,130,246,0.6)]' },
  offline: { base: 'bg-bc-muted', glow: '' },
  reserved: { base: 'bg-bc-warn', glow: 'shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]' },
};

const LED_LABELS: Record<ConnectorStatus, string> = {
  available: 'Bereit',
  occupied: 'Lädt',
  offline: 'Offline',
  reserved: 'Reserviert',
};

export function ConnectorLedStatus({ status, isH2Hardware, className = '' }: ConnectorLedStatusProps) {
  const { base, glow } = LED_COLORS[status];
  const shouldPulse = status === 'available' || status === 'occupied';

  if (!isH2Hardware) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        {shouldPulse ? (
          <motion.div
            className={`h-3 w-3 rounded-full ${base} ${glow}`}
            animate={{
              opacity: [1, 0.5, 1],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: status === 'occupied' ? 1.5 : 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ) : (
          <div className={`h-3 w-3 rounded-full ${base}`} />
        )}
      </div>
      <span className="text-xs text-bc-muted">{LED_LABELS[status]}</span>
    </div>
  );
}
