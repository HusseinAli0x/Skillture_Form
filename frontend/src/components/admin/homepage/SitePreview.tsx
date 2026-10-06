import React from 'react';

/**
 * A small stand-in for how a section reads on the public site: white surface,
 * black ink, display type. It re-points the colour tokens with the `site` class
 * the public pages use, so what you see here is what visitors get, in miniature.
 */
const SitePreview: React.FC<{ label?: string; children: React.ReactNode }> = ({
  label = 'Preview · English page',
  children,
}) => (
  <figure className="m-0 min-w-0">
    <figcaption className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">{label}</figcaption>
    <div className="site rounded-lg border border-border-strong overflow-hidden">
      <div className="p-5 min-h-24">{children}</div>
    </div>
  </figure>
);

export default SitePreview;

/** Greyed placeholder for an empty field, so the preview never collapses. */
export const Blank: React.FC<{ text: string }> = ({ text }) => <span className="text-muted italic">{text}</span>;
