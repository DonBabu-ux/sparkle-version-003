/*
 * ============================================================================
 * SPARKLE LEGAL DOCUMENT RENDERING & AUTHENTICITY NOTICE
 * ============================================================================
 * CRITICAL INSTRUCTION FOR ALL FUTURE AI AGENTS, DEVELOPERS, AND MAINTAINERS:
 *
 * 1. DO NOT DELETE, REMOVE, OR WEAKEN ANY LEGAL PROVISION, SECTION, CLAUSE, OR
 *    DISCLOSURE PRESENT IN SPARKLE LEGAL DOCUMENTS.
 *
 * 2. ANY AMENDMENT, ADDITION, OR UPDATE MUST PRESERVE THE COMPLETE HISTORICAL
 *    RECORD, REVISE THE VERSION NUMBER, UPDATE THE EFFECTIVE DATE, RECALCULATE
 *    THE CANONICAL SHA-256 INTEGRITY HASH, AND LOG THE REVISION IN THE AUDIT TRAIL.
 *
 * 3. NATIVE RENDERING MUST REMAIN THE PRIMARY FORM OF DISPLAY. EMBEDDED PDF
 *    IFRAMES OR EXTERNAL PDF VIEWERS MUST NOT REPLACE NATIVE WEB EXPERIENCES.
 *    PDFS REMAIN DOWNLOADABLE COPIES ONLY.
 *
 * 4. THE DOCUMENT WATERMARK, EMBLEM, METADATA BANNER, INTEGRITY HASH, AND
 *    OFFICIAL FOOTER MUST REMAIN VISIBLE AND UNALTERED ACROSS ALL BREAKPOINTS
 *    AND COLOR THEMES (LIGHT AND DARK MODES).
 *
 * 5. THE LEGAL CLARIFICATION AND COMPLAINT SUBMISSION PIPELINE, INCLUDING
 *    SECTION REFERENCE LINKING AND REFERENCE NUMBER GENERATION, MUST REMAIN
 *    FULLY OPERATIONAL.
 *
 * FAILURE TO COMPLY WITH THESE DIRECTIVES VOIDS DOCUMENT INTEGRITY CHECKS AND
 * CONSTITUTES AN UNAUTHORIZED MODIFICATION OF COMPLIANCE INFRASTRUCTURE.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  Search,
  ChevronRight,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';

import {
  ALL_LEGAL_DOCUMENTS,
  getLegalDocById,
  type CanonicalLegalDocument
} from '../data/legal';

import { LegalWatermark } from '../components/legal/LegalWatermark';
import { LegalHeader } from '../components/legal/LegalHeader';
import { LegalMetadataBanner } from '../components/legal/LegalMetadataBanner';
import { LegalTableOfContents } from '../components/legal/LegalTableOfContents';
import { LegalSectionRenderer } from '../components/legal/LegalSectionRenderer';
import { LegalClarificationModal } from '../components/legal/LegalClarificationModal';
import { LegalVersionHistoryModal } from '../components/legal/LegalVersionHistoryModal';

export default function LegalViewer() {
  const { documentId } = useParams<{ documentId?: string }>();
  const navigate = useNavigate();

  // Search filter for index page
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [clarificationOpen, setClarificationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [targetSectionRef, setTargetSectionRef] = useState<string>('');

  // Active section tracking for TOC
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  const isDocumentSelected = Boolean(documentId);
  const doc: CanonicalLegalDocument | undefined = documentId
    ? getLegalDocById(documentId)
    : undefined;

  // Reset scroll and selection on document switch
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setActiveSectionId('');
  }, [documentId]);

  const handleOpenClarification = (secRef?: string) => {
    setTargetSectionRef(secRef || '');
    setClarificationOpen(true);
  };

  const filteredDocs = ALL_LEGAL_DOCUMENTS.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.shortTitle.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-dvh bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans flex flex-col selection:bg-pink-500 selection:text-white relative">
      {/* Subtle Authenticity Watermark on Native Legal Pages */}
      {doc && (
        <LegalWatermark
          documentId={doc.id}
          version={doc.version}
          sha256Hash={doc.sha256Hash}
        />
      )}

      {/* Header */}
      <LegalHeader
        title={doc ? doc.title : undefined}
        isIndex={!isDocumentSelected}
        downloadUrl={doc ? doc.downloadUrl : undefined}
        onOpenClarification={() => handleOpenClarification()}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">
        {/* =========================================================================
            CASE 1: ROOT LEGAL INDEX (/legal)
            ========================================================================= */}
        {!isDocumentSelected && (
          <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
            {/* Clean Hero Header with Pink Badge */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                <ShieldCheck className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                Official Compliance Documentation (Kenya Edition)
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                Sparkle Legal &amp; Policy Centre
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
                Review the authoritative legal framework, terms of use, privacy policies, community standards, and intellectual property notices governing Sparkle.
              </p>
            </div>

            {/* Search and Track Quick Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search legal documents by topic or clause..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                />
              </div>

              <button
                onClick={() => handleOpenClarification()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/60 border border-pink-200 dark:border-pink-800/80 transition-colors shrink-0 shadow-xs"
              >
                <HelpCircle className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                <span>Question or Clarify a Provision</span>
              </button>
            </div>

            {/* Document Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDocs.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/legal/${item.id}`)}
                  className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-pink-400 dark:hover:border-pink-600/60 rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-pink-50 dark:bg-pink-950/50 flex items-center justify-center text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform shadow-xs">
                        <FileText className="w-4.5 h-4.5" />
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60">
                        {item.jurisdiction}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                    <div className="text-[11px]">
                      <span className="font-bold text-pink-600 dark:text-pink-400">
                        v{item.version}
                      </span>
                      <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">•</span>
                      <span>{item.effectiveDate}</span>
                    </div>

                    <span className="inline-flex items-center gap-1 font-bold text-pink-600 dark:text-pink-400 text-xs group-hover:translate-x-1 transition-transform">
                      Read Document <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {filteredDocs.length === 0 && (
              <div className="text-center py-12 text-zinc-500 text-xs">
                No legal document matched &ldquo;{searchQuery}&rdquo;.
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            CASE 2: SPECIFIC LEGAL DOCUMENT VIEWER (/legal/:documentId)
            ========================================================================= */}
        {isDocumentSelected && doc && (
          <div className="animate-fade-in">
            {/* Top Document Switcher Pills with Pink Accent */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none border-b border-zinc-200 dark:border-zinc-800">
              {ALL_LEGAL_DOCUMENTS.map((item) => {
                const isActive = doc.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/legal/${item.id}`)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-pink-600 text-white font-bold shadow-sm shadow-pink-600/30'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50/50 dark:hover:bg-pink-950/30 border border-transparent hover:border-pink-200 dark:hover:border-pink-900/40'
                    }`}
                  >
                    <span>{item.shortTitle}</span>
                    <span className={`text-[10px] font-mono ${isActive ? 'text-pink-200' : 'text-zinc-400'}`}>
                      v{item.version}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Document Layout: Sidebar TOC + Main Reader Body */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Sticky Table of Contents Sidebar */}
              <LegalTableOfContents
                sections={doc.sections}
                activeSectionId={activeSectionId}
                onSelectSection={(id) => setActiveSectionId(id)}
              />

              {/* Main Reading Column */}
              <div className="flex-1 min-w-0 max-w-4xl">
                {/* Official Metadata Banner */}
                <LegalMetadataBanner
                  title={doc.title}
                  description={doc.description}
                  version={doc.version}
                  effectiveDate={doc.effectiveDate}
                  lastUpdatedDate={doc.lastUpdatedDate}
                  jurisdiction={doc.jurisdiction}
                  publisher={doc.publisher}
                  status={doc.status}
                  sha256Hash={doc.sha256Hash}
                  onOpenHistory={() => setHistoryOpen(true)}
                />

                {/* Render All Numbered Sections */}
                <div className="space-y-4">
                  {doc.sections.map((section) => (
                    <LegalSectionRenderer
                      key={section.id}
                      section={section}
                      onQuestionSection={(ref) => handleOpenClarification(ref)}
                    />
                  ))}
                </div>

                {/* Question a Legal Provision Callout Card at Document End */}
                <div className="mt-14 p-6 sm:p-7 rounded-2xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs">
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-pink-600 dark:text-pink-400 shrink-0" />
                      <span>Question a provision in this document?</span>
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
                      Have a query about interpretation, perceived ambiguity, contradiction, or suggested amendment? Submit a formal inquiry directly to Sparkle Legal.
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenClarification(`General inquiry on ${doc.title}`)}
                    className="px-4 py-2.5 text-xs font-bold rounded-lg bg-pink-600 hover:bg-pink-700 text-white transition-colors shrink-0 flex items-center justify-center gap-1.5 shadow-sm shadow-pink-600/30"
                  >
                    <span>Submit Question</span>
                  </button>
                </div>

                {/* Related Legal Documents Section */}
                {doc.relatedDocumentIds && doc.relatedDocumentIds.length > 0 && (
                  <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 block mb-3.5">
                      Related Legal Policies
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {doc.relatedDocumentIds.map((relId) => {
                        const relDoc = getLegalDocById(relId);
                        if (!relDoc) return null;
                        return (
                          <Link
                            key={relId}
                            to={`/legal/${relId}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-pink-600 dark:hover:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-950/40 border border-zinc-200 dark:border-zinc-800 hover:border-pink-300 dark:hover:border-pink-800 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5 text-pink-500" />
                            <span>{relDoc.shortTitle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            CASE 3: UNKNOWN DOCUMENT PARAMETER (/legal/unknown)
            ========================================================================= */}
        {isDocumentSelected && !doc && (
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center max-w-md mx-auto my-12 space-y-4">
            <AlertTriangle className="w-12 h-12 text-pink-500 mx-auto" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Document Not Found
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              The requested legal document <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-800 dark:text-zinc-200">{documentId}</code> does not exist or has been superseded.
            </p>
            <div>
              <button
                onClick={() => navigate('/legal')}
                className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition-colors shadow-sm shadow-pink-600/30"
              >
                Return to Legal Centre
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Mandatory Restrained Official Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 px-4 text-center text-xs text-zinc-500 relative z-10 bg-white/50 dark:bg-zinc-950/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
          <p>
            Official Sparkle Legal Document {doc ? `| Version ${doc.version}` : ''} | sparkleweb.app
          </p>
          <p>© {new Date().getFullYear()} Sparkle Technologies (Kenya). All Rights Reserved.</p>
        </div>
      </footer>

      {/* Floating Action Button for Legal Clarification */}
      {isDocumentSelected && doc && (
        <button
          onClick={() => handleOpenClarification()}
          className="fixed bottom-6 right-6 z-30 px-4 py-3 rounded-full bg-pink-600 text-white shadow-xl shadow-pink-600/30 hover:bg-pink-700 active:scale-95 transition-all flex items-center gap-2 text-xs font-bold"
          title="Question or clarify a legal provision"
          aria-label="Question legal provision"
        >
          <HelpCircle className="w-4.5 h-4.5" />
          <span>Clarify Provision</span>
        </button>
      )}

      {/* Legal Clarification Submission Modal */}
      <LegalClarificationModal
        isOpen={clarificationOpen}
        onClose={() => setClarificationOpen(false)}
        initialDocumentId={doc?.id || 'terms'}
        initialSectionReference={targetSectionRef}
      />

      {/* Legal Version History Modal */}
      {doc && (
        <LegalVersionHistoryModal
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          documentTitle={doc.title}
          versionHistory={doc.versionHistory}
        />
      )}
    </div>
  );
}
