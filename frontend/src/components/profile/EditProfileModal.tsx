import React, { useState, useRef, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import api from '../../api/api';
import ProfileIdentityPreview from './ProfileIdentityPreview';
import MentionAutocomplete, { type MentionOption } from '../MentionAutocomplete';
import { useMentionSearch } from '../../hooks/useMentionSearch';
import { VerifiedBadge } from '../common/VerifiedBadge';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  GraduationCap,
  Compass,
  FileText,
  User as UserIcon,
  AtSign,
  Search,
  Eye,
  Upload,
  X,
  Loader2,
} from 'lucide-react';
import type { User } from '../../types/user';
import { useModalA11y } from '../../hooks/useModalA11y';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (updatedUser: User) => void;
}

type SubView =
  | 'main'
  | 'name'
  | 'username'
  | 'headline'
  | 'bio'
  | 'campus'
  | 'major'
  | 'photo_sheet'
  | 'photo_view';

const UNIVERSITIES = [
  'Karatina University',
  'Chuka University',
  'Dedan Kimathi University of Technology',
  'Mount Kenya University',
  "Murang'a University of Technology",
  'Pwani University',
  'Multimedia University of Kenya',
  'University of Nairobi',
  'Jomo Kenyatta University of Agriculture & Technology (JKUAT)',
  'Kenyatta University (KU)',
  'Strathmore University',
  'Egerton University',
  'Moi University',
  'Technical University of Kenya (TUK)',
  'Maseno University',
  'Kisii University',
  'Daystar University',
  'USIU Africa',
];

