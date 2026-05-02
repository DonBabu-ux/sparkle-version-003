import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Share2 } from 'lucide-react';

interface ProfileShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  name: string;
}

// Authentic Brand Logos as SVGs
const WhatsAppLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.3-.149-1.777-.878-2.053-.978-.276-.1-.476-.149-.676.15-.2.299-.775.978-.95 1.177-.175.199-.35.224-.65.075-.3-.149-1.27-.468-2.42-1.493-.895-.798-1.499-1.784-1.674-2.083-.175-.299-.018-.46.132-.609.135-.133.3-.35.45-.524.15-.174.2-.299.3-.499.1-.2.05-.375-.025-.524-.075-.15-.676-1.626-.926-2.227-.244-.588-.492-.507-.676-.516-.174-.008-.374-.01-.574-.01s-.524.075-.798.375c-.274.299-1.048 1.024-1.048 2.5 0 1.474 1.073 2.896 1.223 3.096.15.199 2.113 3.226 5.12 4.526.714.309 1.272.494 1.706.633.717.228 1.369.196 1.884.119.574-.085 1.777-.726 2.027-1.426.25-.7.25-1.299.175-1.426-.075-.124-.275-.199-.575-.349zM12.004 2C6.48 2 2 6.48 2 12c0 1.758.459 3.413 1.33 4.856L2.05 22l5.297-1.39C8.71 21.483 10.312 22 12.004 22 17.525 22 22 17.525 22 12s-4.475-10-9.996-10z" fill="#25D366"/>
  </svg>
);

const FacebookLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" fill="#1877F2"/>
  </svg>
);

const SMSLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM17 13H7V11H17V13ZM17 10H7V8H17V10Z" fill="#3B82F6"/>
  </svg>
);

const QRLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V9H9V3H3ZM7 7H5V5H7V7ZM3 15V21H9V15H3ZM7 19H5V17H7V19ZM15 3V9H21V3H15ZM19 7H17V5H19V7ZM15 15V17H17V15H15ZM17 17V19H15V21H17V19ZM19 19V21H21V19H19ZM21 17V15H19V17H21ZM17 11H15V13H17V11ZM13 3H11V21H13V3ZM21 11H19V13H21V11ZM17 13H19V15H17V13ZM13 11H11V13H13V11ZM11 11V13H13V11H11Z" fill="currentColor"/>
  </svg>
);

export default function ProfileShareModal({ isOpen, onClose, username, name }: ProfileShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  const profileUrl = `${window.location.origin}/profile/${username}`;
  
  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: <WhatsAppLogo />,
      color: 'bg-[#25D366]/10',
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${name}'s profile on Sparkle Marketplace: ${profileUrl}`)}`, '_blank')
    },
    {
      name: 'Facebook',
      icon: <FacebookLogo />,
      color: 'bg-[#1877F2]/10',
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`, '_blank')
    },
    {
      name: 'SMS',
      icon: <SMSLogo />,
      color: 'bg-blue-50',
      action: () => window.open(`sms:?body=${encodeURIComponent(`Check out ${name}'s profile on Sparkle Marketplace: ${profileUrl}`)}`, '_blank')
    }
  ];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple QR Code URL using a public API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(profileUrl)}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-white rounded-t-[32px] z-[101] px-6 pt-8 pb-10 max-w-lg mx-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black tracking-tighter">Share Profile</h2>
              <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex justify-around mb-10">
              {shareOptions.map((option) => (
                <button
                  key={option.name}
                  onClick={option.action}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className={`w-16 h-16 ${option.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    {option.icon}
                  </div>
                  <span className="text-sm font-bold text-slate-600">{option.name}</span>
                </button>
              ))}
              <button
                onClick={() => setShowQR(!showQR)}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`w-16 h-16 ${showQR ? 'bg-marketplace-text text-white' : 'bg-indigo-50 text-indigo-600'} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform transition-colors`}>
                  <QRLogo />
                </div>
                <span className="text-sm font-bold text-slate-600">QR Code</span>
              </button>
            </div>

            <AnimatePresence>
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="mb-8 flex flex-col items-center bg-slate-50 p-8 rounded-[24px] border border-slate-100"
                >
                  <img src={qrCodeUrl} alt="Profile QR Code" className="w-48 h-48 rounded-xl shadow-lg mb-4" />
                  <p className="text-sm font-bold text-slate-500">Scan to view {username}'s shop</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <input
                type="text"
                readOnly
                value={profileUrl}
                className="w-full bg-slate-100 border-none rounded-[18px] py-4 pl-5 pr-24 font-bold text-slate-600 text-sm focus:ring-2 focus:ring-marketplace-text transition-all"
              />
              <button
                onClick={copyToClipboard}
                className="absolute right-2 top-2 bottom-2 px-4 bg-marketplace-text text-white rounded-[14px] font-black text-xs flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-slate-200"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
