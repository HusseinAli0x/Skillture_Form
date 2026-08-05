import React, { useEffect, useState } from 'react';
import { ArrowRight, Gamepad2, LayoutDashboard, LogIn, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { Button, Spinner } from '../components/ui';

interface HomepageContent {
  hero_title: string;
  hero_subtitle: string;
  cta_primary_text: string;
  cta_secondary_text: string;
}

interface HomepageImage {
  file_path: string;
  is_active: boolean;
  alt_text?: string;
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState<HomepageContent | null>(null);
  const [image, setImage] = useState<HomepageImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contentRes, imageRes] = await Promise.all([
          client.get<HomepageContent>('/api/v1/homepage'),
          client.get<HomepageImage[]>('/api/v1/homepage/images'),
        ]);
        setContent(contentRes.data);

        const images = imageRes.data || [];
        // file_path is root-relative (/uploads/...). nginx proxies /uploads/
        // to the backend in production and Vite proxies it in dev, so no
        // origin prefix is needed — VITE_API_URL was never defined anywhere
        // and produced src="undefined/uploads/...".
        setImage(images.find(img => img.is_active) ?? images[0] ?? null);
      } catch (err) {
        console.error('Failed to load homepage content', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text font-sans selection:bg-primary/30">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-success flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-bg" />
            </div>
            <span className="font-bold text-lg tracking-tight text-text">Skillture</span>
          </div>
          <div className="flex items-center gap-4">
            <Button size="sm" onClick={() => navigate('/play')} className="!rounded-full">
              <Gamepad2 className="w-4 h-4" />
              Join Game
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              <LogIn className="w-4 h-4" />
              Admin Login
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Decorative background glows. */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[300px] bg-info/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="text-center lg:text-left space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hover-overlay-strong border border-border text-sm font-medium text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Introducing Skillture 2.0
              </div>

              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-text leading-[1.1]">
                {content?.hero_title || 'Build Smarter Assessments'}
              </h1>

              <p className="text-lg lg:text-xl text-muted max-w-2xl mx-auto lg:mx-0">
                {content?.hero_subtitle ||
                  'Create forms and live quizzes that engage your audience seamlessly. Built for scale, designed for simplicity.'}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <Button
                  size="lg"
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto !px-8 !py-3.5"
                >
                  {content?.cta_primary_text || 'Get Started'}
                  <ArrowRight className="w-5 h-5" />
                </Button>
                {/* This CTA has never had a destination — the homepage editor
                    sets its label but no target. Left inert rather than
                    guessed at; it needs a product decision. */}
                <Button variant="secondary" size="lg" className="w-full sm:w-auto !px-8 !py-3.5">
                  {content?.cta_secondary_text || 'Learn More'}
                </Button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border aspect-[4/3] bg-bg/40">
                {image ? (
                  <img
                    src={image.file_path}
                    alt={image.alt_text || ''}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
                    <LayoutDashboard className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-sm font-medium">Dashboard Preview</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-bg via-transparent to-transparent opacity-60" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
