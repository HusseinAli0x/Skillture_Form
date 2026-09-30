import React, { useEffect, useRef, useState } from 'react';
import { Save, Upload } from 'lucide-react';
import client from '../api/client';
import { useToastStore } from '../context/ToastStore';
import { Button, Card, Input, Label, PageHeader, Textarea } from '../components/ui';

interface AboutFact {
  id?: string;
  value: string;
  label: string;
}

interface OfferPillar {
  id?: string;
  num: string;
  title: string;
  description: string;
  points: string[];
}

interface HomepageContent {
  hero_kicker: string;
  hero_title: string;
  hero_subtitle: string;
  cta_primary_text: string;
  cta_secondary_text: string;
  about_kicker: string;
  about_title: string;
  about_body1: string;
  about_body2: string;
  about_facts: AboutFact[];
  offer_kicker: string;
  offer_title: string;
  offer_subtitle: string;
  offer_pillars: OfferPillar[];
}

interface HomepageImage {
  file_path: string;
  is_active: boolean;
}

const EMPTY_FACT: AboutFact = { value: '', label: '' };
const EMPTY_PILLAR: OfferPillar = { num: '', title: '', description: '', points: ['', '', ''] };

const HomepageEditor: React.FC = () => {
  // Hero + About + Offer copy — one row, one PUT /homepage.
  const [heroKicker, setHeroKicker] = useState('');
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  // No longer editable here (see the Hero card's comment below) but still
  // read back and re-sent unchanged so saving other Hero fields doesn't wipe
  // out whatever these columns already hold.
  const [primaryCta, setPrimaryCta] = useState('');
  const [secondaryCta, setSecondaryCta] = useState('');
  const [aboutKicker, setAboutKicker] = useState('');
  const [aboutTitle, setAboutTitle] = useState('');
  const [aboutBody1, setAboutBody1] = useState('');
  const [aboutBody2, setAboutBody2] = useState('');
  const [offerKicker, setOfferKicker] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerSubtitle, setOfferSubtitle] = useState('');

  // About Us stat tiles and Offer pillars each have their own full-replace
  // endpoint (see homepage_handler.go) — the layout is a fixed 3/4-slot grid,
  // not an open list, so editing is "fill in the slots" rather than add/remove.
  const [facts, setFacts] = useState<AboutFact[]>([EMPTY_FACT, EMPTY_FACT, EMPTY_FACT]);
  const [pillars, setPillars] = useState<OfferPillar[]>([
    EMPTY_PILLAR,
    EMPTY_PILLAR,
    EMPTY_PILLAR,
    EMPTY_PILLAR,
  ]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSavingText, setIsSavingText] = useState(false);
  const [isSavingFacts, setIsSavingFacts] = useState(false);
  const [isSavingPillars, setIsSavingPillars] = useState(false);
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
        const d = res.data;
        if (!d) return;
        setHeroKicker(d.hero_kicker || '');
        setHeroTitle(d.hero_title || '');
        setHeroSubtitle(d.hero_subtitle || '');
        setPrimaryCta(d.cta_primary_text || '');
        setSecondaryCta(d.cta_secondary_text || '');
        setAboutKicker(d.about_kicker || '');
        setAboutTitle(d.about_title || '');
        setAboutBody1(d.about_body1 || '');
        setAboutBody2(d.about_body2 || '');
        setOfferKicker(d.offer_kicker || '');
        setOfferTitle(d.offer_title || '');
        setOfferSubtitle(d.offer_subtitle || '');
        if (d.about_facts?.length) setFacts(d.about_facts);
        if (d.offer_pillars?.length) {
          // Pad points to 3 so the fixed three-bullet inputs below always
          // have something to bind to, even if a pillar was saved with fewer.
          setPillars(d.offer_pillars.map(p => ({ ...p, points: [0, 1, 2].map(i => p.points[i] || '') })));
        }
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
    setIsSavingText(true);
    try {
      await client.put('/api/v1/homepage', {
        hero_kicker: heroKicker,
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        cta_primary_text: primaryCta,
        cta_secondary_text: secondaryCta,
        about_kicker: aboutKicker,
        about_title: aboutTitle,
        about_body1: aboutBody1,
        about_body2: aboutBody2,
        offer_kicker: offerKicker,
        offer_title: offerTitle,
        offer_subtitle: offerSubtitle,
      });
      addToast('success', 'Homepage content updated successfully');
    } catch {
      addToast('error', 'Failed to update homepage content');
    } finally {
      setIsSavingText(false);
    }
  };

  const updateFact = (i: number, patch: Partial<AboutFact>) =>
    setFacts(prev => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const handleSaveFacts = async () => {
    if (facts.some(f => !f.value.trim() || !f.label.trim())) {
      addToast('error', 'Every stat tile needs a value and a label');
      return;
    }
    setIsSavingFacts(true);
    try {
      await client.put(
        '/api/v1/homepage/facts',
        facts.map(f => ({ value: f.value, label: f.label }))
      );
      addToast('success', 'About Us stats updated successfully');
    } catch {
      addToast('error', 'Failed to update the stat tiles');
    } finally {
      setIsSavingFacts(false);
    }
  };

  const updatePillar = (i: number, patch: Partial<OfferPillar>) =>
    setPillars(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const updatePillarPoint = (i: number, pointIdx: number, text: string) =>
    setPillars(prev =>
      prev.map((p, idx) => (idx === i ? { ...p, points: p.points.map((pt, pi) => (pi === pointIdx ? text : pt)) } : p))
    );

  const handleSavePillars = async () => {
    if (pillars.some(p => !p.title.trim() || !p.description.trim())) {
      addToast('error', 'Every pillar needs a title and a description');
      return;
    }
    setIsSavingPillars(true);
    try {
      await client.put(
        '/api/v1/homepage/pillars',
        pillars.map(p => ({
          num: p.num,
          title: p.title,
          description: p.description,
          points: p.points.filter(pt => pt.trim() !== ''),
        }))
      );
      addToast('success', 'What We Offer pillars updated successfully');
    } catch {
      addToast('error', 'Failed to update the offer pillars');
    } finally {
      setIsSavingPillars(false);
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
        description="Customize the content of your public homepage — hero, About Us, What We Offer, and the hero image."
      />

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-text mb-4">Hero</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="hero-kicker">Kicker (small badge above the title)</Label>
              <Input id="hero-kicker" value={heroKicker} onChange={e => setHeroKicker(e.target.value)} className="!py-2 !px-3" />
            </div>
            <div>
              <Label htmlFor="hero-title">Hero Title</Label>
              <Input id="hero-title" value={heroTitle} onChange={e => setHeroTitle(e.target.value)} className="!py-2 !px-3" />
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
            {/* The hero's two buttons are now fixed by design — "Explore
                Upcoming Workshops" (scrolls to #workshops) and "See a Live
                Session" (/play) — and are translated for Arabic in
                lib/translations.ts rather than admin-edited, so there is no
                CTA text field here any more. */}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-text mb-4">Hero Image</h2>
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-lg border border-border bg-bg overflow-hidden relative">
              {previewUrl ? (
                <img src={previewUrl} alt="Hero preview" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted">No Image Uploaded</div>
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
            {/* The current homepage design (hero + About Us + What We Offer +
                Workshops) has no image slot — uploads land here but nothing on
                the public page shows them until a layout adds one back. */}
            <p className="text-xs text-warning text-center mt-2">
              Not currently shown on the homepage — the live layout has no image slot.
            </p>
          </div>
        </Card>
      </div>

      <div className="flex justify-end -mt-2">
        <Button onClick={handleSaveText} loading={isSavingText}>
          {!isSavingText && <Save className="w-4 h-4" />}
          {isSavingText ? 'Saving…' : 'Save Hero, About & Offer Text'}
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-text mb-1">About Us</h2>
        <p className="text-xs text-muted mb-4">The "Discover" section — copy plus the three stat tiles beside it.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="about-kicker">Kicker</Label>
              <Input id="about-kicker" value={aboutKicker} onChange={e => setAboutKicker(e.target.value)} className="!py-2 !px-3" />
            </div>
            <div>
              <Label htmlFor="about-title">Title</Label>
              <Input id="about-title" value={aboutTitle} onChange={e => setAboutTitle(e.target.value)} className="!py-2 !px-3" />
            </div>
            <div>
              <Label htmlFor="about-body1">Body — paragraph 1</Label>
              <Textarea
                id="about-body1"
                rows={4}
                value={aboutBody1}
                onChange={e => setAboutBody1(e.target.value)}
                className="!py-2 !px-3 resize-none"
              />
            </div>
            <div>
              <Label htmlFor="about-body2">Body — paragraph 2</Label>
              <Textarea
                id="about-body2"
                rows={4}
                value={aboutBody2}
                onChange={e => setAboutBody2(e.target.value)}
                className="!py-2 !px-3 resize-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Stat tiles</Label>
            {facts.map((fact, i) => (
              <div key={fact.id ?? i} className="grid grid-cols-[100px_1fr] gap-2 items-start">
                <Input
                  aria-label={`Stat ${i + 1} value`}
                  placeholder="2,400+"
                  value={fact.value}
                  onChange={e => updateFact(i, { value: e.target.value })}
                  className="!py-2 !px-3"
                />
                <Input
                  aria-label={`Stat ${i + 1} label`}
                  placeholder="Students assessed across cohort programmes"
                  value={fact.label}
                  onChange={e => updateFact(i, { label: e.target.value })}
                  className="!py-2 !px-3"
                />
              </div>
            ))}
            <div className="pt-1">
              <Button block onClick={handleSaveFacts} loading={isSavingFacts}>
                {!isSavingFacts && <Save className="w-4 h-4" />}
                {isSavingFacts ? 'Saving…' : 'Save Stat Tiles'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-text mb-1">What We Offer</h2>
        <p className="text-xs text-muted mb-4">The "Learn" section — copy plus the four pillar cards.</p>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="offer-kicker">Kicker</Label>
            <Input id="offer-kicker" value={offerKicker} onChange={e => setOfferKicker(e.target.value)} className="!py-2 !px-3" />
          </div>
          <div>
            <Label htmlFor="offer-title">Title</Label>
            <Input id="offer-title" value={offerTitle} onChange={e => setOfferTitle(e.target.value)} className="!py-2 !px-3" />
          </div>
        </div>
        <div className="mb-6">
          <Label htmlFor="offer-subtitle">Subtitle</Label>
          <Textarea
            id="offer-subtitle"
            rows={2}
            value={offerSubtitle}
            onChange={e => setOfferSubtitle(e.target.value)}
            className="!py-2 !px-3 resize-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {pillars.map((pillar, i) => (
            <div key={pillar.id ?? i} className="border border-border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-[64px_1fr] gap-2">
                <Input
                  aria-label={`Pillar ${i + 1} number`}
                  placeholder="01"
                  value={pillar.num}
                  onChange={e => updatePillar(i, { num: e.target.value })}
                  className="!py-2 !px-3"
                />
                <Input
                  aria-label={`Pillar ${i + 1} title`}
                  placeholder="Technical"
                  value={pillar.title}
                  onChange={e => updatePillar(i, { title: e.target.value })}
                  className="!py-2 !px-3"
                />
              </div>
              <Textarea
                aria-label={`Pillar ${i + 1} description`}
                rows={2}
                placeholder="Close the distance between coursework and the codebase a team actually ships."
                value={pillar.description}
                onChange={e => updatePillar(i, { description: e.target.value })}
                className="!py-2 !px-3 resize-none"
              />
              <div className="space-y-1.5">
                {pillar.points.map((point, pi) => (
                  <Input
                    key={pi}
                    aria-label={`Pillar ${i + 1} bullet ${pi + 1}`}
                    placeholder={`Bullet point ${pi + 1}`}
                    value={point}
                    onChange={e => updatePillarPoint(i, pi, e.target.value)}
                    className="!py-2 !px-3 !text-sm"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSavePillars} loading={isSavingPillars}>
            {!isSavingPillars && <Save className="w-4 h-4" />}
            {isSavingPillars ? 'Saving…' : 'Save Offer Pillars'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default HomepageEditor;
