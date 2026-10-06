import React, { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';

interface Props {
  id?: string;
  title: string;
  /** What this section is and where it appears on the public site. */
  description?: React.ReactNode;
  /** Link to the live page this section feeds. */
  viewHref?: string;
  viewLabel?: string;
  /** Right-aligned extras on the heading row (a status chip, a count). */
  aside?: React.ReactNode;
  /** Optional sections can fold away; `defaultOpen` sets the first state. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Keep the section open regardless of the toggle (e.g. it holds an error). */
  forceOpen?: boolean;
  /** Draw the section as a bordered card (page level) or bare (inside a drawer). */
  card?: boolean;
  children: React.ReactNode;
}

const FormSection: React.FC<Props> = ({
  id,
  title,
  description,
  viewHref,
  viewLabel = 'View on site',
  aside,
  collapsible = false,
  defaultOpen = true,
  forceOpen = false,
  card = false,
  children,
}) => {
  const [openState, setOpen] = useState(defaultOpen);
  const open = openState || forceOpen;
  const bodyId = id ? `${id}-body` : undefined;

  const heading = (
    <div className="min-w-0">
      <h2 className="text-base font-bold text-text">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted leading-relaxed max-w-prose">{description}</p>}
    </div>
  );

  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={card ? 'rounded-xl border border-border bg-panel p-5 sm:p-6 scroll-mt-6' : 'scroll-mt-6'}
    >
      <div className="flex items-start justify-between gap-4">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="flex-1 min-w-0 flex items-start gap-3 text-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span id={id ? `${id}-title` : undefined} className="min-w-0">
              {heading}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`w-4 h-4 mt-1.5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        ) : (
          <div id={id ? `${id}-title` : undefined} className="min-w-0">
            {heading}
          </div>
        )}
        <div className="flex items-center gap-3 shrink-0">
          {aside}
          {viewHref && (
            <a
              href={viewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover underline-offset-4 hover:underline"
            >
              {viewLabel}
              <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
      {(!collapsible || open) && (
        <div id={bodyId} className="mt-5 space-y-5">
          {children}
        </div>
      )}
    </section>
  );
};

export default FormSection;
