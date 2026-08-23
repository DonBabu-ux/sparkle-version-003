import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shield, Globe } from 'lucide-react';
import { getPublicLegalDocuments } from '../config/legalDocuments';

interface FooterProps {
  className?: string;
  compact?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ className = '', compact = false }) => {
  const publicDocs = getPublicLegalDocuments();

  if (compact) {
    return (
      <footer className={`py-4 px-4 border-t border-slate-800/40 text-center text-xs text-slate-500 ${className}`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-500" />
            <span className="font-bold text-slate-300">Sparkle</span>
            <span className="text-[10px] text-slate-500 font-medium">© {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            {publicDocs.map(doc => (
              <Link
                key={doc.id}
                to={`/legal/${doc.id}`}
                className="text-slate-400 hover:text-pink-400 transition-colors text-xs"
              >
                {doc.title.replace('Sparkle ', '').replace(' Policies', '')}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`bg-slate-950 border-t border-slate-800/80 py-10 px-6 text-slate-400 ${className}`}>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Column 1: Brand */}
        <div className="space-y-3 md:col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <span className="font-bold text-lg text-white tracking-wide">Sparkle</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20 inline-flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Kenya Edition
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            The vibrant community network for students, creators, and professionals. Connect, share, and bloom with your people.
          </p>
        </div>

        {/* Column 2: Legal & Governance */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-pink-400" />
            Legal & Compliance
          </h4>
          <ul className="space-y-1.5 text-xs">
            {publicDocs.map(doc => (
              <li key={doc.id}>
                <Link
                  to={`/legal/${doc.id}`}
                  className="hover:text-pink-400 transition-colors inline-block py-0.5"
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: Quick Navigation */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Navigation</h4>
          <ul className="space-y-1.5 text-xs">
            <li><Link to="/about" className="hover:text-pink-400 transition-colors">About Sparkle</Link></li>
            <li><Link to="/help" className="hover:text-pink-400 transition-colors">Help Center</Link></li>
            <li><Link to="/support" className="hover:text-pink-400 transition-colors">Support & Safety</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Sparkle Platform. All official policies are governed by the registered documents.</p>
        <p className="text-[11px]">Official Documents Source: Kenya Edition</p>
      </div>
    </footer>
  );
};

export default Footer;
