import React from 'react';
import { Input, Select } from '../../ui';
import { BilingualField, Field } from '../Field';
import FormSection from '../FormSection';
import ImageUpload, { type Uploader } from '../ImageUpload';
import type { FieldErrors } from '../serverErrors';
import { GROUPS, type Group, type MemberForm } from './teamModel';

interface Props {
  form: MemberForm;
  errors: FieldErrors;
  patch: (p: Partial<MemberForm>) => void;
  upload: Uploader;
  onBusyChange: (busy: boolean) => void;
}

const MemberFormFields: React.FC<Props> = ({ form, errors, patch, upload, onBusyChange }) => (
  <>
    <FormSection
      id="tm-person"
      title="The person"
      description="Shown on the Team page and in the team strip on the homepage. Arabic visitors see the Arabic text."
    >
      <ImageUpload
        id="tm-photo"
        label="Photo"
        value={form.photo_path || null}
        onChange={p => patch({ photo_path: p ?? '' })}
        upload={upload}
        onBusyChange={onBusyChange}
        aspect="aspect-[4/5]"
        frameClassName="max-w-[10rem]"
        hint="Portrait (4:5). Without a photo the site shows their initials."
        error={errors.photo_path}
        emptyLabel="Drop a portrait"
      />
      <BilingualField
        id="tm-name"
        label="Name"
        required
        en={form.name_en}
        ar={form.name_ar}
        onChange={v => patch({ ...(v.en !== undefined && { name_en: v.en }), ...(v.ar !== undefined && { name_ar: v.ar }) })}
        error={errors.name}
      />
      <BilingualField
        id="tm-role"
        label="Role"
        required
        en={form.role_en}
        ar={form.role_ar}
        onChange={v => patch({ ...(v.en !== undefined && { role_en: v.en }), ...(v.ar !== undefined && { role_ar: v.ar }) })}
        error={errors.role}
        placeholderEn="e.g. Head of Programmes"
      />
      <BilingualField
        id="tm-bio"
        label="Bio (optional)"
        multiline
        rows={4}
        en={form.bio_en}
        ar={form.bio_ar}
        onChange={v => patch({ ...(v.en !== undefined && { bio_en: v.en }), ...(v.ar !== undefined && { bio_ar: v.ar }) })}
        error={errors.bio}
        hint="Two or three sentences. Shown under the name on the Team page."
      />
    </FormSection>

    <FormSection id="tm-place" title="Where they appear">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          id="tm-group"
          label="Group"
          error={errors.group}
          hint={GROUPS.find(g => g.value === form.group)?.blurb}
        >
          {c => (
            <Select {...c} value={form.group} onChange={e => patch({ group: e.target.value as Group })}>
              {GROUPS.map(g => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          id="tm-linkedin"
          label="LinkedIn (optional)"
          error={errors.linkedin_url}
          hint="Adds a LinkedIn link under their card."
        >
          {c => (
            <Input
              {...c}
              type="url"
              inputMode="url"
              placeholder="https://www.linkedin.com/in/…"
              value={form.linkedin_url}
              onChange={e => patch({ linkedin_url: e.target.value })}
            />
          )}
        </Field>
      </div>
      <p className="text-xs text-muted leading-relaxed">
        Position inside the group is set on the Team list: drag a card or use its arrows. A new person starts last.
      </p>
    </FormSection>
  </>
);

export default MemberFormFields;
