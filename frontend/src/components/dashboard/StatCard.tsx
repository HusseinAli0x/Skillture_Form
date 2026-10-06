import React from 'react';
import { ArrowRight } from 'lucide-react';

interface Props {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  /** Accent colour for the icon tile. Defaults to the brand teal. */
  tone?: 'primary' | 'success';
  onClick?: () => void;
}

const tones = {
  primary: 'bg-primary-soft border-primary-border text-primary',
  success: 'bg-success-soft border-success/30 text-success',
};

const StatCard: React.FC<Props> = ({ icon, label, value, tone = 'primary', onClick }) => {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={[
        'rounded-xl border border-border bg-panel p-5 relative overflow-hidden text-left w-full group',
        'transition-colors duration-200',
        onClick ? 'cursor-pointer hover:border-border-strong' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${tones[tone]}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-text">{value}</p>
      {onClick && (
        <span className="flex items-center gap-1 mt-3 text-xs font-medium text-muted">
          View all
          <ArrowRight className="w-3 h-3 text-primary group-hover:translate-x-1 transition-transform" />
        </span>
      )}
    </Wrapper>
  );
};

export default StatCard;
