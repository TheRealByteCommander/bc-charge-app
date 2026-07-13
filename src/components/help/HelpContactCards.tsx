import { Mail, MapPin, Phone } from 'lucide-react';
import { companyInfo } from '../../data/company';

export function HelpContactCards() {
  return (
    <div className="space-y-4">
      <a
        href={`tel:${companyInfo.phoneTel}`}
        className="flex items-center gap-4 rounded-2xl border border-bc-border bg-bc-elevated p-4 transition hover:border-bc-accent/40"
      >
        <Phone className="h-6 w-6 shrink-0 text-bc-accent" />
        <div>
          <p className="font-medium">Hotline</p>
          <p className="text-sm text-bc-muted">{companyInfo.phoneDisplay}</p>
          <p className="text-xs text-bc-muted">{companyInfo.supportHours}</p>
        </div>
      </a>
      <a
        href={`mailto:${companyInfo.emailSupport}`}
        className="flex items-center gap-4 rounded-2xl border border-bc-border bg-bc-elevated p-4 transition hover:border-bc-accent/40"
      >
        <Mail className="h-6 w-6 shrink-0 text-bc-accent" />
        <div>
          <p className="font-medium">E-Mail</p>
          <p className="text-sm text-bc-accent">{companyInfo.emailSupport}</p>
        </div>
      </a>
      <div className="flex items-start gap-4 rounded-2xl border border-bc-border bg-bc-elevated p-4">
        <MapPin className="h-6 w-6 shrink-0 text-bc-accent" />
        <div>
          <p className="font-medium">{companyInfo.legalName}</p>
          <p className="text-sm text-bc-muted">{companyInfo.street}</p>
          <p className="text-sm text-bc-muted">
            {companyInfo.zip} {companyInfo.city}
          </p>
        </div>
      </div>
    </div>
  );
}
