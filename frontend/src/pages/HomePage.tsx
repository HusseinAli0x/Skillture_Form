import React, { useEffect, useState } from 'react';
import { ArrowRight, LayoutDashboard, Sparkles, LogIn, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

interface HomepageContent {
  hero_title: string;
  hero_subtitle: string;
  cta_primary_text: string;
  cta_secondary_text: string;
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState<HomepageContent | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contentRes, imageRes] = await Promise.all([
          client.get('/api/v1/homepage'),
          client.get('/api/v1/homepage/images')
        ]);
        setContent(contentRes.data);
        if (imageRes.data && imageRes.data.length > 0) {
          // Use the most recent active image
          const activeImage = imageRes.data.find((img: any) => img.is_active);
          // file_path is root-relative (/uploads/...). nginx proxies /uploads/
          // to the backend in production and Vite proxies it in dev, so no
          // origin prefix is needed — VITE_API_URL was never defined anywhere
          // and produced src="undefined/uploads/...".
          if (activeImage) {
            setImageUrl(activeImage.file_path);
          } else {
            setImageUrl(imageRes.data[0].file_path);
          }
        }
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0ABFBC] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-sans selection:bg-[#0ABFBC]/30">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0ABFBC] to-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Skillture</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/play')}
              className="text-sm font-bold bg-white text-black px-4 py-2 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <Gamepad2 className="w-4 h-4" />
              Join Game
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Admin Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Abstract Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#0ABFBC]/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[300px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            
            {/* Text Content */}
            <div className="text-center lg:text-left space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-slate-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0ABFBC] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0ABFBC]"></span>
                </span>
                Introducing Skillture 2.0
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
                {content?.hero_title || 'Build Smarter Assessments'}
              </h1>
              
              <p className="text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto lg:mx-0">
                {content?.hero_subtitle || 'Create forms and live quizzes that engage your audience seamlessly. Built for scale, designed for simplicity.'}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#0ABFBC] hover:bg-[#09a8a5] text-black font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  {content?.cta_primary_text || 'Get Started'}
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button 
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all flex items-center justify-center gap-2"
                >
                  {content?.cta_secondary_text || 'Learn More'}
                </button>
              </div>
            </div>

            {/* Hero Image / Visual */}
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 aspect-[4/3] bg-black/40">
                {imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt="Hero" 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                    <LayoutDashboard className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-sm font-medium">Dashboard Preview</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-[#0a0a0a] via-transparent to-transparent opacity-60" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
