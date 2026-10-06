import React from 'react';
import { Link } from 'react-router';
import { ArrowRight, Calendar, Users } from 'lucide-react';
import { Input, Textarea } from '../../ui';
import { Field } from '../Field';
import FormSection from '../FormSection';
import ImageUpload, { type Uploader } from '../ImageUpload';
import PillarsEditor from './PillarsEditor';
import SitePreview, { Blank } from './SitePreview';
import type { Fact, Pillar, RowErrors, TextForm } from './homepageModel';

interface TextProps {
  text: TextForm;
  setText: (patch: Partial<TextForm>) => void;
}

/** Two columns on a wide screen: the fields, and what they look like. */
const WithPreview: React.FC<{ preview: React.ReactNode; children: React.ReactNode }> = ({ preview, children }) => (
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] items-start">
    <div className="space-y-5 min-w-0">{children}</div>
    <div className="lg:sticky lg:top-4">{preview}</div>
  </div>
);

export const HeroSection: React.FC<TextProps> = ({ text, setText }) => (
  <FormSection
    card
    id="hp-hero"
    title="1. Hero"
    description="The first thing visitors read, at the top of the homepage. The two buttons beside it (Our Work, Team) and the join-a-game box are fixed by the design."
    viewHref="/"
  >
    <WithPreview
      preview={
        <SitePreview>
          <h3 className="font-display text-2xl font-bold leading-tight text-balance">
            {text.hero_title.trim() || <Blank text="Hero title" />}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {text.hero_subtitle.trim() || <Blank text="Hero subtitle" />}
          </p>
        </SitePreview>
      }
    >
      <Field id="hp-hero-title" label="Title" hint="The headline. Short and direct reads best.">
        {c => <Input {...c} value={text.hero_title} onChange={e => setText({ hero_title: e.target.value })} />}
      </Field>
      <Field id="hp-hero-subtitle" label="Subtitle" hint="One or two sentences under the headline.">
        {c => <Textarea {...c} rows={3} value={text.hero_subtitle} onChange={e => setText({ hero_subtitle: e.target.value })} />}
      </Field>
    </WithPreview>
  </FormSection>
);

interface TracksProps extends TextProps {
  pillars: Pillar[];
  onPillars: (next: Pillar[]) => void;
  pillarErrors: RowErrors;
  error: string | null;
}

export const TracksSection: React.FC<TracksProps> = ({ text, setText, pillars, onPillars, pillarErrors, error }) => (
  <FormSection
    card
    id="hp-tracks"
    title="2. What we offer"
    description="The grey band below the hero: a short intro on the left, the list of tracks on the right. Order here is the order on the site."
    viewHref="/"
  >
    <WithPreview
      preview={
        <SitePreview>
          <p className="text-sm text-muted leading-relaxed">{text.offer_subtitle.trim() || <Blank text="Intro text" />}</p>
          <ul className="mt-4 border-b border-border">
            {pillars.map(p => (
              <li key={p.key} className="py-3 border-t border-border">
                <h4 className="font-display text-base font-semibold">{p.title.trim() || <Blank text="Track title" />}</h4>
                <p className="mt-1 text-xs text-muted leading-relaxed">{p.description.trim() || <Blank text="Description" />}</p>
              </li>
            ))}
          </ul>
        </SitePreview>
      }
    >
      <Field id="hp-offer-subtitle" label="Intro text" hint="Sits beside the list of tracks.">
        {c => <Textarea {...c} rows={2} value={text.offer_subtitle} onChange={e => setText({ offer_subtitle: e.target.value })} />}
      </Field>
      <div>
        <p className="text-xs font-medium mb-2 text-muted">Tracks</p>
        <PillarsEditor pillars={pillars} onChange={onPillars} errors={pillarErrors} />
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </WithPreview>
  </FormSection>
);

export const AboutSection: React.FC<TextProps> = ({ text, setText }) => (
  <FormSection
    card
    id="hp-about"
    title="3. About"
    description="The story near the bottom of the page, shown above the first four people from the Team list."
    viewHref="/"
  >
    <WithPreview
      preview={
        <SitePreview>
          <h3 className="font-display text-xl font-bold leading-tight">{text.about_title.trim() || <Blank text="About title" />}</h3>
          <p className="mt-3 text-sm leading-relaxed">{text.about_body1.trim() || <Blank text="First paragraph" />}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">{text.about_body2.trim() || <Blank text="Second paragraph" />}</p>
        </SitePreview>
      }
    >
      <Field id="hp-about-title" label="Title">
        {c => <Input {...c} value={text.about_title} onChange={e => setText({ about_title: e.target.value })} />}
      </Field>
      <Field id="hp-about-b1" label="First paragraph" hint="Shown in full-size text.">
        {c => <Textarea {...c} rows={4} value={text.about_body1} onChange={e => setText({ about_body1: e.target.value })} />}
      </Field>
      <Field id="hp-about-b2" label="Second paragraph" hint="Shown in a softer tone beneath the first.">
        {c => <Textarea {...c} rows={4} value={text.about_body2} onChange={e => setText({ about_body2: e.target.value })} />}
      </Field>
    </WithPreview>
  </FormSection>
);

