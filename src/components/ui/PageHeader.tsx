import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useT } from '@/i18n';

interface PageHeaderProps {
  title: string;
  description?: string;
  backTo: string;
  action?: ReactNode;
}

export default function PageHeader({ title, description, backTo, action }: PageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useT();

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        aria-label={t('common.back')}
        className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm leading-5 text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
