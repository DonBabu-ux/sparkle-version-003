import { useState, useEffect } from 'react';
import { X, Shield, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/api';
import ThreeStateToggle, { type TriState } from '../common/ThreeStateToggle';
import { logger } from '../../utils/logger';
import { useModalA11y } from '../../hooks/useModalA11y';

interface PrivacySettingsModalProps {
  chatId: string; // chat identifier
  onClose: () => void;
}

export default function PrivacySettingsModal({ chatId, onClose }: PrivacySettingsModalProps) {
  const [allowForward, setAllowForward] = useState<TriState>(null);
  const [allowCopy, setAllowCopy] = useState<TriState>(null);
  const [blockScreenshots, setBlockScreenshots] = useState<TriState>(null);
  const [blurScreenRecording, setBlurScreenRecording] = useState<TriState>(null);
  const [notifyScreenshotAttempts, setNotifyScreenshotAttempts] = useState<TriState>(null);

  const [defaults, setDefaults] = useState<{
    allowForward?: boolean;
    allowCopy?: boolean;
    notifyScreenshotAttempts?: boolean;
  }>({
    allowForward: true,
    allowCopy: true,
    notifyScreenshotAttempts: true,
  });
  // Conditionally mounted by its parent: open whenever rendered.
  const a11yRef = useModalA11y(true, onClose);

  // Load settings on mount
  useEffect(() => {
    api
      .get(`/messages/${chatId}/privacy`)
      .then(res => {
        const d = res.data || {};
        const raw = d.rawOverrides || {};
        const defs = d.defaults || {};

        setDefaults({
          allowForward: defs.allowForward ?? true,
          allowCopy: defs.allowCopy ?? true,
          notifyScreenshotAttempts: defs.notifyScreenshotAttempts ?? true,
        });

        setAllowForward(raw.allowForward ?? null);
        setAllowCopy(raw.allowCopy ?? null);
        setBlockScreenshots(raw.blockScreenshot ?? null);
        setBlurScreenRecording(raw.blurScreenRecording ?? null);
        setNotifyScreenshotAttempts(raw.notifyScreenshotAttempts ?? null);
      })
      .catch(logger.error);
  }, [chatId]);

  // Helper to patch changes
  const patch = (payload: any) => {
    api.patch(`/messages/${chatId}/privacy`, payload).catch(logger.error);
  };

  const handleResetToDefaults = () => {
    setAllowForward(null);
    setAllowCopy(null);
    setBlockScreenshots(null);
    setBlurScreenRecording(null);
    setNotifyScreenshotAttempts(null);
    patch({
      allowForward: null,
      allowCopy: null,
      blockScreenshots: null,
      blurScreenRecording: null,
      notifyScreenshotAttempts: null,
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={a11yRef}
        role="dialog" aria-modal="true" tabIndex={-1}
        key="privacy-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-[#0a0a0a] rounded-2xl w-full max-w-lg p-6 border border-white/10 shadow-2xl overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <Shield size={22} className="text-[#ff1493]" /> Chat Privacy Settings
            </h2>
            <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <p className="text-xs text-white/50 mb-6 leading-relaxed">
            Configure privacy rules for this chat. Options set to <strong className="text-white/80">Default</strong> automatically inherit your global message settings.
          </p>

          {/* Settings List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 py-2 border-b border-white/5">
              <div>
                <span className="text-sm font-semibold text-white/90">Allow Forwarding</span>
                <p className="text-xs text-white/40">Recipients can forward your messages</p>
              </div>
              <ThreeStateToggle
                value={allowForward}
                defaultValue={defaults.allowForward}
                onChange={v => {
                  setAllowForward(v);
                  patch({ allowForward: v });
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-b border-white/5">
              <div>
                <span className="text-sm font-semibold text-white/90">Allow Text Copying</span>
                <p className="text-xs text-white/40">Recipients can copy message text</p>
              </div>
              <ThreeStateToggle
                value={allowCopy}
                defaultValue={defaults.allowCopy}
                onChange={v => {
                  setAllowCopy(v);
                  patch({ allowCopy: v });
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-b border-white/5">
              <div>
                <span className="text-sm font-semibold text-white/90">Block Screenshots</span>
                <p className="text-xs text-white/40">Prevent screen capture in this chat</p>
              </div>
              <ThreeStateToggle
                value={blockScreenshots}
                defaultValue={false}
                labels={{
                  default: 'Default (Off)',
                  on: 'Block',
                  off: 'Allow'
                }}
                onChange={v => {
                  setBlockScreenshots(v);
                  patch({ blockScreenshots: v });
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-b border-white/5">
              <div>
                <span className="text-sm font-semibold text-white/90">Blur Screen Recording</span>
                <p className="text-xs text-white/40">Blur content during screen recording</p>
              </div>
              <ThreeStateToggle
                value={blurScreenRecording}
                defaultValue={true}
                labels={{
                  default: 'Default (On)',
                  on: 'Blur',
                  off: "Don't blur"
                }}
                onChange={v => {
                  setBlurScreenRecording(v);
                  patch({ blurScreenRecording: v });
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-b border-white/5">
              <div>
                <span className="text-sm font-semibold text-white/90">Screenshot Alerts</span>
                <p className="text-xs text-white/40">Get notified when screenshots occur</p>
              </div>
              <ThreeStateToggle
                value={notifyScreenshotAttempts}
                defaultValue={defaults.notifyScreenshotAttempts}
                labels={{
                  default: `Default (${defaults.notifyScreenshotAttempts ? 'On' : 'Off'})`,
                  on: 'Notify',
                  off: "Don't notify"
                }}
                onChange={v => {
                  setNotifyScreenshotAttempts(v);
                  patch({ notifyScreenshotAttempts: v });
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="text-xs font-semibold text-white/50 hover:text-white flex items-center gap-1.5 transition-colors py-2"
            >
              <RefreshCw size={14} /> Reset all to defaults
            </button>

            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#ff1493] text-white font-bold text-sm rounded-xl hover:bg-[#e01484] shadow-lg shadow-[#ff1493]/20 transition-all hover:scale-105 active:scale-95"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
