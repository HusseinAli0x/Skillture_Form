import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import client from '../../../api/client';
import { useSiteStore } from '../../../context/SiteStore';
import { useToastStore } from '../../../context/ToastStore';
import { apiErrorMessage } from '../../../lib/apiError';
import { IMAGE_SLOTS, imageFor, type ImageSlot } from '../../../lib/siteContent';
import { Button } from '../../ui';
import ImageUpload, { type Uploader } from '../ImageUpload';

/** Square and portrait previews would be huge at the landscape width. */
const previewWidth = (aspectClass: string): string =>
  aspectClass === 'aspect-square' ? 'max-w-[9rem]' : aspectClass === 'aspect-[3/4]' ? 'max-w-[11rem]' : 'max-w-sm';

const uploadSiteImage: Uploader = async file => {
  const body = new FormData();
  body.append('image', file);
  const res = await client.post<{ file_path: string }>('/api/v1/admin/site/image', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.file_path;
};

/**
 * The photographs and logos on the public site. Each one saves the moment it is
 * uploaded (and is live straight away); "Use default" restores the original.
 */
const SiteImagesTab: React.FC = () => {
  const images = useSiteStore(s => s.images);
  const addToast = useToastStore(s => s.addToast);
  const [saving, setSaving] = useState<ImageSlot | null>(null);

  const setSlot = async (slot: ImageSlot, path: string | null) => {
    setSaving(slot);
    try {
      await client.put(`/api/v1/admin/site/images/${slot}`, { path });
      useSiteStore.getState().patchImage(slot, path);
      void useSiteStore.getState().load();
      addToast('success', path ? 'Image updated. It is live now.' : 'Original image restored.');
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'The image could not be saved. Try again.'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted leading-relaxed">
        Replace any photograph or logo on the public site. A new image goes live as soon as it is uploaded. Use the same
        proportions as the original so nothing is cropped awkwardly; the two logos are shown in a single colour, so upload them
        as PNG files with a transparent background.
      </p>

      <ul className="grid gap-5 md:grid-cols-2">
        {IMAGE_SLOTS.map(info => {
          const custom = images[info.slot]?.startsWith('/uploads/') ? images[info.slot] : null;
          return (
            <li key={info.slot} className="rounded-xl border border-border bg-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{info.label}</h3>
                  <p className="mt-0.5 text-xs text-muted">{info.where}</p>
                </div>
                {custom && (
                  <Button variant="ghost" size="sm" disabled={saving === info.slot} onClick={() => void setSlot(info.slot, null)}>
                    <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
                    Use default
                  </Button>
                )}
              </div>
              <div className="mt-4">
                <ImageUpload
                  id={`site-image-${info.slot}`}
                  label={custom ? 'Your image' : 'Original image'}
                  value={imageFor(images, info.slot)}
                  onChange={path => {
                    if (path) void setSlot(info.slot, path);
                  }}
                  upload={uploadSiteImage}
                  aspect={info.aspectClass}
                  frameClassName={previewWidth(info.aspectClass)}
                  fit={info.isLogo ? 'contain' : 'cover'}
                  removable={false}
                  alt={info.label}
                  hint={info.hint}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SiteImagesTab;