const MAJORS = [
  'Computer Science',
  'Information Technology',
  'Software Engineering',
  'Data Science & Artificial Intelligence',
  'Electrical & Electronic Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Business Administration & Management',
  'Economics & Statistics',
  'Accounting & Finance',
  'Marketing & Digital Strategy',
  'Medicine & Surgery',
  'Nursing Science',
  'Pharmacy',
  'Law (LL.B)',
  'Journalism & Mass Communication',
  'Graphic Design & Digital Animation',
  'Hospitality & Tourism Management',
  'Agricultural Economics',
  'Education (Arts & Sciences)',
  'Psychology & Counseling',
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const { user, setUser } = useUserStore();

  // Snapshot of original data to detect dirty state
  const originalSnapshot = useRef({
    name: user?.name || '',
    username: user?.username || '',
    headline: user?.headline || '',
    bio: user?.bio || '',
    campus: user?.campus || '',
    major: user?.major || '',
    avatar_url: user?.avatar_url || '',
  });

  // Current draft state
  const [draft, setDraft] = useState({
    name: user?.name || '',
    username: user?.username || '',
    headline: user?.headline || '',
    bio: user?.bio || '',
    campus: user?.campus || '',
    major: user?.major || '',
    avatar_url: user?.avatar_url || '',
  });

  // Navigation
  const [currentView, setCurrentView] = useState<SubView>('main');

  // Modal dialog states
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);
  // Suspend the main dialog while a confirmation sheet is stacked on top.
  const a11yRef = useModalA11y(
    isOpen && !showDiscardConfirm && !showUsernameConfirm,
    onClose,
  );
  const discardRef = useModalA11y(isOpen && showDiscardConfirm, () => setShowDiscardConfirm(false));
  const usernameRef = useModalA11y(isOpen && showUsernameConfirm, () => setShowUsernameConfirm(false));

  // Status & feedback
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Name editor temporary state
  const [tempName, setTempName] = useState(draft.name);

  // Username editor temporary state + validation
  const [tempUsername, setTempUsername] = useState(draft.username);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(true);
  const [usernameFeedback, setUsernameFeedback] = useState<string>('');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const latestCheckIdRef = useRef(0);

  // Headline editor temporary state
  const [tempHeadline, setTempHeadline] = useState(draft.headline);

  // Bio editor temporary state + mention rail
  const [tempBio, setTempBio] = useState(draft.bio);
  const [cursorPos, setCursorPos] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const bioTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { options: mentionOptions, loading: mentionLoading } = useMentionSearch(mentionQuery ?? '', {
    enabled: mentionQuery !== null,
    minLength: 0,
    debounceMs: 250,
    eagerLoading: true,
    limit: 8,
  });

  // Search queries for selectors
  const [campusSearch, setCampusSearch] = useState('');
  const [majorSearch, setMajorSearch] = useState('');

  // Hidden file input refs for Camera and Gallery
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Synchronize draft when user changes or modal opens
  useEffect(() => {
    if (isOpen && user) {
      const initial = {
        name: user.name || '',
        username: user.username || '',
        headline: user.headline || '',
        bio: user.bio || '',
        campus: user.campus || '',
        major: user.major || '',
        avatar_url: user.avatar_url || '',
      };
      originalSnapshot.current = { ...initial };
      setDraft({ ...initial });
      setTempName(initial.name);
      setTempUsername(initial.username);
      setTempHeadline(initial.headline);
      setTempBio(initial.bio);
      setCurrentView('main');
      setUsernameSuggestions([]);
      setErrorMsg(null);
      setToastMsg(null);
    }
  }, [isOpen, user]);

  // Dirty detection
  const isDirty =
    draft.name !== originalSnapshot.current.name ||
    draft.username !== originalSnapshot.current.username ||
    draft.headline !== originalSnapshot.current.headline ||
    draft.bio !== originalSnapshot.current.bio ||
    draft.campus !== originalSnapshot.current.campus ||
    draft.major !== originalSnapshot.current.major ||
    draft.avatar_url !== originalSnapshot.current.avatar_url;

  // Helper for cooldown remaining days
  const getRemainingDays = (updatedAt?: string | null, totalDays = 7): number => {
    if (!updatedAt) return 0;
    const msSince = Date.now() - new Date(updatedAt).getTime();
    const daysSince = msSince / (1000 * 60 * 60 * 24);
    if (daysSince >= totalDays) return 0;
    return Math.ceil(totalDays - daysSince);
  };

  const nameCooldownDays = getRemainingDays(user?.name_updated_at, 7);
  const usernameCooldownDays = getRemainingDays(user?.username_updated_at, 30);

  // Toast notification timer
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // SparkleLink copy handler
  const handleCopySparkleLink = () => {
    const host = typeof window !== 'undefined' ? window.location.host : 'sparkle.app';
    const link = `https://${host}/@${(draft.username || user?.username || '').replace(/^@/, '')}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      triggerToast('SparkleLink copied to clipboard!');
    }
  };

  // Back / Close handler with unsaved changes protection
  const handleAttemptClose = () => {
    if (currentView !== 'main') {
      setCurrentView('main');
      return;
    }
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  // Discard changes
  const handleConfirmDiscard = () => {
    setDraft({ ...originalSnapshot.current });
    setShowDiscardConfirm(false);
    onClose();
  };

  // Debounced username availability checker with stale response protection
  useEffect(() => {
    if (currentView !== 'username') return;
    const clean = tempUsername.trim().toLowerCase();

    if (!clean) {
      setUsernameAvailable(null);
      setUsernameFeedback('Enter a username');
      setUsernameSuggestions([]);
      setCheckingUsername(false);
      return;
    }

    if (clean === (user?.username || '').toLowerCase()) {
      setUsernameAvailable(true);
      setUsernameFeedback('This is your current username');
      setUsernameSuggestions([]);
      setCheckingUsername(false);
      return;
    }

    if (clean.length < 3) {
      setUsernameAvailable(false);
      setUsernameFeedback('Minimum 3 characters');
      setUsernameSuggestions([]);
      setCheckingUsername(false);
      return;
    }

    if (!/^[a-zA-Z0-9._]+$/.test(clean)) {
      setUsernameAvailable(false);
      setUsernameFeedback('Only letters, numbers, periods & underscores');
      setUsernameSuggestions([]);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    const checkId = ++latestCheckIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const currentUserId = user?.user_id || user?.id;
        const displayName = draft.name?.trim() || user?.name || '';
        const res = await api.get(
          `/auth/check-username?username=${encodeURIComponent(clean)}&current_user_id=${currentUserId}&name=${encodeURIComponent(displayName)}`
        );
        // Stale response check: ignore if user has typed further
        if (checkId !== latestCheckIdRef.current) return;

        if (res.data) {
          setUsernameAvailable(res.data.available);
          setUsernameSuggestions(res.data.suggestions || []);
          if (res.data.available) {
            setUsernameFeedback(res.data.isCurrent ? 'This is your current username' : '✓ Username available');
          } else {
            setUsernameFeedback(res.data.message || '✕ Username already taken');
          }
        }
      } catch (err) {
        if (checkId !== latestCheckIdRef.current) return;
        setUsernameAvailable(null);
        setUsernameFeedback('Unable to check username. Try again.');
        setUsernameSuggestions([]);
      } finally {
        if (checkId === latestCheckIdRef.current) {
          setCheckingUsername(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [tempUsername, currentView, user, draft.name]);

  // Bio mention detection on text changes
  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setTempBio(val);
    setCursorPos(pos);

    // Look back from cursor to see if we are currently typing an @mention
    const textBeforeCursor = val.slice(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const queryCandidate = textBeforeCursor.slice(lastAtIndex + 1);
      // Valid mention query candidate contains no whitespace or newlines
      if (!/\s/.test(queryCandidate)) {
        setMentionQuery(queryCandidate);
        return;
      }
    }
    setMentionQuery(null);
  };

  // Insert mention into biography at cursor
  const handleInsertMention = (selectedUser: MentionOption) => {
    const username = selectedUser.username.replace(/^@/, '');
    const textBeforeCursor = tempBio.slice(0, cursorPos);
    const textAfterCursor = tempBio.slice(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    let newBio = '';
    let newCursor = 0;
    if (lastAtIndex !== -1) {
      const prefix = textBeforeCursor.slice(0, lastAtIndex);
      newBio = `${prefix}@${username} ${textAfterCursor}`;
      newCursor = (prefix + `@${username} `).length;
    } else {
      newBio = `${textBeforeCursor}@${username} ${textAfterCursor}`;
      newCursor = cursorPos + username.length + 2;
    }

    if (newBio.length <= 160) {
      setTempBio(newBio);
      setMentionQuery(null);
      setTimeout(() => {
        if (bioTextareaRef.current) {
          bioTextareaRef.current.focus();
          bioTextareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 50);
    } else {
      triggerToast('Bio cannot exceed 160 characters');
    }
  };

  // Upload photo handler (Take photo / Gallery)
  const handleFileSelected = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image file size must be under 10MB.');
      return;
    }

    try {
      setUploadingPhoto(true);
      setErrorMsg(null);
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newAvatarUrl = res.data.avatar_url;
      const updatedUser = res.data.user;

      if (updatedUser) {
        setUser(updatedUser);
      } else if (user) {
        setUser({ ...user, avatar_url: newAvatarUrl });
      }

      setDraft((prev) => ({ ...prev, avatar_url: newAvatarUrl }));
      triggerToast('Profile photo updated successfully!');
      setCurrentView('main');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to upload profile photo. Please try again.';
      setErrorMsg(msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Save changes to authoritative backend
  const handleSaveAll = async () => {
    if (saving || !isDirty) return;

    // Client-side validations
    if (draft.name.trim().length > 30) {
      setErrorMsg('Display name cannot exceed 30 characters.');
      return;
    }
    if (draft.username.trim().length < 3 || draft.username.trim().length > 30) {
      setErrorMsg('Username must be between 3 and 30 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9._]+$/.test(draft.username.trim())) {
      setErrorMsg('Username can only contain letters, numbers, periods and underscores.');
      return;
    }
    if (draft.headline.trim().length > 100) {
      setErrorMsg('Headline cannot exceed 100 characters.');
      return;
    }
    if (draft.bio.trim().length > 160) {
      setErrorMsg('Biography cannot exceed 160 characters.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      const payload: Record<string, string> = {};
      if (draft.name !== originalSnapshot.current.name) payload.name = draft.name.trim();
      if (draft.username !== originalSnapshot.current.username)
        payload.username = draft.username.trim();
      if (draft.headline !== originalSnapshot.current.headline)
        payload.headline = draft.headline.trim();
      if (draft.bio !== originalSnapshot.current.bio) payload.bio = draft.bio.trim();
      if (draft.campus !== originalSnapshot.current.campus)
        payload.campus = draft.campus.trim();
      if (draft.major !== originalSnapshot.current.major)
        payload.major = draft.major.trim();

      const res = await api.put('/users/profile', payload);

      const updatedUser: User = res.data.user || {
        ...user,
        ...payload,
      };

      // Reconcile Zustand central store
      setUser(updatedUser);

      // Invalidate snapshot
      originalSnapshot.current = {
        name: updatedUser.name || '',
        username: updatedUser.username || '',
        headline: updatedUser.headline || '',
        bio: updatedUser.bio || '',
        campus: updatedUser.campus || '',
        major: updatedUser.major || '',
        avatar_url: updatedUser.avatar_url || '',
      };

      if (onProfileUpdated) {
        onProfileUpdated(updatedUser);
      }

      triggerToast('Digital Identity updated successfully!');
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (err: any) {
      const responseData = err?.response?.data;
      if (responseData?.code === 'NAME_CHANGE_COOLDOWN') {
        setErrorMsg(
          responseData.message ||
            `You can change your display name again in ${responseData.retryDays || 7} days.`
        );
      } else if (responseData?.code === 'USERNAME_CHANGE_COOLDOWN') {
        setErrorMsg(
          responseData.message ||
            `You can change your username again in ${responseData.retryDays || 30} days.`
        );
      } else if (responseData?.code === 'USERNAME_TAKEN') {
        setErrorMsg(responseData.message || 'This username is already taken. Please choose another.');
        if (responseData.suggestions && responseData.suggestions.length > 0) {
          setUsernameSuggestions(responseData.suggestions);
        }
        setUsernameAvailable(false);
        setUsernameFeedback('✕ Username already taken');
        setCurrentView('username');
      } else {
        setErrorMsg(
          responseData?.error ||
            responseData?.message ||
            'Failed to save identity changes. Please try again.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={a11yRef} role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-[1200] flex items-center justify-center p-0 md:p-4 bg-black/75 backdrop-blur-xl animate-fade-in font-sans">
      {/* Hidden file inputs for camera and gallery */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
        }}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
        }}
      />

      {/* Main Container / Mobile Fullscreen Sheet */}
      <div className="relative w-full h-full md:h-auto md:max-h-[92vh] md:max-w-2xl bg-white dark:bg-neutral-950 md:rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header Bar */}
        <header className="shrink-0 px-4 md:px-6 py-3.5 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md z-10">
          <button
            type="button"
            onClick={handleAttemptClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
          >
            {currentView === 'main' ? <X size={20} /> : <ArrowLeft size={20} />}
          </button>

          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {currentView === 'main'
              ? 'Edit profile'
              : currentView === 'name'
              ? 'Display Name'
              : currentView === 'username'
              ? 'Username'
              : currentView === 'headline'
              ? 'Headline'
              : currentView === 'bio'
              ? 'Biography'
              : currentView === 'campus'
              ? 'Select Campus'
              : currentView === 'major'
              ? 'Select Major'
              : currentView === 'photo_sheet'
              ? 'Profile Photo'
              : 'Photo Preview'}
          </h1>

          {currentView === 'main' ? (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!isDirty || saving}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isDirty && !saving
                  ? 'bg-pink-500 hover:bg-pink-600 active:scale-95 text-white shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
              }`}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          ) : (
            <div className="w-9" />
          )}
        </header>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Toast Floating Banner */}
        {toastMsg && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-2xl flex items-center gap-2 animate-scale-in">
            <CheckCircle2 size={14} />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Body Views */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* ======================================================== */}
          {/* VIEW: MAIN IDENTITY STUDIO */}
          {/* ======================================================== */}
          {currentView === 'main' && (
            <div className="space-y-6">
              {/* Live Identity Preview Card */}
              <ProfileIdentityPreview
                draft={draft}
                onAvatarClick={() => setCurrentView('photo_sheet')}
              />

              {/* Photo Action Quick Trigger */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700">
                    <img
                      src={draft.avatar_url || user?.avatar_url || '/uploads/avatars/default.png'}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Profile Photo</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Camera, Upload or Fullscreen Viewer
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('photo_sheet')}
                  disabled={uploadingPhoto}
                  className="px-3 py-1.5 rounded-lg bg-neutral-200/70 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium border border-neutral-200/80 dark:border-neutral-700/80 transition-colors flex items-center gap-1.5"
                >
                  {uploadingPhoto ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Camera size={13} />
                  )}
                  {uploadingPhoto ? 'Uploading...' : 'Change'}
                </button>
              </div>

              {/* Identity Cards Section */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1">
                  Identity Attributes
                </div>

                {/* Card 1: Display Name */}
                <div
                  onClick={() => {
                    setTempName(draft.name);
                    setCurrentView('name');
                  }}
                  className="p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Display Name
                    </span>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {draft.name || 'Not set'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      {nameCooldownDays > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                          <Clock size={12} />
                          Available again in {nameCooldownDays} days
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ Can be changed now (7-day cooldown applies)
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </div>

                {/* Card 2: Username */}
                <div
                  onClick={() => {
                    setTempUsername(draft.username);
                    setCurrentView('username');
                  }}
                  className="p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Username
                    </span>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
                      @{draft.username || 'username'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      {usernameCooldownDays > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                          <Clock size={12} />
                          Available again in {usernameCooldownDays} days
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ Can be changed now (30-day cooldown applies)
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </div>

                {/* Card 3: SparkleLink */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      SparkleLink
                    </span>
                    <div className="text-xs font-mono font-medium text-pink-600 dark:text-pink-400 truncate">
                      {typeof window !== 'undefined' ? window.location.host : 'sparkle.app'}/@{draft.username}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Your unique public web address
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySparkleLink}
                    className="px-3 py-1.5 rounded-lg bg-neutral-200/70 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700/80 transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <Copy size={13} />
                    Copy
                  </button>
                </div>

                {/* Card 4: Headline */}
                <div
                  onClick={() => {
                    setTempHeadline(draft.headline);
                    setCurrentView('headline');
                  }}
                  className="p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5 max-w-[85%]">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Headline
                    </span>
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {draft.headline || <span className="text-neutral-400 dark:text-neutral-500 font-normal">Add a short headline...</span>}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Up to 100 characters
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </div>

                {/* Card 5: Biography */}
                <div
                  onClick={() => {
                    setTempBio(draft.bio);
                    setCurrentView('bio');
                  }}
                  className="p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5 max-w-[85%]">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Biography
                    </span>
                    <div className="text-sm font-normal text-neutral-900 dark:text-neutral-100 line-clamp-2">
                      {draft.bio || <span className="text-neutral-400 dark:text-neutral-500 font-normal">Tell Sparkle about yourself...</span>}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Supports live @mentions
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </div>

                {/* Card 6: Campus */}
                <div
                  onClick={() => {
                    setCampusSearch('');
                    setCurrentView('campus');
                  }}
                  className="p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Campus
                    </span>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <GraduationCap size={15} className="text-pink-500" />
                      {draft.campus || <span className="text-neutral-400 dark:text-neutral-500 font-normal">Select campus...</span>}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </div>

                {/* Card 7: Major */}
                <div
                  onClick={() => {
                    setMajorSearch('');
                    setCurrentView('major');
                  }}
                  className="p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Major / Program
                    </span>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <Compass size={15} className="text-purple-500" />
                      {draft.major || <span className="text-neutral-400 dark:text-neutral-500 font-normal">Select major...</span>}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: NAME EDITOR */}
          {/* ======================================================== */}
          {currentView === 'name' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-pink-500/5 border border-pink-500/20 text-xs space-y-1">
                <div className="font-semibold text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                  <Clock size={14} />
                  7-Day Name Change Policy
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Your display name can only be changed once every 7 days. This change will immediately be visible across your profile, connect, messages, and posts.
                </p>
              </div>

              {nameCooldownDays > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>
                    You recently changed your display name. You can change it again in {nameCooldownDays} day{nameCooldownDays > 1 ? 's' : ''}.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Display Name</span>
                  <span className={tempName.length > 30 ? 'text-rose-500 font-semibold' : 'text-neutral-500 dark:text-neutral-400'}>
                    {tempName.length} / 30
                  </span>
                </div>
                <input
                  type="text"
                  value={tempName}
                  maxLength={30}
                  disabled={nameCooldownDays > 0}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="e.g. Don Babu"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 text-sm font-semibold text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-pink-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCurrentView('main')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    nameCooldownDays > 0 ||
                    !tempName.trim() ||
                    tempName.trim().length > 30 ||
                    tempName.trim() === draft.name
                  }
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, name: tempName.trim() }));
                    setCurrentView('main');
                  }}
                  className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: USERNAME EDITOR */}
          {/* ======================================================== */}
          {currentView === 'username' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-pink-500/5 border border-pink-500/20 text-xs space-y-1">
                <div className="font-semibold text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                  <Clock size={14} />
                  30-Day Username Change Policy
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  You can only change your username once every 30 days. Changing your username will also change your SparkleLink and profile URL.
                </p>
              </div>

              {usernameCooldownDays > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>
                    You changed your username recently. You can update it again in {usernameCooldownDays} day{usernameCooldownDays > 1 ? 's' : ''}.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Username</span>
                  <span className={tempUsername.length > 30 ? 'text-rose-500 font-semibold' : 'text-neutral-500 dark:text-neutral-400'}>
                    {tempUsername.length} / 30
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 font-mono font-semibold">
                    @
                  </span>
                  <input
                    type="text"
                    value={tempUsername}
                    maxLength={30}
                    disabled={usernameCooldownDays > 0}
                    onChange={(e) =>
                      setTempUsername(
                        e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '')
                      )
                    }
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 text-sm font-mono font-semibold text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-pink-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Feedback indicator */}
                <div className="flex items-center gap-2 text-xs min-h-[20px]">
                  {checkingUsername ? (
                    <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-medium">
                      <Loader2 size={13} className="animate-spin text-pink-500" /> Checking availability...
                    </span>
                  ) : usernameFeedback ? (
                    <span
                      className={`flex items-center gap-1 font-medium ${
                        usernameAvailable
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : usernameAvailable === false
                          ? 'text-rose-500'
                          : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {usernameAvailable && <CheckCircle2 size={13} className="shrink-0" />}
                      {!usernameAvailable && usernameAvailable !== null && <AlertCircle size={13} className="shrink-0" />}
                      {usernameFeedback}
                    </span>
                  ) : null}
                </div>

                {/* Clickable available suggestions */}
                {!checkingUsername && !usernameAvailable && usernameSuggestions.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Try these available suggestions:
                    </div>
                    <div className="space-y-1.5">
                      {usernameSuggestions.map((sugg) => (
                        <button
                          key={sugg}
                          type="button"
                          onClick={() => {
                            setTempUsername(sugg);
                            setUsernameSuggestions([]);
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 hover:bg-pink-50/70 dark:bg-neutral-900/70 dark:hover:bg-neutral-800/90 border border-neutral-200/80 hover:border-pink-300 dark:border-neutral-800 dark:hover:border-pink-500/40 text-left flex items-center justify-between text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100 hover:text-pink-600 dark:hover:text-pink-400 transition-all active:scale-[0.99] group shadow-2xs"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="text-neutral-400 dark:text-neutral-500 font-sans font-normal">@</span>
                            <span>{sugg}</span>
                          </span>
                          <span className="text-neutral-400 dark:text-neutral-500 group-hover:text-pink-500 group-hover:translate-x-0.5 transition-all text-sm font-semibold">
                            ›
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCurrentView('main')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    usernameCooldownDays > 0 ||
                    checkingUsername ||
                    !tempUsername.trim() ||
                    tempUsername.trim().length < 3 ||
                    tempUsername.trim().length > 30 ||
                    !usernameAvailable ||
                    tempUsername.trim().toLowerCase() === draft.username.toLowerCase()
                  }
                  onClick={() => setShowUsernameConfirm(true)}
                  className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: HEADLINE EDITOR */}
          {/* ======================================================== */}
          {currentView === 'headline' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Headline</span>
                  <span className={tempHeadline.length > 100 ? 'text-rose-500 font-semibold' : 'text-neutral-500 dark:text-neutral-400'}>
                    {tempHeadline.length} / 100
                  </span>
                </div>
                <textarea
                  value={tempHeadline}
                  maxLength={100}
                  rows={3}
                  onChange={(e) => setTempHeadline(e.target.value)}
                  placeholder="e.g. Building things that matter • Tech & Design Explorer"
                  className="w-full p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 text-sm font-normal text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-pink-500 transition-colors resize-none"
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  A concise summary of your focus or motto that shows near your profile avatar.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCurrentView('main')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, headline: tempHeadline.trim() }));
                    setCurrentView('main');
                  }}
                  className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white text-xs font-semibold transition-all shadow-xs"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: BIO EDITOR */}
          {/* ======================================================== */}
          {currentView === 'bio' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Biography</span>
                  <span className={tempBio.length > 160 ? 'text-rose-500 font-semibold' : 'text-neutral-500 dark:text-neutral-400'}>
                    {tempBio.length} / 160
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    ref={bioTextareaRef}
                    value={tempBio}
                    maxLength={160}
                    rows={4}
                    onChange={handleBioChange}
                    onSelect={(e) => setCursorPos(e.currentTarget.selectionStart)}
                    placeholder="Tell your story, your interests, and mention collaborators with @username..."
                    className="w-full p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 text-sm font-normal text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-pink-500 transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* Inline @ Mention Rail when query is active */}
                {mentionQuery !== null && (
                  <MentionAutocomplete
                    options={mentionOptions}
                    loading={mentionLoading && mentionOptions.length === 0}
                    onSelect={handleInsertMention}
                    onClose={() => setMentionQuery(null)}
                    className="mt-2 w-full overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-2xl transition-all"
                    header={
                      <div className="px-3 py-2 border-b border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] font-bold text-black/40 dark:text-white/40 uppercase tracking-wider">
                        <span>Mention User</span>
                        {mentionLoading && <Loader2 size={12} className="animate-spin text-pink-500" />}
                      </div>
                    }
                    scrollClassName="max-h-48 overflow-y-auto divide-y divide-black/[0.03] dark:divide-white/[0.03]"
                    loadingContent={
                      <div className="py-4 text-center text-xs text-black/40 dark:text-white/40">
                        Searching Sparkle users...
                      </div>
                    }
                    emptyContent={
                      <div className="py-4 text-center text-xs text-black/40 dark:text-white/40">
                        No matching users found
                      </div>
                    }
                    renderOption={(user, { active, optionProps }) => {
                      const displayName = user.name || user.username;
                      const avatarUrl = user.avatar_url || user.avatar;

                      return (
                        <button
                          type="button"
                          {...optionProps}
                          className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                            active
                              ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-black dark:text-white'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-black/5 dark:bg-white/10 flex items-center justify-center border border-black/5 dark:border-white/10">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={displayName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;
                                }}
                              />
                            ) : (
                              <UserIcon size={14} className="text-black/40 dark:text-white/40" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold truncate">{displayName}</span>
                              {user.is_verified && (
                                <VerifiedBadge
                                  accountType={user.account_type || 'user'}
                                  isVerified={true}
                                  size="xs"
                                />
                              )}
                            </div>
                            <div className="text-[11px] text-black/40 dark:text-white/40 font-mono truncate">
                              @{user.username}
                            </div>
                          </div>
                        </button>
                      );
                    }}
                  />
                )}

                {/* Mention trigger helper button */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (tempBio.length < 159) {
                        const newText = tempBio + '@';
                        setTempBio(newText);
                        setCursorPos(newText.length);
                        setMentionQuery('');
                        if (bioTextareaRef.current) {
                          bioTextareaRef.current.focus();
                        }
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/15 text-pink-600 dark:text-pink-400 text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <AtSign size={13} />
                    <span>Mention a friend</span>
                  </button>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Type @ to search users
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCurrentView('main')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, bio: tempBio.trim() }));
                    setCurrentView('main');
                  }}
                  className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white text-xs font-semibold transition-all shadow-xs"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: CAMPUS SELECTOR */}
          {/* ======================================================== */}
          {currentView === 'campus' && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                  type="text"
                  value={campusSearch}
                  onChange={(e) => setCampusSearch(e.target.value)}
                  placeholder="Search university campus..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1 pr-1 divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {UNIVERSITIES.filter((u) =>
                  u.toLowerCase().includes(campusSearch.toLowerCase())
                ).map((camp) => {
                  const isSelected = draft.campus === camp;
                  return (
                    <div
                      key={camp}
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, campus: camp }));
                        setCurrentView('main');
                      }}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400 font-semibold border border-pink-500/20'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200 font-normal'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <GraduationCap size={16} className={isSelected ? 'text-pink-500' : 'text-neutral-400 dark:text-neutral-500'} />
                        <span className="text-sm">{camp}</span>
                      </div>
                      {isSelected && <Check size={16} className="text-pink-500 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: MAJOR SELECTOR */}
          {/* ======================================================== */}
          {currentView === 'major' && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                  type="text"
                  value={majorSearch}
                  onChange={(e) => setMajorSearch(e.target.value)}
                  placeholder="Search major / academic discipline..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1 pr-1 divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {MAJORS.filter((m) =>
                  m.toLowerCase().includes(majorSearch.toLowerCase())
                ).map((maj) => {
                  const isSelected = draft.major === maj;
                  return (
                    <div
                      key={maj}
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, major: maj }));
                        setCurrentView('main');
                      }}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200 font-normal'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Compass size={16} className={isSelected ? 'text-purple-500' : 'text-neutral-400 dark:text-neutral-500'} />
                        <span className="text-sm">{maj}</span>
                      </div>
                      {isSelected && <Check size={16} className="text-purple-500 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: PHOTO ACTION SHEET */}
          {/* ======================================================== */}
          {currentView === 'photo_sheet' && (
            <div className="space-y-4 py-2">
              <div className="text-center space-y-1.5 pb-2">
                <div className="w-24 h-24 rounded-full overflow-hidden mx-auto border-2 border-pink-500/30 p-1">
                  <img
                    src={draft.avatar_url || user?.avatar_url || '/uploads/avatars/default.png'}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Profile Photo Actions</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Select an action to update or view your picture
                </p>
              </div>

              <div className="space-y-2">
                {/* 1. Take Photo (Real Camera API) */}
                <button
                  type="button"
                  onClick={() => {
                    if (cameraInputRef.current) cameraInputRef.current.click();
                  }}
                  className="w-full p-3.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900/60 dark:hover:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-800 transition-colors flex items-center gap-3 text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                    <Camera size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Take Photo</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Capture directly with device camera
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-neutral-400 dark:text-neutral-500" />
                </button>

                {/* 2. Upload Photo (Real Media Picker) */}
                <button
                  type="button"
                  onClick={() => {
                    if (galleryInputRef.current) galleryInputRef.current.click();
                  }}
                  className="w-full p-3.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900/60 dark:hover:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-800 transition-colors flex items-center gap-3 text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Upload size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Upload from Gallery</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Select image from your device photos
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-neutral-400 dark:text-neutral-500" />
                </button>

                {/* 3. View Photo Fullscreen */}
                <button
                  type="button"
                  onClick={() => setCurrentView('photo_view')}
                  className="w-full p-3.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900/60 dark:hover:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-800 transition-colors flex items-center gap-3 text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Eye size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">View Current Photo</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Open full resolution picture preview
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-neutral-400 dark:text-neutral-500" />
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentView('main')}
                  className="w-full py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: FULL RESOLUTION PHOTO PREVIEW */}
          {/* ======================================================== */}
          {currentView === 'photo_view' && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900">
                <img
                  src={draft.avatar_url || user?.avatar_url || '/uploads/avatars/default.png'}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('photo_sheet')}
                className="px-5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Back to Photo Options
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: UNSAVED CHANGES CONFIRMATION */}
      {/* ======================================================== */}
      {showDiscardConfirm && (
        <div ref={discardRef} role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-scale-in">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Discard Unsaved Changes?</h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                You have unsaved changes to your identity. If you leave now, these changes will be lost.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold text-xs hover:bg-rose-500/20 transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: USERNAME CHANGE IMPACT CONFIRMATION */}
      {/* ======================================================== */}
      {showUsernameConfirm && (
        <div ref={usernameRef} role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-scale-in">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center mx-auto">
              <Sparkles size={24} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Update Username?</h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                You can only change your username once every 30 days. Changing it will also change your SparkleLink and profile address.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowUsernameConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft((prev) => ({ ...prev, username: tempUsername.trim() }));
                  setShowUsernameConfirm(false);
                  setCurrentView('main');
                }}
                className="w-full py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfileModal;
