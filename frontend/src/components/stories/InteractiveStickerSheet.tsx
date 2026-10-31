import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Check, BarChart3, HelpCircle, Camera } from 'lucide-react';
import type { InteractiveStickerConfig, InteractiveStickerType } from './interactiveStickers';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asNumberList = (value: unknown): number[] =>
  Array.isArray(value) ? value.map((item) => asNumber(item, 0)) : [];

const TITLES: Record<InteractiveStickerType, string> = {
  poll: 'Poll',
  quiz: 'Quiz',
  add_yours: 'Add Yours',
};

const PLACEHOLDER_OPTION = (index: number): string => `Option ${index + 1}`;

interface InteractiveStickerSheetProps {
  type: InteractiveStickerType;
  initialConfig?: InteractiveStickerConfig;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (config: InteractiveStickerConfig) => void;
}

const InteractiveStickerSheet: React.FC<InteractiveStickerSheetProps> = ({
  type,
  initialConfig,
  confirmLabel = 'Place sticker',
  onCancel,
  onConfirm,
}) => {
  const isPromptOnly = type === 'add_yours';
  const existingOptions = asStringList(initialConfig?.options);

  const [question, setQuestion] = useState(() => asString(initialConfig?.question));
  const [prompt, setPrompt] = useState(() => asString(initialConfig?.prompt));
  const [options, setOptions] = useState<string[]>(() =>
    existingOptions.length >= MIN_OPTIONS ? existingOptions.slice(0, MAX_OPTIONS) : ['', '']
  );
  const [correctIndex, setCorrectIndex] = useState(() => {
    const stored = asNumber(initialConfig?.correct, 0);
    const optionCount = existingOptions.length >= MIN_OPTIONS ? Math.min(existingOptions.length, MAX_OPTIONS) : MIN_OPTIONS;
    return Math.min(Math.max(stored, 0), optionCount - 1);
  });

  const trimmedOptions = options.map((option) => option.trim());
  const hasBlankOption = trimmedOptions.some((option) => option.length === 0);
  const isValid = isPromptOnly
    ? prompt.trim().length > 0
    : question.trim().length > 0 &&
      trimmedOptions.length >= MIN_OPTIONS &&
      !hasBlankOption;

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  };

  const addOption = () => {
    setOptions((prev) => (prev.length >= MAX_OPTIONS ? prev : [...prev, '']));
  };

  const removeOption = (index: number) => {
    if (options.length <= MIN_OPTIONS) return;
    const next = options.filter((_, i) => i !== index);
    setOptions(next);
    if (index < correctIndex) {
      setCorrectIndex(correctIndex - 1);
    } else if (correctIndex >= next.length) {
      setCorrectIndex(next.length - 1);
    }
  };

  const buildConfig = (): InteractiveStickerConfig => {
    if (isPromptOnly) {
      return {
        prompt: prompt.trim(),
        avatars: asStringList(initialConfig?.avatars),
        responses_count: Math.max(0, asNumber(initialConfig?.responses_count, 0)),
      };
    }

    const questionValue = question.trim();
    const optionValues = trimmedOptions.filter((option) => option.length > 0);

    if (type === 'poll') {
      const previousVotes = asNumberList(initialConfig?.votes);
      const config: InteractiveStickerConfig = {
        question: questionValue,
        options: optionValues,
        votes: optionValues.map((_, i) => previousVotes[i] ?? 0),
      };
      const votedIndex = asNumber(initialConfig?.voted_index, -1);
      if (votedIndex >= 0 && votedIndex < optionValues.length) config.voted_index = votedIndex;
      return config;
    }

    return {
      question: questionValue,
      options: optionValues,
      correct: Math.min(Math.max(correctIndex, 0), optionValues.length - 1),
    };
  };

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(buildConfig());
  };

  const stickerIcon =
    type === 'poll' ? (
      <BarChart3 size={22} strokeWidth={2.5} />
    ) : type === 'quiz' ? (
      <HelpCircle size={22} strokeWidth={2.5} />
    ) : (
      <Camera size={22} strokeWidth={2.5} />
    );

  return (
    <div className="fixed inset-0 z-[610] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-[#1b1b24] w-full sm:max-w-[440px] rounded-t-[40px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-label={`${TITLES[type]} sticker`}
      >
        {/* Mobile Handle */}
        <div className="p-4 flex flex-col items-center border-b border-gray-50 dark:border-white/5">
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mb-4" />
          <div className="flex items-center justify-between w-full px-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                {stickerIcon}
              </div>
              <h3 className="text-[16px] font-black italic uppercase tracking-tighter">{TITLES[type]}</h3>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 bg-gray-100 dark:bg-[#101217] rounded-full flex items-center justify-center text-[#18181b] dark:text-white active:scale-90"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Question / Prompt */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-black/30 dark:text-white/30 italic mb-2 px-1">
              {isPromptOnly ? 'Prompt' : 'Question'}
            </p>
            <input
              autoFocus
              type="text"
              value={isPromptOnly ? prompt : question}
              onChange={(e) => (isPromptOnly ? setPrompt(e.target.value) : setQuestion(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              maxLength={120}
              placeholder={isPromptOnly ? 'Add yours' : 'Ask a question...'}
              className="w-full h-12 bg-gray-50 dark:bg-[#101217] rounded-2xl px-4 text-[13px] font-bold text-[#18181b] dark:text-white placeholder:text-black/20 dark:placeholder:text-white/20 border-2 border-transparent focus:border-primary/20 outline-none transition-all"
            />
          </div>

          {/* Options */}
          {!isPromptOnly && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-black/30 dark:text-white/30 italic">
                  Options
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-black/20 dark:text-white/20 italic">
                  {type === 'quiz' ? `Mark the correct answer · ${options.length}/${MAX_OPTIONS}` : `${options.length}/${MAX_OPTIONS}`}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {options.map((option, index) => {
                  const isCorrect = type === 'quiz' && index === correctIndex;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      {type === 'quiz' && (
                        <button
                          onClick={() => setCorrectIndex(index)}
                          aria-label={`Mark option ${index + 1} as the correct answer`}
                          aria-pressed={isCorrect}
                          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 active:scale-90 transition-all ${
                            isCorrect ? 'border-primary bg-primary text-white' : 'border-black/10 dark:border-white/10 text-transparent'
                          }`}
                        >
                          <Check size={16} strokeWidth={4} />
                        </button>
                      )}
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                        maxLength={80}
                        placeholder={PLACEHOLDER_OPTION(index)}
                        className="flex-1 h-12 bg-gray-50 dark:bg-[#101217] rounded-2xl px-4 text-[13px] font-bold text-[#18181b] dark:text-white placeholder:text-black/20 dark:placeholder:text-white/20 border-2 border-transparent focus:border-primary/20 outline-none transition-all"
                      />
                      {options.length > MIN_OPTIONS && (
                        <button
                          onClick={() => removeOption(index)}
                          aria-label={`Remove option ${index + 1}`}
                          className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-black/40 dark:text-white/40 active:scale-90 transition-all"
                        >
                          <Trash2 size={14} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {options.length < MAX_OPTIONS && (
                <button
                  onClick={addOption}
                  className="mt-3 h-11 w-full rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10 text-[10px] font-black italic uppercase tracking-widest text-black/40 dark:text-white/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Plus size={14} strokeWidth={4} />
                  Add option
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-6 pt-0">
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="w-full h-14 bg-primary text-white rounded-full font-black italic uppercase tracking-tight text-[12px] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-40 disabled:shadow-none"
          >
            <Check size={18} strokeWidth={3} />
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default InteractiveStickerSheet;
