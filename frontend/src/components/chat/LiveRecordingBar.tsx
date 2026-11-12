import { memo, useState, useEffect } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { voiceRecordingService, type RecordingState } from '../../services/VoiceRecordingService';

/**
 * Recording controls shown while a voice note is being captured.
 *
 * Extracted from pages/Messages.tsx. RecordingState comes from the service,
 * not from this file, and must be imported alongside voiceRecordingService or
 * the initial state fails to typecheck.
 */

const LiveRecordingBar = memo(({
  sessionId,
  onDiscard,
  onSend
}: {
  sessionId: string;
  onDiscard: () => void;
  onSend: () => void;
}) => {
  const [state, setState] = useState<RecordingState>({
    isRecording: true,
    isPaused: false,
    duration: 0,
    audioLevels: new Array(16).fill(0.1),
    sessionId
  });

  useEffect(() => {
    const handleStateChange = (newState: RecordingState) => {
      if (newState.sessionId === sessionId || voiceRecordingService.getCurrentSessionId() === sessionId) {
        setState(newState);
      }
    };

    voiceRecordingService.subscribe(handleStateChange);
    return () => {
      voiceRecordingService.unsubscribe();
    };
  }, [sessionId]);

  const minutes = Math.floor(state.duration / 60);
  const seconds = String(state.duration % 60).padStart(2, '0');

  return (
    <div className="flex items-center w-full max-w-[1200px] mx-auto px-1 py-2">
      <div className="flex items-center w-full chat-overlay-bg border border-white/20 rounded-full px-4 py-2 justify-between backdrop-blur-xl shadow-2xl">
        <button
          type="button"
          onClick={onDiscard}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-full transition-all active:scale-95 shrink-0 flex items-center justify-center"
          title="Discard voice note"
        >
          <Trash2 size={20} />
        </button>

        <div className="flex-1 flex items-center justify-center gap-3 px-4 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-black text-red-400 tracking-wider">
              {minutes}:{seconds}
            </span>
          </div>

          <div className="flex items-center gap-[3px] h-5 overflow-hidden flex-1 justify-center max-w-[220px]">
            {state.audioLevels.map((lvl, idx) => (
              <div
                key={idx}
                className="w-1 bg-[#ff1493] rounded-full transition-all duration-75"
                style={{ height: `${Math.max(4, Math.round(lvl * 20))}px` }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onSend}
          className="p-2.5 rounded-full bg-[#ff1493] text-white hover:opacity-90 active:scale-95 transition-all shadow-lg shrink-0 flex items-center justify-center"
          title="Send Voice Note"
        >
          <Send size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

export default LiveRecordingBar;
