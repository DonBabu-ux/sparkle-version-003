import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, AlertTriangle,
  Lightbulb, ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import { showSuccess } from '../utils/toast';

interface DocumentationArticle {
  id: string;
  title: string;
  category: string;
  categoryName: string;
  lastUpdated: string;
  version: string;
  introduction: string;
  steps: { title: string; instruction: string }[];
  tips?: string[];
  warnings?: string[];
  troubleshooting?: string[];
  relatedArticleIds?: string[];
}

const DOCUMENTATION_DATABASE: Record<string, DocumentationArticle> = {
  'create-account': {
    id: 'create-account',
    title: 'How to create a Sparkle account',
    category: 'getting-started',
    categoryName: 'Getting Started',
    lastUpdated: 'November 2026',
    version: '2.4',
    introduction: 'Sparkle is an authentic campus social network for university and college students. Follow this guide to register, verify your email, and customize your profile.',
    steps: [
      { title: '1. Open Sparkle and select Sign Up', instruction: 'Launch the Sparkle mobile application or web portal and click "Sign Up" on the welcome splash.' },
      { title: '2. Provide your registration credentials', instruction: 'Enter your real name, choose a unique username (@yourname), and enter your university or personal email. Create a strong password of at least 8 characters including numbers and symbols.' },
      { title: '3. Verify your email address', instruction: 'Check your email inbox for our verification email. Open the link to verify ownership. The verification code expires within 15 minutes.' },
      { title: '4. Select your campus and academic focus', instruction: 'Select your university campus, major or field of study, and expected graduation year so Sparkle can connect you to your student circles.' },
      { title: '5. Upload your avatar and headline', instruction: 'Add a profile photo and short bio. You can update these anytime in Settings → Edit Profile.' }
    ],
    tips: [
      'Using your campus student email helps automatically verify your university affiliation.',
      'You can enable two-factor authentication in Settings → Security Centre immediately after setup.'
    ],
    warnings: [
      'Sparkle strictly prohibits impersonation. Do not register with another student\'s credentials.'
    ],
    troubleshooting: [
      'Did not receive the verification email? Check your spam/junk folder or click "Resend code" on the verification screen.'
    ],
    relatedArticleIds: ['profile-setup', 'recover-account', 'manage-privacy']
  },

  'recover-account': {
    id: 'recover-account',
    title: 'How to recover access to your account',
    category: 'account',
    categoryName: 'Account & Security',
    lastUpdated: 'November 2026',
    version: '2.1',
    introduction: 'If you have lost access to your account or forgotten your login password, follow this official recovery flow.',
    steps: [
      { title: '1. Access Forgot Password', instruction: 'On the Sparkle login screen, tap the "Forgot Password" link below the password input.' },
      { title: '2. Enter your account email', instruction: 'Input the email address associated with your Sparkle account and submit the form.' },
      { title: '3. Open the password reset link', instruction: 'Open the email sent from Sparkle and tap the secure password reset link. The reset token is single-use and expires in 60 minutes.' },
      { title: '4. Set your new password', instruction: 'Choose a new, strong password and confirm it. Once saved, you will be automatically redirected to sign in.' }
    ],
    warnings: [
      'If your account is suspended or terminated under Account Control, signing in with your password will prompt you to reactivate if within the 30-day grace period.'
    ],
    troubleshooting: [
      'If you no longer have access to your registered email, submit a support ticket quoting your username and proof of campus enrollment.'
    ],
    relatedArticleIds: ['create-account', 'manage-privacy']
  },

  'start-live-stream': {
    id: 'start-live-stream',
    title: 'How to start a live video broadcast',
    category: 'live',
    categoryName: 'Live Streaming',
    lastUpdated: 'November 2026',
    version: '3.0',
    introduction: 'Sparkle Live Streaming allows creators and campus leaders to broadcast live video directly from their phone to their followers using low-latency WebRTC technology.',
    steps: [
      { title: '1. Verify your eligibility threshold', instruction: 'Broadcasting live requires reaching the Sparkle Creator milestone of at least 1,000 followers. Check your follower count on your Profile.' },
      { title: '2. Open the Live Streams console', instruction: 'Navigate to the Live Streams screen from the sidebar or main menu. If eligible, your Creator Console will be unlocked.' },
      { title: '3. Tap Go Live and grant permissions', instruction: 'Click "Go Live". When prompted, allow camera and microphone access. Sparkle needs these permissions solely to capture your broadcast.' },
      { title: '4. Set your stream title and category', instruction: 'Enter an engaging title describing your broadcast (e.g. "Late night campus study session" or "Campus soccer tournament live") and choose a category.' },
      { title: '5. Manage your live broadcast', instruction: 'While live, you can mute your microphone, toggle your camera, view your live elapsed time, and see real-time viewer counts. Click "End Live" when finished.' }
    ],
    tips: [
      'Ensure you are connected to a strong Wi-Fi or high-speed mobile network for optimal WebRTC video quality.',
      'Viewers do not need 1,000 followers or camera permissions to watch your stream.'
    ],
    warnings: [
      'Live streams must abide by Sparkle Community Standards. Streaming copyrighted material, academic dishonesty, or prohibited behavior will result in immediate termination of streaming privileges.'
    ],
    relatedArticleIds: ['manage-privacy', 'community-guidelines']
  },

  'use-marketplace': {
    id: 'use-marketplace',
    title: 'How to buy and sell on Sparkle Marketplace',
    category: 'marketplace',
    categoryName: 'Marketplace',
    lastUpdated: 'November 2026',
    version: '2.2',
    introduction: 'Sparkle Marketplace is a dedicated classifieds hub for students to trade textbooks, electronics, housing sublets, and campus gear.',
    steps: [
      { title: '1. Browse listings by category or search', instruction: 'Navigate to Marketplace. Filter by category (e.g. Textbooks, Electronics, Fashion) or search by keyword.' },
      { title: '2. Create a new listing', instruction: 'Tap "Sell Item". Upload clear photos, enter an item title, condition (New, Good, Fair), price, and your campus location.' },
      { title: '3. Communicate via Marketplace Chat', instruction: 'Click "Chat with Seller" to ask questions or discuss terms. Never share personal financial credentials or credit card numbers in chat.' },
      { title: '4. Agree on meeting spot and payment', instruction: 'Agree on a time to inspect the item in person. Make sure to exchange items in daylight at high-traffic campus spots.' }
    ],
    tips: [
      'Check seller profiles and ratings before agreeing to meet.',
      'Take clear photos in good lighting to sell your items faster.'
    ],
    warnings: [
      'Never send advance wire transfers to unknown sellers. Always inspect the physical item before handing over payment.'
    ],
    relatedArticleIds: ['manage-privacy', 'report-account']
  },

  'create-reel': {
    id: 'create-reel',
    title: 'How to create and edit a Reel',
    category: 'feed',
    categoryName: 'Home Feed & Posts',
    lastUpdated: 'November 2026',
    version: '2.0',
    introduction: 'Reels and Moments let you express yourself with short-form videos, sound clips, and interactive stickers.',
    steps: [
      { title: '1. Open the Reel Creator', instruction: 'Tap the "+" icon in the bottom navigation or sidebar and select "Create Reel".' },
      { title: '2. Record or upload media', instruction: 'Record live using your camera or upload a video clip up to 15MB from your device gallery.' },
      { title: '3. Add audio and stickers', instruction: 'Choose background music from the Sparkle audio library, or add interactive stickers and text overlays.' },
      { title: '4. Add captions and hashtags', instruction: 'Write an engaging caption, tag friends, and choose whether to allow comments and duets.' },
      { title: '5. Publish to campus feed', instruction: 'Tap "Publish". Your reel will be visible in the Moments & Reels discovery feed.' }
    ],
    tips: [
      'Vertical 9:16 aspect ratio videos render best on mobile screens.'
    ],
    relatedArticleIds: ['create-post', 'manage-privacy']
  },

  'send-message': {
    id: 'send-message',
    title: 'How to send messages and start calls',
    category: 'messaging',
    categoryName: 'Messaging & Calls',
    lastUpdated: 'November 2026',
    version: '2.3',
    introduction: 'Sparkle Chat provides instant messaging, voice calling, and video calling between students with end-to-end security options.',
    steps: [
      { title: '1. Open Messages', instruction: 'Tap the paper plane icon in the bottom navigation or desktop sidebar to open your inbox.' },
      { title: '2. Start a conversation', instruction: 'Tap the compose icon (pencil) in the top right. Search for a peer by username or name.' },
      { title: '3. Send text, media, or voice notes', instruction: 'Type your message, record a voice note, or attach photos/documents using the attachment icon.' },
      { title: '4. Initiate a voice or video call', instruction: 'Tap the phone or video icon in the chat header to initiate a direct peer-to-peer call.' }
    ],
    tips: [
      'You can enable disappearing messages in the conversation settings for temporary chats.'
    ],
    relatedArticleIds: ['disappearing-messages', 'manage-privacy']
  },

  'manage-privacy': {
    id: 'manage-privacy',
    title: 'Managing your privacy and visibility',
    category: 'account',
    categoryName: 'Account & Security',
    lastUpdated: 'November 2026',
    version: '2.5',
    introduction: 'Sparkle gives you granular control over who can discover your profile, view your posts, and send you direct messages.',
    steps: [
      { title: '1. Access Privacy Settings', instruction: 'Navigate to Settings → Security Centre or Settings → Account Control.' },
      { title: '2. Ghost Mode (Hide from Users)', instruction: 'Toggle Ghost Mode on if you wish to remain hidden from campus search, discover feeds, and suggestions.' },
      { title: '3. Private Account Mode', instruction: 'Enable Private Account so new followers must submit a follow request that you approve manually.' },
      { title: '4. Message Privacy', instruction: 'Configure whether anyone on campus or only mutual followers can initiate conversations with you.' }
    ],
    tips: [
      'Ghost mode is fully reversible at any time with one tap without losing data.'
    ],
    relatedArticleIds: ['recover-account', 'delete-account', 'report-account']
  },

  'report-account': {
    id: 'report-account',
    title: 'How to report a post, listing, or user',
    category: 'privacy',
    categoryName: 'Privacy & Safety',
    lastUpdated: 'November 2026',
    version: '2.2',
    introduction: 'If you encounter safety violations, harassment, counterfeit listings, or inappropriate behavior, you can report it directly.',
    steps: [
      { title: '1. Locate the item to report', instruction: 'Go to the post, comment, message, marketplace listing, or user profile in question.' },
      { title: '2. Tap the three dots (⋯) menu', instruction: 'Click the options icon and select "Report".' },
      { title: '3. Choose the violation category', instruction: 'Select the category that best matches the issue (e.g. Harassment, Spam, Scams, Safety).' },
      { title: '4. Submit additional context', instruction: 'Provide optional context to assist moderators in investigating the report.' }
    ],
    warnings: [
      'Submitting false reports maliciously is a violation of Sparkle Community Standards.'
    ],
    relatedArticleIds: ['manage-privacy', 'blocking-users', 'report-technical-issue']
  },

  'report-technical-issue': {
    id: 'report-technical-issue',
    title: 'How to report a technical issue or bug',
    category: 'technical',
    categoryName: 'Technical Issues',
    lastUpdated: 'November 2026',
    version: '2.1',
    introduction: 'When you find a bug, glitch, or unexpected error in Sparkle, reporting it helps our engineering team fix it quickly.',
    steps: [
      { title: '1. Open Help Centre → Report an Issue', instruction: 'Navigate to the Help Centre and click "Report an Issue" or go directly to the Report Issue page.' },
      { title: '2. Select the affected feature', instruction: 'Choose the feature encountering problems (e.g. Messaging, Live Streams, Marketplace, Home Feed).' },
      { title: '3. Detail steps to reproduce', instruction: 'Describe what you did right before the issue happened, what you expected to see, and what actually occurred.' },
      { title: '4. Submit and track your ticket', instruction: 'Submit the report. You will receive a unique ticket reference (e.g. SPK-TKT-123456) to track progress in Support Tickets.' }
    ],
    tips: [
      'Including specific error messages helps engineers resolve the ticket faster.'
    ],
    relatedArticleIds: ['recover-account', 'use-marketplace']
  }
};

