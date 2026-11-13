import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronRight, Search } from 'lucide-react';

interface ArticleSummary {
  id: string;
  title: string;
  summary: string;
  category: string;
  readTime: string;
}

const ARTICLES_BY_CATEGORY: Record<string, { categoryTitle: string; articles: ArticleSummary[] }> = {
  'getting-started': {
    categoryTitle: 'Getting Started',
    articles: [
      { id: 'create-account', title: 'How to create a Sparkle account', summary: 'Complete guide to student registration, email verification, and profile setup.', category: 'getting-started', readTime: '3 min' },
      { id: 'profile-setup', title: 'Setting up your campus profile', summary: 'Add your major, graduation year, bio, and social links.', category: 'getting-started', readTime: '2 min' },
      { id: 'community-guidelines', title: 'Sparkle Community Standards', summary: 'Essential guidelines to keep our student community safe and welcoming.', category: 'getting-started', readTime: '4 min' }
    ]
  },
  'account': {
    categoryTitle: 'Account & Security',
    articles: [
      { id: 'recover-account', title: 'How to recover access to your account', summary: 'Step-by-step instructions for resetting passwords and recovering accounts.', category: 'account', readTime: '3 min' },
      { id: 'manage-privacy', title: 'Managing your privacy and visibility', summary: 'Configure who can message you, view your posts, and see your activity.', category: 'account', readTime: '4 min' },
      { id: 'delete-account', title: 'Suspending or deleting your Sparkle account', summary: 'Understanding Ghost Mode, temporary suspension, and permanent deletion.', category: 'account', readTime: '3 min' }
    ]
  },
  'feed': {
    categoryTitle: 'Home Feed & Posts',
    articles: [
      { id: 'create-post', title: 'Creating engaging posts and polls', summary: 'How to post photos, video clips, thoughts, and campus polls.', category: 'feed', readTime: '2 min' },
      { id: 'create-reel', title: 'How to create and edit a Reel', summary: 'Media selection, camera recording, sticker tools, and publishing.', category: 'feed', readTime: '3 min' }
    ]
  },
  'messaging': {
    categoryTitle: 'Messaging & Calls',
    articles: [
      { id: 'send-message', title: 'How to send messages and start calls', summary: 'Finding users, opening direct chats, audio calls, and video calls.', category: 'messaging', readTime: '2 min' },
      { id: 'disappearing-messages', title: 'Using disappearing messages and timers', summary: 'Protecting your conversations with automatic message expiration.', category: 'messaging', readTime: '2 min' }
    ]
  },
  'marketplace': {
    categoryTitle: 'Marketplace',
    articles: [
      { id: 'use-marketplace', title: 'How to buy and sell on Sparkle Marketplace', summary: 'Listing items, chatting with buyers/sellers, and campus safety rules.', category: 'marketplace', readTime: '4 min' }
    ]
  },
  'live': {
    categoryTitle: 'Live Streaming',
    articles: [
      { id: 'start-live-stream', title: 'How to start a live video broadcast', summary: 'Follower thresholds, camera/mic permissions, and broadcasting.', category: 'live', readTime: '3 min' }
    ]
  },
  'groups': {
    categoryTitle: 'Sparkle Circles',
    articles: [
      { id: 'join-groups', title: 'Joining and creating campus circles', summary: 'Connect with study groups, clubs, sports teams, and residence circles.', category: 'groups', readTime: '3 min' }
    ]
  },
  'privacy': {
    categoryTitle: 'Privacy & Safety',
    articles: [
      { id: 'report-account', title: 'How to report a post, listing, or user', summary: 'Understanding the reporting process, evidence, and moderation reviews.', category: 'privacy', readTime: '3 min' },
      { id: 'blocking-users', title: 'Blocking and unblocking members', summary: 'What happens when you block an account and how to unblock later.', category: 'privacy', readTime: '2 min' }
    ]
  },
  'technical': {
    categoryTitle: 'Technical Issues',
    articles: [
      { id: 'report-technical-issue', title: 'How to report a technical issue or bug', summary: 'Filing tickets with steps to reproduce and tracking ticket progress.', category: 'technical', readTime: '3 min' }
    ]
  }
};

export default function HelpCategory() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const categoryData = categoryId && ARTICLES_BY_CATEGORY[categoryId]
    ? ARTICLES_BY_CATEGORY[categoryId]
    : { categoryTitle: 'Help Category', articles: [] };

  const filteredArticles = categoryData.articles.filter(a =>
    !query || a.title.toLowerCase().includes(query.toLowerCase()) || a.summary.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-950 font-sans text-[#18181b] dark:text-zinc-100">
      <div className="max-w-3xl mx-auto px-4 pt-[calc(var(--safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {/* Navigation Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/help')}
            className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#18181b] dark:text-zinc-100">
              {categoryData.categoryTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Official documentation and step-by-step guides</p>
          </div>
        </div>

        {/* Search within Category */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={18} />
          <input
            type="text"
            placeholder={`Search ${categoryData.categoryTitle}...`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-[#18181b] dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:border-[#ff1493]"
          />
        </div>

        {/* Articles List */}
        <div className="space-y-3">
          {filteredArticles.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-8 text-center">
              <BookOpen size={36} className="text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">No articles found</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Try another search term or visit the Help Centre.</p>
            </div>
          ) : (
            filteredArticles.map(article => (
              <div
                key={article.id}
                onClick={() => navigate(`/help/article/${article.id}`)}
                className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 sm:p-5 hover:border-[#ff1493]/50 transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff1493] bg-[#ff1493]/10 px-2 py-0.5 rounded">
                      Guide
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {article.readTime} read
                    </span>
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-[#18181b] dark:text-zinc-100 mb-1">
                    {article.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">
                    {article.summary}
                  </p>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-zinc-500 shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

