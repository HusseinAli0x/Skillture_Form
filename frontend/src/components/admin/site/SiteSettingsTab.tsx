import React, { useEffect, useMemo, useRef, useState } from 'react';
import client from '../../../api/client';
import { useSiteStore } from '../../../context/SiteStore';
import { useToastStore } from '../../../context/ToastStore';
import { apiErrorMessage } from '../../../lib/apiError';
import type { SiteSettings } from '../../../lib/siteContent';
import { Input } from '../../ui';
import { Field } from '../Field';
import { FormBanner } from '../AdminStates';
import SaveBar from '../SaveBar';
import { SETTING_FIELDS, settingErrors, settingsChanged, settingsPayload, type SettingErrors } from './siteSettingsModel';

/** The contact email and social links shown on the homepage and in the footer. */
interface Props {
  /** Lets the page raise one "leave without saving?" prompt for all tabs. */
  onDirtyChange?: (dirty: boolean) => void;
}

const SiteSettingsTab: React.FC<Props> = ({ onDirtyChange }) => {
  const saved = useSiteStore(s => s.settings);
  const addToast = useToastStore(s => s.addToast);

  const [values, setValues] = useState<SiteSettings>(saved);
  const [errors, setErrors] = useState<SettingErrors>({});
  const [saving, setSaving] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const dirty = useMemo(() => settingsChanged(saved, values), [saved, values]);

  // Follow the store when the content is refreshed (first load, or a save made
  // on another tab) — but never overwrite what the admin is in the middle of
  // typing. "In the middle of typing" means the form differs from the content it
  // was last synced with, which is not the same as differing from the new
  // content (that is exactly what a refresh with new values looks like).
  const synced = useRef(saved);
  const current = useRef(values);
  current.current = values;
  useEffect(() => {
    if (saved === synced.current) return;
    if (!settingsChanged(synced.current, current.current)) setValues(saved);
    synced.current = saved;
  }, [saved]);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    if (saving || !dirty) return;
    const found = settingErrors(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setBannerError(null);
    try {
      const payload = settingsPayload(values);
      await client.put('/api/v1/admin/site/settings', payload);
      useSiteStore.getState().patchSettings(payload.settings);
      // What is now saved (an emptied email shows its default again).
      synced.current = useSiteStore.getState().settings;
      setValues(synced.current);
      void useSiteStore.getState().load();
      addToast('success', 'Contact details saved. They are live now.');
    } catch (err) {
      const message = apiErrorMessage(err, 'The contact details could not be saved.');
      setBannerError(message);
      addToast('error', `${message} Your edits are still here.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted leading-relaxed">
        Where visitors can reach you. The email appears in the contact section of the homepage and in the footer of every
        page; each link you fill in appears next to it. Leave a link empty to hide it.
      </p>

      <FormBanner message={bannerError} />

      <div className="rounded-xl border border-border bg-panel p-5 space-y-5 max-w-2xl">
        {SETTING_FIELDS.map(f => (
          <Field key={f.key} id={`site-setting-${f.key}`} label={f.label} hint={f.hint} error={errors[f.key]}>
            {control => (
              <Input
                {...control}
                type={f.kind === 'email' ? 'email' : 'url'}
                inputMode={f.kind === 'email' ? 'email' : 'url'}
                autoComplete="off"
                dir="ltr"
                placeholder={f.placeholder}
                value={values[f.key]}
                onChange={e => {
                  setValues(v => ({ ...v, [f.key]: e.target.value }));
                  if (errors[f.key]) setErrors(prev => ({ ...prev, [f.key]: undefined }));
                }}
              />
            )}
          </Field>
        ))}
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        problems={Object.keys(errors).length}
        onSave={save}
        onDiscard={() => {
          setValues(saved);
          setErrors({});
          setBannerError(null);
        }}
      />
    </div>
  );
};

export default SiteSettingsTab;
