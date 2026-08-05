import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, X, Check } from 'lucide-react';

interface Props {
  url: string;
  title: string;
  onClose: () => void;
}

const ShareModal: React.FC<Props> = ({ url, title, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl border"
        style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-bold mb-1 text-slate-100">{title}</h2>
        <p className="text-sm text-slate-400 mb-6">Scan the QR code or copy the link below.</p>
        
        <div className="flex justify-center mb-6 bg-white p-4 rounded-xl mx-auto w-fit">
          <QRCodeSVG value={url} size={200} />
        </div>
        
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            value={url} 
            readOnly 
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-slate-300 outline-none"
            onClick={e => e.currentTarget.select()}
          />
          <button 
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#0ABFBC]/20 text-[#0ABFBC] border border-[#0ABFBC]/30 hover:bg-[#0ABFBC]/30'}`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
