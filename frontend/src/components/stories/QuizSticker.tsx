import React from 'react';

interface QuizStickerConfig {
  question: string;
  options: string[];
  correct?: number;
}

interface QuizStickerProps {
  config: QuizStickerConfig;
}

/**
 * Read-only quiz sticker: the author picks the correct answer while placing /
 * editing the sticker, and it is revealed on the story card. There is no quiz
 * answer endpoint (unlike sticker poll votes), so nothing here is interactive.
 */
const QuizSticker: React.FC<QuizStickerProps> = ({ config }) => {
  const options = Array.isArray(config.options) ? config.options : [];
  const correctIndex = typeof config.correct === 'number' ? config.correct : -1;

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-[24px] p-5 shadow-2xl border border-white/20 min-w-[220px] max-w-[280px] flex flex-col gap-4">
      <h4 className="text-[16px] font-black italic uppercase tracking-tight text-[#18181b] dark:text-white text-center leading-tight">
        {config.question || 'Quiz'}
      </h4>

      <div className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const isCorrect = i === correctIndex;

          return (
            <div
              key={i}
              className={`h-12 w-full rounded-xl border-2 flex items-center justify-between px-4 transition-all ${
                isCorrect ? 'border-emerald-500 bg-emerald-500/10' : 'border-black/5'
              }`}
            >
              <span className="text-[13px] font-bold text-black/60 truncate">{opt}</span>
              {isCorrect && (
                <span className="text-[9px] font-black italic uppercase tracking-widest text-emerald-600 ml-2">
                  Correct
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuizSticker;
