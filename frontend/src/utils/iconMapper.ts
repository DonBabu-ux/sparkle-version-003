import React from 'react';
import { 
  PartyPopper, 
  Shield, 
  Lock, 
  CheckCircle2, 
  Zap, 
  AlertTriangle, 
  Wrench, 
  ShieldAlert, 
  MessageSquare, 
  Bell, 
  Heart,
  UserPlus,
  HelpCircle,
  LucideIcon
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  party: PartyPopper,
  shield: Shield,
  lock: Lock,
  'check-circle': CheckCircle2,
  zap: Zap,
  'alert-triangle': AlertTriangle,
  tool: Wrench,
  'shield-off': ShieldAlert,
  'shield-alert': ShieldAlert,
  'message-square': MessageSquare,
  comment: MessageSquare,
  bell: Bell,
  heart: Heart,
  like: Heart,
  follow: UserPlus,
  'user-plus': UserPlus,
  help: HelpCircle,
};

export const getNotificationIcon = (iconName: string | null | undefined): LucideIcon => {
  if (!iconName) return Bell;
  const normalized = iconName.toLowerCase().trim();
  return iconMap[normalized] || Bell;
};
