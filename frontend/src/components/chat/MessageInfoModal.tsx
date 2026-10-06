import React, { useState, useEffect } from 'react';
import { 
  X, Check, CheckCheck, Clock, Edit2, Share2, CornerUpLeft, 
  Smile, User, ShieldCheck, Info
} from 'lucide-react';
import api from '../../api/api';
import { logger } from '../../utils/logger';

interface MessageInfoModalProps {
  messageId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MessageInfoModal: React.FC<MessageInfoModalProps> = ({
  messageId,
  isOpen,
  onClose
}) => {
  const [info, setInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && messageId) {
      fetchMessageInfo();
    }
  }, [isOpen, messageId]);

  const fetchMessageInfo = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/messages/${messageId}/info`);
      if (response.data?.status === 'success') {
        setInfo(response.data.data);
      }
    } catch (err) {
      logger.error('Error fetching message info:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Message Info</h2>
              <p className="text-[11px] text-slate-400">Delivery, read status & interactions</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Fetching message details...</p>
            </div>
          ) : !info ? (
            <div className="text-center py-8 text-xs text-slate-400">Unable to load message info</div>
          ) : (
            <>
              {/* Message Content Preview */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 mb-1">
                  <span>{info.sender_name || 'Sender'}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{info.content || '[Media]'}</p>
              </div>

              {/* Status Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Timeline</h3>
                
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-4">
                  {/* Sent */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-700/50 rounded-xl text-slate-300">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200">Sent</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(info.timeline?.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500">{new Date(info.timeline?.sent_at).toLocaleDateString()}</span>
                  </div>

                  {/* Delivered */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200">Delivered</p>
                        <p className="text-[10px] text-slate-400">
                          {info.timeline?.delivered_at ? new Date(info.timeline.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Delivered'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-blue-400 font-medium">Delivered</span>
                  </div>

                  {/* Seen / Read */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <CheckCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200">Seen</p>
                        <p className="text-[10px] text-slate-400">
                          {info.timeline?.seen_at ? new Date(info.timeline.seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not seen yet'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium ${info.timeline?.seen_at ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {info.timeline?.seen_at ? 'Read' : 'Unread'}
                    </span>
                  </div>

                  {/* Edited */}
                  {info.timeline?.edited_at && (
                    <div className="flex items-center justify-between text-xs border-t border-slate-800/60 pt-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                          <Edit2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200">Edited</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(info.timeline.edited_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-amber-400 font-medium">Modified</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Metadata */}
              {(info.forwarded || info.reactions?.length > 0 || info.replies_count > 0) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interactions</h3>
                  
                  <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                    {info.forwarded && (
                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <Share2 className="w-4 h-4 text-purple-400" />
                        <span>Forwarded from <strong>{info.forwarded_from || 'Someone'}</strong></span>
                      </div>
                    )}

                    {info.replies_count > 0 && (
                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <CornerUpLeft className="w-4 h-4 text-pink-400" />
                        <span>Replies count: <strong>{info.replies_count}</strong></span>
                      </div>
                    )}

                    {info.reactions?.length > 0 && (
                      <div className="space-y-2 border-t border-slate-800/60 pt-2">
                        <p className="text-[11px] font-semibold text-slate-400">Reactions</p>
                        <div className="flex flex-wrap gap-2">
                          {info.reactions.map((r: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-700/60 rounded-full text-xs">
                              <span>{r.emoji}</span>
                              <span className="text-slate-300 text-[11px]">{r.user_name || 'User'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
