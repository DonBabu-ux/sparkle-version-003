import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText, ShieldCheck, Download, ExternalLink, ArrowLeft,
  Calendar, Sparkles, Scale, Globe, RefreshCw, ChevronRight, Shield
} from 'lucide-react';
import { getLegalDocument, getPublicLegalDocuments, type LegalDocument } from '../config/legalDocuments';

export default function LegalViewer() {
  const { documentId } = useParams<{ documentId?: string }>();
  const navigate = useNavigate();
  const publicDocs = getPublicLegalDocuments();

  // If documentId parameter is passed in route (/legal/:documentId)
  const isDocumentSelected = Boolean(documentId);
  const doc = documentId ? getLegalDocument(documentId) : undefined;
  const [iframeError, setIframeError] = useState(false);

  const handleSelectDocument = (id: string) => {
    setIframeError(false);
    navigate(`/legal/${id}`);
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* Dynamic Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 px-4 lg:px-8 py-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <button
            onClick={() => isDocumentSelected ? navigate('/legal') : navigate(-1)}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all border border-slate-800"
            title="Go back"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-wide block leading-none">Sparkle</span>
              <span className="text-[10px] text-pink-400 font-semibold tracking-wider uppercase">Legal & Compliance</span>
            </div>
          </Link>
        </div>

        {doc && (
          <div className="flex items-center gap-2">
            <a
              href={doc.file}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/60 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Open PDF</span>
            </a>

            <a
              href={doc.file}
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-semibold shadow-md shadow-pink-500/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 flex flex-col gap-6 relative z-10">
        
        {/* CASE 1: ROOT INDEX PAGE (/legal) */}
        {!isDocumentSelected && (
          <div className="space-y-8 animate-fade-in">
            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/40 border border-slate-800 rounded-3xl p-8 md:p-10 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Scale className="w-48 h-48 text-pink-400" />
              </div>
              <div className="max-w-2xl space-y-3 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Official Legal Documentation
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Sparkle Legal &amp; Policies
                </h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Treat these registered documents as the authoritative source of truth for terms of service, privacy practices, and community guidelines governing Sparkle.
                </p>
              </div>
            </div>

            {/* Document Index Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {publicDocs.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectDocument(item.id)}
                  className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-pink-500/40 rounded-3xl p-6 transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-xl hover:shadow-pink-500/5 relative overflow-hidden"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/10 to-purple-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                        <FileText className="w-6 h-6" />
                      </div>
                      {item.jurisdiction && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {item.jurisdiction}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-lg font-bold text-white group-hover:text-pink-300 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-300">Version {item.version}</p>
                      <p className="text-[11px] text-slate-500">Effective {item.effectiveDate}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 font-bold text-pink-400 group-hover:translate-x-1 transition-transform">
                      View document <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CASE 2: SPECIFIC DOCUMENT VIEWER (/legal/:documentId) */}
        {isDocumentSelected && doc && (
          <div className="flex flex-col gap-4 flex-1 animate-fade-in">
            {/* Document Switcher Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800/60">
              {publicDocs.map((item) => {
                const isActive = doc.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectDocument(item.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      isActive
                        ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/50 text-pink-300 shadow-md shadow-pink-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <FileText className={`w-4 h-4 ${isActive ? 'text-pink-400' : 'text-slate-500'}`} />
                    <span>{item.title}</span>
                    {item.jurisdiction && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        {item.jurisdiction}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Meta Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-white tracking-tight">{doc.title}</h1>
                  {doc.jurisdiction && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      <Globe className="w-3 h-3" />
                      {doc.jurisdiction}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    v{doc.version}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{doc.description}</p>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-pink-400" />
                  <span>Effective: <strong className="text-slate-200">{doc.effectiveDate}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Official Policy</span>
                </div>
              </div>
            </div>

            {/* PDF Viewport */}
            <div className="flex-1 min-h-[600px] lg:min-h-[750px] bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
              {!iframeError ? (
                <iframe
                  src={`${doc.file}#toolbar=1&navpanes=0&scrollbar=1`}
                  className="w-full h-full min-h-[650px] flex-1 border-0"
                  title={doc.title}
                  onError={() => setIframeError(true)}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                  <Scale className="w-16 h-16 text-pink-400 stroke-1" />
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">Preview directly in browser</h3>
                    <p className="text-xs text-slate-400 max-w-md">
                      Your current browser window does not support inline PDF viewing. You can view or download the official document below.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <a
                      href={doc.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold transition-all inline-flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Full Document
                    </a>
                    <a
                      href={doc.file}
                      download
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all inline-flex items-center gap-2 border border-slate-700"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CASE 3: UNKNOWN DOCUMENT PARAMETER (/legal/unknown) */}
        {isDocumentSelected && !doc && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto my-12 space-y-4 shadow-xl">
            <Scale className="w-16 h-16 text-pink-400 mx-auto stroke-1" />
            <h2 className="text-xl font-bold text-white">Legal Document Not Found</h2>
            <p className="text-xs text-slate-400">
              The policy document ID <code className="px-1.5 py-0.5 rounded bg-slate-800 text-pink-400">{documentId}</code> could not be found or is not currently published.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/legal')}
                className="px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold transition-all inline-flex items-center gap-2 shadow-lg shadow-pink-500/20"
              >
                <RefreshCw className="w-4 h-4" />
                View Legal Index
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-900 py-6 px-4 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Sparkle. Official Legal &amp; Policy Documentation (Kenya Edition).</p>
      </footer>
    </div>
  );
}