/** The parts of the homepage that are driven from other screens. */
export const ElsewhereSection: React.FC = () => (
  <section aria-labelledby="hp-elsewhere" className="rounded-xl border border-dashed border-border-strong p-5 sm:p-6">
    <h2 id="hp-elsewhere" className="text-base font-bold text-text">
      Also on the homepage
    </h2>
    <p className="mt-1 text-sm text-muted">These parts are filled in from their own screens.</p>
    <div className="mt-4 grid sm:grid-cols-2 gap-3">
      <Link
        to="/admin/workshops"
        className="group flex items-center gap-3 rounded-lg border border-border bg-panel px-4 py-3 hover:border-primary-border transition-colors"
      >
        <Calendar aria-hidden="true" className="w-4 h-4 text-primary shrink-0" />
        <span className="flex-1 text-sm">
          <span className="font-semibold text-text">Results and upcoming workshops</span>
          <span className="block text-xs text-muted">Edited under Workshops</span>
        </span>
        <ArrowRight aria-hidden="true" className="w-4 h-4 text-muted group-hover:text-primary rtl:rotate-180" />
      </Link>
      <Link
        to="/admin/team"
        className="group flex items-center gap-3 rounded-lg border border-border bg-panel px-4 py-3 hover:border-primary-border transition-colors"
      >
        <Users aria-hidden="true" className="w-4 h-4 text-primary shrink-0" />
        <span className="flex-1 text-sm">
          <span className="font-semibold text-text">The team strip</span>
          <span className="block text-xs text-muted">The first four people, edited under Team</span>
        </span>
        <ArrowRight aria-hidden="true" className="w-4 h-4 text-muted group-hover:text-primary rtl:rotate-180" />
      </Link>
    </div>
  </section>
);

interface HiddenProps extends TextProps {
  facts: Fact[];
  onFacts: (next: Fact[]) => void;
  factErrors: RowErrors;
  factsError: string | null;
  upload: Uploader;
  imageUrl: string | null;
  onImage: (path: string) => void;
}

/** Content the API stores but the current design does not render. Kept, never lost. */
export const UnusedSection: React.FC<HiddenProps> = ({
  text,
  setText,
  facts,
  onFacts,
  factErrors,
  factsError,
  upload,
  imageUrl,
  onImage,
}) => (
  <FormSection
    card
    collapsible
    defaultOpen={false}
    forceOpen={Object.keys(factErrors).length > 0 || Boolean(factsError)}
    id="hp-unused"
    title="Saved, but not on the live site"
    description="The current design does not show these. They stay saved with the page, so nothing is lost if a later layout brings them back."
  >
    <div className="grid sm:grid-cols-3 gap-4">
      <Field id="hp-hero-kicker" label="Hero kicker">
        {c => <Input {...c} value={text.hero_kicker} onChange={e => setText({ hero_kicker: e.target.value })} />}
      </Field>
      <Field id="hp-about-kicker" label="About kicker">
        {c => <Input {...c} value={text.about_kicker} onChange={e => setText({ about_kicker: e.target.value })} />}
      </Field>
      <Field id="hp-offer-kicker" label="What we offer kicker">
        {c => <Input {...c} value={text.offer_kicker} onChange={e => setText({ offer_kicker: e.target.value })} />}
      </Field>
    </div>
    <Field id="hp-offer-title" label="What we offer title">
      {c => <Input {...c} value={text.offer_title} onChange={e => setText({ offer_title: e.target.value })} />}
    </Field>
    <div className="grid sm:grid-cols-2 gap-4">
      <Field id="hp-cta1" label="Primary button text">
        {c => <Input {...c} value={text.cta_primary_text} onChange={e => setText({ cta_primary_text: e.target.value })} />}
      </Field>
      <Field id="hp-cta2" label="Secondary button text">
        {c => <Input {...c} value={text.cta_secondary_text} onChange={e => setText({ cta_secondary_text: e.target.value })} />}
      </Field>
    </div>

    <div>
      <p className="text-xs font-medium mb-2 text-muted">About stat tiles</p>
      <div className="space-y-3">
        {facts.map((f, i) => (
          <div key={f.key}>
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <Input
                aria-label={`Stat ${i + 1} value`}
                placeholder="2,400+"
                invalid={Boolean(factErrors[i]) && !f.value.trim()}
                value={f.value}
                onChange={e => onFacts(facts.map((x, xi) => (xi === i ? { ...x, value: e.target.value } : x)))}
              />
              <Input
                aria-label={`Stat ${i + 1} label`}
                placeholder="Students assessed across cohort programmes"
                invalid={Boolean(factErrors[i]) && !f.label.trim()}
                value={f.label}
                onChange={e => onFacts(facts.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))}
              />
            </div>
            {factErrors[i] && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {factErrors[i]}
              </p>
            )}
          </div>
        ))}
      </div>
      {factsError && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {factsError}
        </p>
      )}
    </div>

    <ImageUpload
      id="hp-hero-image"
      label="Hero image"
      value={imageUrl}
      onChange={p => p && onImage(p)}
      upload={upload}
      removable={false}
      aspect="aspect-[4/3]"
      hint="Uploads apply straight away; you do not need to save. The current layout has no image slot, so visitors will not see it yet."
    />
  </FormSection>
);
