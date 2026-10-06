import React from 'react';
import { Input, Select } from '../../ui';
import { BilingualField, Field } from '../Field';
import FormSection from '../FormSection';
import GalleryEditor from '../GalleryEditor';
import ImageUpload, { type Uploader } from '../ImageUpload';
import type { FieldErrors } from '../serverErrors';
import { MAX_GALLERY, TRACKS, type Track, type WorkshopForm } from './workshopModel';

interface Props {
  form: WorkshopForm;
  errors: FieldErrors;
  patch: (p: Partial<WorkshopForm>) => void;
  upload: Uploader;
  onBusyChange: (busy: boolean) => void;
  /** Open the "After the event" section on first render. */
  afterOpen: boolean;
}

/** The workshop form body, shared by "New" and "Edit". Sections follow how the public page reads. */
const WorkshopFormFields: React.FC<Props> = ({ form, errors, patch, upload, onBusyChange, afterOpen }) => (
  <>
    <FormSection
      id="ws-basics"
      title="The workshop"
      description="Shown in the Upcoming Workshops list on the homepage and on its own page. Arabic visitors see the Arabic text."
    >
      <ImageUpload
        id="ws-cover"
        label="Cover image"
        value={form.image_path || null}
        onChange={p => patch({ image_path: p ?? '' })}
        upload={upload}
        onBusyChange={onBusyChange}
        aspect="aspect-video"
        hint="16:9 works best. Optional; the list falls back to a plain tile."
        error={errors.image_path}
        emptyLabel="Drop a cover image"
      />
      <BilingualField
        id="ws-title"
        label="Title"
        required
        en={form.title_en}
        ar={form.title_ar}
        onChange={v => patch({ ...(v.en !== undefined && { title_en: v.en }), ...(v.ar !== undefined && { title_ar: v.ar }) })}
        error={errors.title}
        placeholderEn="e.g. Intro to Git and GitHub"
      />
      <BilingualField
        id="ws-desc"
        label="Description"
        required
        multiline
        rows={4}
        en={form.description_en}
        ar={form.description_ar}
        onChange={v =>
          patch({ ...(v.en !== undefined && { description_en: v.en }), ...(v.ar !== undefined && { description_ar: v.ar }) })
        }
        error={errors.description}
        hint="Two or three sentences: what people will do and what they take away."
      />
    </FormSection>

    <FormSection id="ws-when" title="When and where" description="The date decides whether it is listed as upcoming or as a past result.">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="ws-date" label="Date" required error={errors.event_date}>
          {c => <Input {...c} type="date" value={form.event_date} onChange={e => patch({ event_date: e.target.value })} />}
        </Field>
        <Field id="ws-time" label="Time (optional)" error={errors.event_time}>
          {c => <Input {...c} type="time" value={form.event_time} onChange={e => patch({ event_time: e.target.value })} />}
        </Field>
        <Field id="ws-location" label="Location (optional)" error={errors.location}>
          {c => (
            <Input
              {...c}
              value={form.location}
              placeholder="e.g. Main hall, Building B"
              onChange={e => patch({ location: e.target.value })}
            />
          )}
        </Field>
        <Field id="ws-speaker" label="Speaker or host (optional)" error={errors.speaker}>
          {c => <Input {...c} value={form.speaker} onChange={e => patch({ speaker: e.target.value })} />}
        </Field>
        <Field
          id="ws-track"
          label="Track (optional)"
          error={errors.track}
          hint={TRACKS.find(t => t.value === form.track)?.blurb ?? 'Lets visitors filter results on Our Work.'}
        >
          {c => (
            <Select {...c} value={form.track} onChange={e => patch({ track: e.target.value as Track | '' })}>
              <option value="">No track</option>
              {TRACKS.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          id="ws-reg"
          label="Registration link (optional)"
          error={errors.registration_url}
          hint="Adds a Register button to the workshop page."
        >
          {c => (
            <Input
              {...c}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={form.registration_url}
              onChange={e => patch({ registration_url: e.target.value })}
            />
          )}
        </Field>
      </div>
    </FormSection>

    <FormSection
      id="ws-extra"
      title="Extra details"
      description="Anything attendees should know: what to bring, prerequisites, parking."
      collapsible
      defaultOpen={Boolean(form.extra_info_en || form.extra_info_ar)}
    >
      <BilingualField
        id="ws-extra-field"
        label="Additional info"
        multiline
        rows={3}
        en={form.extra_info_en}
        ar={form.extra_info_ar}
        onChange={v =>
          patch({ ...(v.en !== undefined && { extra_info_en: v.en }), ...(v.ar !== undefined && { extra_info_ar: v.ar }) })
        }
        error={errors.extra_info}
      />
    </FormSection>

    <FormSection
      id="ws-after"
      title="After the event"
      description="Results shown on the Our Work page once the date has passed: the numbers, a short recap and photos."
      collapsible
      defaultOpen={afterOpen}
    >
      <Field id="ws-attendees" label="Attendees" error={errors.attendees} hint="Counts toward the total on the homepage.">
        {c => (
          <Input
            {...c}
            type="number"
            min={0}
            inputMode="numeric"
            className="sm:max-w-[12rem]"
            value={form.attendees}
            onChange={e => patch({ attendees: e.target.value })}
          />
        )}
      </Field>
      <BilingualField
        id="ws-outcome"
        label="Outcome headline"
        en={form.outcome_en}
        ar={form.outcome_ar}
        onChange={v =>
          patch({ ...(v.en !== undefined && { outcome_en: v.en }), ...(v.ar !== undefined && { outcome_ar: v.ar }) })
        }
        error={errors.outcome}
        placeholderEn="+34% average quiz score"
        hint="One short line, ideally a real number."
      />
      <BilingualField
        id="ws-recap"
        label="Recap"
        multiline
        rows={4}
        en={form.recap_en}
        ar={form.recap_ar}
        onChange={v =>
          patch({ ...(v.en !== undefined && { recap_en: v.en }), ...(v.ar !== undefined && { recap_ar: v.ar }) })
        }
        error={errors.recap}
      />
      <div>
        <p className="text-xs font-medium mb-1.5 text-muted">
          Photo gallery <span className="text-muted/80">({form.gallery.length}/{MAX_GALLERY})</span>
        </p>
        <GalleryEditor
          value={form.gallery}
          onChange={gallery => patch({ gallery })}
          upload={upload}
          max={MAX_GALLERY}
          onBusyChange={onBusyChange}
        />
        {errors.gallery && (
          <p role="alert" className="mt-1.5 text-xs text-danger">
            {errors.gallery}
          </p>
        )}
      </div>
    </FormSection>
  </>
);

export default WorkshopFormFields;
