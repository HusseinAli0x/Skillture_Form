import React, { useEffect, useRef, useState } from 'react';
import { Save, Upload } from 'lucide-react';
import client from '../api/client';
import { useToastStore } from '../context/ToastStore';
import { Button, Card, Input, Label, PageHeader, Textarea } from '../components/ui';

interface HomepageContent {
  hero_title: string;
  hero_subtitle: string;
  cta_primary_text: string;
  cta_secondary_text: string;
}

interface HomepageImage {
  file_path: string;
  is_active: boolean;
}

const HomepageEditor: React.FC = () => {
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [primaryCta, setPrimaryCta] = useState('');
  const [secondaryCta, setSecondaryCta] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useToastStore();

  // Object URLs for the optimistic preview have to be revoked by hand or the
  // blob is held for the lifetime of the document.
  const objectUrlRef = useRef<string | null>(null);
  const showPreview = (url: string, isObjectUrl = false) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = isObjectUrl ? url : null;
    setPreviewUrl(url);
  };

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  useEffect(() => {
    client
      .get<HomepageContent>('/api/v1/homepage')
      .then(res => {
        if (!res.data) return;
        setHeroTitle(res.data.hero_title || '');
        setHeroSubtitle(res.data.hero_subtitle || '');
        setPrimaryCta(res.data.cta_primary_text || '');
        setSecondaryCta(res.data.cta_secondary_text || '');
      })
      .catch(() => addToast('error', 'Failed to load homepage content'));

    client
      .get<HomepageImage[]>('/api/v1/homepage/images')
      .then(res => {
        const images = res.data || [];
        const active = images.find(img => img.is_active) ?? images[0];
        if (active) setPreviewUrl(active.file_path);
      })
      .catch(() => addToast('error', 'Failed to load the hero image'));
  }, [addToast]);

  const handleSaveText = async () => {
    setIsSaving(true);
    try {
      await client.put('/api/v1/homepage', {
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        cta_primary_text: primaryCta,
        cta_secondary_text: secondaryCta,
      });
      addToast('success', 'Homepage content updated successfully');
    } catch {
      addToast('error', 'Failed to update homepage content');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showPreview(URL.createObjectURL(file), true);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await client.post('/api/v1/homepage/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showPreview(res.data.file_path);
      addToast('success', 'Image uploaded successfully');
    } catch {
      addToast('error', 'Failed to upload image');
    } finally {
      setIsUploading(false);
      // Without this, picking the same file again fires no change event.
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homepage Editor"
        description="Customize the content and hero image of your public homepage."
      />

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-text mb-4">Text Content</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="hero-title">Hero Title</Label>
              <Input
                id="hero-title"
                value={heroTitle}
                onChange={e => setHeroTitle(e.target.value)}
                className="!py-2 !px-3"
              />
            </div>
            <div>
              <Label htmlFor="hero-subtitle">Hero Subtitle</Label>
              <Textarea
                id="hero-subtitle"
                rows={3}
                value={heroSubtitle}
                onChange={e => setHeroSubtitle(e.target.value)}
                className="!py-2 !px-3 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary-cta">Primary CTA</Label>
                <Input
                  id="primary-cta"
                  value={primaryCta}
                  onChange={e => setPrimaryCta(e.target.value)}
                  className="!py-2 !px-3"
                />
              </div>
              <div>
                <Label htmlFor="secondary-cta">Secondary CTA</Label>
                <Input
                  id="secondary-cta"
                  value={secondaryCta}
                  onChange={e => setSecondaryCta(e.target.value)}
                  className="!py-2 !px-3"
                />
              </div>
            </div>
            <div className="pt-2">
              <Button block onClick={handleSaveText} loading={isSaving}>
                {!isSaving && <Save className="w-4 h-4" />}
                {isSaving ? 'Saving…' : 'Save Text Content'}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-text mb-4">Hero Image</h2>
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-lg border border-border bg-bg overflow-hidden relative">
              {previewUrl ? (
                <img src={previewUrl} alt="Hero preview" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted">
                  No Image Uploaded
                </div>
              )}
            </div>

            <label className="relative block">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="w-full flex justify-center items-center gap-2 py-2.5 rounded-lg border border-border bg-hover-overlay-strong text-text font-medium transition-colors pointer-events-none">
                <Upload className="w-4 h-4" />
                {isUploading ? 'Uploading…' : 'Upload New Image'}
              </span>
            </label>
            <p className="text-xs text-muted text-center mt-2">Recommended size: 1200x900px</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HomepageEditor;
