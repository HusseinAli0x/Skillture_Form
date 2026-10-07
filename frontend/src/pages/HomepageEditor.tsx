import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import client from '../api/client';
import { useToastStore } from '../context/ToastStore';
import { apiErrorMessage } from '../lib/apiError';
import { PageHeader } from '../components/ui';
import SaveBar from '../components/admin/SaveBar';
import { ListSkeleton, LoadFailed } from '../components/admin/AdminStates';
import { useUnsavedGuard } from '../components/admin/useUnsavedGuard';
import {
  AboutSection,
  ElsewhereSection,
  HeroSection,
  TracksSection,
  UnusedSection,
} from '../components/admin/homepage/HomepageSections';
import {
  EMPTY_TEXT,
  contentToState,
  factErrors as getFactErrors,
  factsPayload,
  pillarErrors as getPillarErrors,
  pillarsPayload,
  sameFacts,
  samePillars,
  sameText,
  type Fact,
  type HomepageContent,
  type HomepageState,
  type Pillar,
  type RowErrors,
  type TextForm,
} from '../components/admin/homepage/homepageModel';

interface HomepageImage {
  file_path: string;
  is_active: boolean;
}

const uploadHeroImage = async (file: File): Promise<string> => {
  const body = new FormData();
  body.append('image', file);
  const res = await client.post<{ file_path: string }>('/api/v1/homepage/images', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.file_path;
};

const EMPTY_STATE: HomepageState = contentToState({});

const HomepageEditor: React.FC = () => {
  // What the server has (updated after each successful save) and what is on screen.
  const [saved, setSaved] = useState<HomepageState>(EMPTY_STATE);
  const [text, setTextState] = useState<TextForm>(EMPTY_TEXT);
  const [facts, setFacts] = useState<Fact[]>(EMPTY_STATE.facts);
  const [pillars, setPillars] = useState<Pillar[]>(EMPTY_STATE.pillars);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rowErrors, setRowErrors] = useState<{ facts: RowErrors; pillars: RowErrors }>({ facts: {}, pillars: {} });
  const [sectionErrors, setSectionErrors] = useState<{ text: string | null; facts: string | null; pillars: string | null }>({
    text: null,
    facts: null,
    pillars: null,
  });
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToastStore();

  const textDirty = !sameText(text, saved.text);
  const factsDirty = !sameFacts(facts, saved.facts);
  const pillarsDirty = !samePillars(pillars, saved.pillars);
  const dirty = textDirty || factsDirty || pillarsDirty;
  const { guard } = useUnsavedGuard(dirty);

  const applyState = useCallback((s: HomepageState) => {
    setSaved(s);
    setTextState(s.text);
    setFacts(s.facts);
    setPillars(s.pillars);
    setRowErrors({ facts: {}, pillars: {} });
    setSectionErrors({ text: null, facts: null, pillars: null });
  }, []);

  const load = useCallback(() => {
    setIsLoading(true);
    setLoadFailed(false);
    const content = client
      .get<HomepageContent>('/api/v1/homepage')
      .then(res => applyState(contentToState(res.data ?? {})));
    // The hero image is optional furniture; its failure must not block the editor.
    const image = client
      .get<HomepageImage[]>('/api/v1/homepage/images')
      .then(res => {
        const images = res.data || [];
        const active = images.find(img => img.is_active) ?? images[0];
        setImageUrl(active ? active.file_path : null);
      })
      .catch(() => undefined);
    return Promise.all([content, image])
      .catch(err => {
        setLoadFailed(true);
        addToast('error', apiErrorMessage(err, 'Failed to load homepage content'));
      })
      .finally(() => setIsLoading(false));
  }, [addToast, applyState]);

  useEffect(() => {
    void load();
  }, [load]);

  const setText = (patch: Partial<TextForm>) => {
    setTextState(t => ({ ...t, ...patch }));
    setSectionErrors(e => ({ ...e, text: null }));
  };

  const handleSave = async () => {
    const fErr = factsDirty ? getFactErrors(facts) : {};
    const pErr = pillarsDirty ? getPillarErrors(pillars) : {};
    setRowErrors({ facts: fErr, pillars: pErr });
    const invalid = Object.keys(fErr).length + Object.keys(pErr).length;
    if (invalid > 0) {
      // Marked inline and counted in the save bar. No toast: it would cover the Save button.
      // Open the hidden section if that is where the problem is, then focus.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    setIsSaving(true);
    setSectionErrors({ text: null, facts: null, pillars: null });
    const failures: string[] = [];
    let nextSaved = saved;

    // Each part has its own endpoint; save the ones that changed and keep the
    // outcome of each separate, so one failure never rolls back or hides another.
    if (textDirty) {
      try {
        await client.put('/api/v1/homepage', text);
        nextSaved = { ...nextSaved, text };
      } catch (err) {
        const m = apiErrorMessage(err, 'The page texts could not be saved.');
        setSectionErrors(e => ({ ...e, text: m }));
        failures.push(m);
      }
    }
    if (pillarsDirty) {
      try {
        await client.put('/api/v1/homepage/pillars', pillarsPayload(pillars));
        nextSaved = { ...nextSaved, pillars };
      } catch (err) {
        const m = apiErrorMessage(err, 'The tracks could not be saved.');
        setSectionErrors(e => ({ ...e, pillars: m }));
        failures.push(m);
      }
    }
    if (factsDirty) {
      try {
        await client.put('/api/v1/homepage/facts', factsPayload(facts));
        nextSaved = { ...nextSaved, facts };
      } catch (err) {
        const m = apiErrorMessage(err, 'The stat tiles could not be saved.');
        setSectionErrors(e => ({ ...e, facts: m }));
        failures.push(m);
      }
    }

    setSaved(nextSaved);
    setIsSaving(false);
    if (failures.length === 0) addToast('success', 'Homepage saved. It is live now.');
    else addToast('error', `${failures[0]} Your edits are still here.`);
  };

  const handleDiscard = () => {
    applyState(saved);
  };

  const errorCount = Object.keys(rowErrors.facts).length + Object.keys(rowErrors.pillars).length;

  return (
    <div className="space-y-6">
      {guard}
      <PageHeader
        title="Homepage"
        description="The text on the public homepage, in the order visitors meet it. Each section shows a preview of what you type; save once at the bottom."
        action={
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
          >
            Open the homepage <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
          </a>
        }
      />

      <p className="rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted leading-relaxed">
        These texts are the <strong className="text-text font-semibold">English</strong> homepage. The Arabic homepage uses
        fixed translations written into the site, so changes here do not appear when a visitor switches to Arabic.
      </p>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : loadFailed ? (
        <LoadFailed what="the homepage content" onRetry={() => void load()} />
      ) : (
        <>
          <HeroSection text={text} setText={setText} />
          {sectionErrors.text && (
            <p role="alert" className="text-sm text-danger -mt-3">
              {sectionErrors.text}
            </p>
          )}
          <TracksSection
            text={text}
            setText={setText}
            pillars={pillars}
            onPillars={p => {
              setPillars(p);
              setRowErrors(r => ({ ...r, pillars: {} }));
              setSectionErrors(e => ({ ...e, pillars: null }));
            }}
            pillarErrors={rowErrors.pillars}
            error={sectionErrors.pillars}
          />
          <AboutSection text={text} setText={setText} />
          <ElsewhereSection />
          <UnusedSection
            text={text}
            setText={setText}
            facts={facts}
            onFacts={f => {
              setFacts(f);
              setRowErrors(r => ({ ...r, facts: {} }));
              setSectionErrors(e => ({ ...e, facts: null }));
            }}
            factErrors={rowErrors.facts}
            factsError={sectionErrors.facts}
            upload={async file => {
              setUploading(true);
              try {
                const path = await uploadHeroImage(file);
                addToast('success', 'Hero image uploaded');
                return path;
              } finally {
                setUploading(false);
              }
            }}
            imageUrl={imageUrl}
            onImage={setImageUrl}
          />
          <SaveBar
            dirty={dirty}
            saving={isSaving}
            busy={uploading}
            problems={errorCount}
            saveLabel="Save homepage"
            onSave={handleSave}
            onDiscard={handleDiscard}
          />
        </>
      )}
    </div>
  );
};

export default HomepageEditor;
