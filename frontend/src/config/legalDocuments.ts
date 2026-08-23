export interface LegalDocument {
  id: string;
  title: string;
  category: 'terms' | 'privacy' | 'community' | 'safety' | 'copyright' | 'other';
  description: string;
  version: string;
  effectiveDate: string;
  file: string;
  routes: string[];
  public: boolean;
  jurisdiction?: string;
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: 'terms',
    title: 'Sparkle General Terms & Conditions',
    category: 'terms',
    description: 'General platform terms of use, account rights, service conditions, and legal agreement.',
    version: '1.0',
    effectiveDate: '2026-08-21',
    file: '/docs/Sparkle_Kenya_General_Terms_and_Conditions_2026-08-21.pdf',
    routes: ['/signup', '/login', '/settings', '/about', '/marketplace'],
    public: true,
    jurisdiction: 'Kenya Edition',
  },
  {
    id: 'privacy',
    title: 'Sparkle Privacy Policy & Platform Policies',
    category: 'privacy',
    description: 'Data handling practices, user privacy rights, security policies, and data protection info.',
    version: '1.0',
    effectiveDate: '2026-08-23',
    file: '/docs/Sparkle_Privacy_and_Platform_Policies_Kenya_2026-08-23.pdf',
    routes: ['/signup', '/login', '/settings', '/messages', '/about'],
    public: true,
    jurisdiction: 'Kenya Edition',
  },
  {
    id: 'community-guidelines',
    title: 'Sparkle Kenya Community Guidelines',
    category: 'community',
    description: 'Community standards, safety rules, prohibited behavior, content principles, and moderation policy.',
    version: '1.0',
    effectiveDate: '2026-08-21',
    file: '/docs/Sparkle_Kenya_Community_Guidelines_2026-08-21-2.pdf',
    routes: ['/moments/create', '/afterglow/create', '/marketplace/report', '/support'],
    public: true,
    jurisdiction: 'Kenya Edition',
  },
];

export function getLegalDocument(id: string): LegalDocument | undefined {
  if (!id) return undefined;
  const cleanId = id.trim().toLowerCase();
  return LEGAL_DOCUMENTS.find(doc => doc.id === cleanId && doc.public);
}

export function getAllLegalDocuments(): LegalDocument[] {
  return LEGAL_DOCUMENTS;
}

export function getPublicLegalDocuments(): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter(doc => doc.public);
}