export default function HelpArticle() {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const [helpful, setHelpful] = useState<boolean | null>(null);

  const article = articleId ? DOCUMENTATION_DATABASE[articleId] : null;

  if (!article) {
    return (
      <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-950 font-sans flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-black text-[#18181b] dark:text-zinc-100 mb-2">Article Not Found</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5">The requested documentation article could not be located.</p>
          <button
            onClick={() => navigate('/help')}
            className="px-5 py-2.5 rounded-xl bg-[#ff1493] text-white text-xs font-bold"
          >
            Back to Help Centre
          </button>
        </div>
      </div>
    );
  }

  const handleHelpful = (isHelpful: boolean) => {
    setHelpful(isHelpful);
    showSuccess('Thank you for your feedback!');
  };

  return (
    <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-950 font-sans text-[#18181b] dark:text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 pt-[calc(var(--safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 shadow-sm hover:scale-105 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
            <Link to="/help" className="hover:text-[#ff1493]">Help Centre</Link>
            <span>/</span>
            <Link to={`/help/category/${article.category}`} className="hover:text-[#ff1493]">{article.categoryName}</Link>
          </div>
        </div>

        {/* Article Header Card */}
        <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-3xl p-5 sm:p-7 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff1493] bg-[#ff1493]/10 px-2.5 py-1 rounded-full">
              {article.categoryName}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
              <Calendar size={12} />
              Updated {article.lastUpdated}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">
              v{article.version}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight leading-tight mb-4">
            {article.title}
          </h1>

          <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed font-normal">
            {article.introduction}
          </p>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-4 mb-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 px-1">
            Step-by-Step Instructions
          </h2>

          <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-3xl p-5 sm:p-7 space-y-6">
            {article.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-[#ff1493] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="font-bold text-sm sm:text-base text-[#18181b] dark:text-zinc-100 mb-1">
                    {step.title.replace(/^\d+\.\s*/, '')}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {step.instruction}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips Section */}
        {article.tips && article.tips.length > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 mb-5 flex items-start gap-3">
            <Lightbulb size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
              <p className="font-bold">Helpful Tips:</p>
              {article.tips.map((tip, idx) => (
                <p key={idx} className="leading-relaxed">• {tip}</p>
              ))}
            </div>
          </div>
        )}

        {/* Warnings Section */}
        {article.warnings && article.warnings.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mb-5 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs sm:text-sm text-red-800 dark:text-red-300">
              <p className="font-bold">Important Notice:</p>
              {article.warnings.map((warn, idx) => (
                <p key={idx} className="leading-relaxed">• {warn}</p>
              ))}
            </div>
          </div>
        )}

        {/* Troubleshooting */}
        {article.troubleshooting && article.troubleshooting.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-5 mb-6">
            <h3 className="font-bold text-sm text-[#18181b] dark:text-zinc-100 mb-2">Troubleshooting</h3>
            <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
              {article.troubleshooting.map((item, idx) => (
                <p key={idx}>• {item}</p>
              ))}
            </div>
          </div>
        )}

        {/* Helpful Feedback Box */}
        <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="font-bold text-sm text-[#18181b] dark:text-zinc-100">Was this article helpful?</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500">Your feedback helps improve Sparkle documentation.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleHelpful(true)}
              disabled={helpful !== null}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${helpful === true ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200'}`}
            >
              Yes, thanks!
            </button>
            <button
              onClick={() => handleHelpful(false)}
              disabled={helpful !== null}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${helpful === false ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200'}`}
            >
              Could be better
            </button>
          </div>
        </div>

        {/* Related Articles */}
        {article.relatedArticleIds && article.relatedArticleIds.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3 px-1">
              Related Articles
            </h3>
            <div className="space-y-2">
              {article.relatedArticleIds.map(relId => {
                const relArticle = DOCUMENTATION_DATABASE[relId];
                if (!relArticle) return null;
                return (
                  <Link
                    key={relId}
                    to={`/help/article/${relId}`}
                    className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-xl p-3.5 flex items-center justify-between hover:border-[#ff1493]/50 transition-colors"
                  >
                    <span className="text-xs font-bold text-[#18181b] dark:text-zinc-100">{relArticle.title}</span>
                    <ChevronRight size={15} className="text-slate-400" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

