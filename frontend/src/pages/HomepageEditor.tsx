import React, { useEffect, useState } from 'react';
import { Save, Upload } from 'lucide-react';
import client from '../api/client';
import { useToastStore } from '../context/ToastStore';

const HomepageEditor: React.FC = () => {
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [primaryCta, setPrimaryCta] = useState('');
  const [secondaryCta, setSecondaryCta] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useToastStore();

  useEffect(() => {
    client.get('/api/v1/homepage').then(res => {
      if (res.data) {
        setHeroTitle(res.data.hero_title || '');
        setHeroSubtitle(res.data.hero_subtitle || '');
        setPrimaryCta(res.data.cta_primary_text || '');
        setSecondaryCta(res.data.cta_secondary_text || '');
      }
    });
    client.get('/api/v1/homepage/images').then(res => {
      if (res.data && res.data.length > 0) {
        const activeImg = res.data.find((img: any) => img.is_active) || res.data[0];
        setPreviewUrl(import.meta.env.VITE_API_URL + activeImg.file_path);
      }
    });
  }, []);

  const handleSaveText = async () => {
    setIsSaving(true);
    try {
      await client.put('/api/v1/homepage', {
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        cta_primary_text: primaryCta,
        cta_secondary_text: secondaryCta
      });
      addToast('success', 'Homepage content updated successfully');
    } catch (err) {
      addToast('error', 'Failed to update homepage content');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await client.post('/api/v1/homepage/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      addToast('success', 'Image uploaded successfully');
      setPreviewUrl(import.meta.env.VITE_API_URL + res.data.file_path);
    } catch (err) {
      addToast('error', 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#f0f0f0]">Homepage Editor</h1>
        <p className="mt-1 text-sm text-[#888]">Customize the content and hero image of your public homepage.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Text Content</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[#888]">Hero Title</label>
              <input 
                type="text" 
                value={heroTitle}
                onChange={e => setHeroTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-[#f0f0f0] outline-none focus:border-[#0ABFBC]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[#888]">Hero Subtitle</label>
              <textarea 
                rows={3}
                value={heroSubtitle}
                onChange={e => setHeroSubtitle(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-[#f0f0f0] outline-none focus:border-[#0ABFBC] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[#888]">Primary CTA</label>
                <input 
                  type="text" 
                  value={primaryCta}
                  onChange={e => setPrimaryCta(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-[#f0f0f0] outline-none focus:border-[#0ABFBC]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[#888]">Secondary CTA</label>
                <input 
                  type="text" 
                  value={secondaryCta}
                  onChange={e => setSecondaryCta(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-[#f0f0f0] outline-none focus:border-[#0ABFBC]"
                />
              </div>
            </div>
            <div className="pt-2">
              <button 
                onClick={handleSaveText}
                disabled={isSaving}
                className="w-full flex justify-center items-center gap-2 py-2.5 rounded-lg bg-[#0ABFBC] text-black font-semibold hover:bg-[#09a8a5] transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Text Content'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Hero Image</h2>
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] overflow-hidden relative">
              {previewUrl ? (
                <img src={previewUrl} alt="Hero Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[#888]">
                  No Image Uploaded
                </div>
              )}
            </div>
            
            <div className="relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="w-full flex justify-center items-center gap-2 py-2.5 rounded-lg border border-[#2a2a2a] bg-white/5 text-white font-medium hover:bg-white/10 transition-colors pointer-events-none">
                <Upload className="w-4 h-4" />
                {isUploading ? 'Uploading...' : 'Upload New Image'}
              </div>
            </div>
            <p className="text-xs text-[#888] text-center mt-2">Recommended size: 1200x900px</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomepageEditor;
