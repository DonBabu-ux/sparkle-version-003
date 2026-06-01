import React, { useState, useEffect } from 'react';
import { X, Shield, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/api';
import { clsx } from 'clsx';

// Simple Toggle component
const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={clsx(
      'relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none',
      enabled ? 'bg-[#ff1493]' : 'bg-white/20'
    )}
  >
    <span
      className={clsx(
        'inline-block w-4 h-4 transform bg-white rounded-full transition-transform',
        enabled ? 'translate-x-5' : 'translate-x-1'
      )}
    />
  </button>
);

interface PrivacySettingsModalProps {
  chatId: string; // chat identifier
  onClose: () => void;
}

export default function PrivacySettingsModal({ chatId, onClose }: PrivacySettingsModalProps) {
  const [allowForward, setAllowForward] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [blockScreenshots, setBlockScreenshots] = useState(false);
  const [blurScreenRecording, setBlurScreenRecording] = useState(true);
  const [notifyScreenshotAttempts, setNotifyScreenshotAttempts] = useState(true);

  // Load settings on mount
  useEffect(() => {
    api
      .get(`/messages/${chatId}/privacy`)
      .then(res => {
        const d = res.data || {};
        setAllowForward(d.allowForward ?? true);
        setAllowCopy(d.allowCopy ?? true);
        setBlockScreenshots(d.blockScreenshots ?? false);
        setBlurScreenRecording(d.blurScreenRecording ?? true);
        setNotifyScreenshotAttempts(d.notifyScreenshotAttempts ?? true);
      })
      .catch(console.error);
  }, [chatId]);

  // Helper to patch changes
  const patch = (payload: any) => {
    api.patch(`/messages/${chatId}/privacy`, payload).catch(console.error);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="privacy-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-[#0a0a0a] rounded-xl w-full max-w-md p-6 border border-white/10 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield size={20} className="text-[#ff1493]" /> Privacy Settings
            </h2>
            <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Settings List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Allow Forwarding</span>
              <Toggle
                enabled={allowForward}
                onChange={v => {
                  setAllowForward(v);
                  patch({ allowForward: v, allowCopy, blockScreenshots, blurScreenRecording, notifyScreenshotAttempts });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Allow Copy</span>
              <Toggle
                enabled={allowCopy}
                onChange={v => {
                  setAllowCopy(v);
                  patch({ allowForward, allowCopy: v, blockScreenshots, blurScreenRecording, notifyScreenshotAttempts });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Block Screenshots</span>
              <Toggle
                enabled={blockScreenshots}
                onChange={v => {
                  setBlockScreenshots(v);
                  patch({ allowForward, allowCopy, blockScreenshots: v, blurScreenRecording, notifyScreenshotAttempts });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Blur on Screen Recording</span>
              <Toggle
                enabled={blurScreenRecording}
                onChange={v => {
                  setBlurScreenRecording(v);
                  patch({ allowForward, allowCopy, blockScreenshots, blurScreenRecording: v, notifyScreenshotAttempts });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Notify Screenshot Attempts</span>
              <Toggle
                enabled={notifyScreenshotAttempts}
                onChange={v => {
                  setNotifyScreenshotAttempts(v);
                  patch({ allowForward, allowCopy, blockScreenshots, blurScreenRecording, notifyScreenshotAttempts: v });
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#ff1493] text-white rounded-lg hover:bg-[#e01484] transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
