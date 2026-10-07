import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { useSiteStore } from '../context/SiteStore';
import { PageHeader, Tabs, type TabItem } from '../components/ui';
import { ListSkeleton, LoadFailed } from '../components/admin/AdminStates';
import { useUnsavedGuard } from '../components/admin/useUnsavedGuard';
import SiteTextTab from '../components/admin/site/SiteTextTab';
import SiteImagesTab from '../components/admin/site/SiteImagesTab';
import SiteSettingsTab from '../components/admin/site/SiteSettingsTab';

type TabId = 'text' | 'images' | 'contact';

const TABS: TabItem<TabId>[] = [
  { id: 'text', label: 'Wording' },
  { id: 'images', label: 'Images & logos' },
  { id: 'contact', label: 'Contact & links' },
];

const isTab = (v: string | null): v is TabId => TABS.some(t => t.id === v);

/**
 * One place to change what the public site says and shows: its wording in both
 * languages, every photograph and logo, and the contact email and social
 * links. Everything saved here is live immediately.
 */
const SiteContentAdmin: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = useSiteStore(s => s.status);
  const tab: TabId = isTab(params.get('tab')) ? (params.get('tab') as TabId) : 'text';

  // The tabs stay mounted, so each reports whether it holds unsaved edits and
  // the page asks once before the admin leaves.
  const [textDirty, setTextDirty] = useState(false);
  const [contactDirty, setContactDirty] = useState(false);
  const { guard } = useUnsavedGuard(textDirty || contactDirty);

  // Make sure the editors start from what the server has, not a stale copy.
  useEffect(() => {
    void useSiteStore.getState().load();
  }, []);

  return (
    <div className="space-y-6">
      {guard}
      <PageHeader
        title="Site content"
        description="Change the wording, photographs, logos and contact details of the public website. Changes go live as soon as you save."
        action={
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
          >
            Open the site <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
          </a>
        }
      />

      <Tabs
        items={TABS}
        value={tab}
        onChange={id => setParams(id === 'text' ? {} : { tab: id }, { replace: true })}
        label="Site content sections"
      />

      {status === 'loading' ? (
        <ListSkeleton rows={5} />
      ) : status === 'failed' ? (
        // Editing without the current content could overwrite it blind.
        <LoadFailed what="the site content" onRetry={() => void useSiteStore.getState().load()} />
      ) : (
        // All three stay mounted so unsaved edits survive switching tabs.
        <>
          <div hidden={tab !== 'text'}>
            <SiteTextTab onDirtyChange={setTextDirty} />
          </div>
          <div hidden={tab !== 'images'}>
            <SiteImagesTab />
          </div>
          <div hidden={tab !== 'contact'}>
            <SiteSettingsTab onDirtyChange={setContactDirty} />
          </div>
        </>
      )}
    </div>
  );
};

export default SiteContentAdmin;
