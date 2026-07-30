export interface BadgeConfig {
  color: string;
  label: string;
  badgeType: 'system' | 'ai' | 'marketplace' | 'support' | 'creator' | 'business' | 'user';
  isOfficial?: boolean;
}

export const VerificationBadgeConfig: Record<string, BadgeConfig> = {
  system: {
    color: '#3B82F6', // 💙 Blue
    label: 'Official',
    badgeType: 'system',
    isOfficial: true,
  },
  ai: {
    color: '#F43F5E', // ❤️ Rose Red
    label: 'Sparkle AI',
    badgeType: 'ai',
    isOfficial: true,
  },
  bot: {
    color: '#F43F5E', // ❤️ Rose Red
    label: 'Sparkle AI',
    badgeType: 'ai',
    isOfficial: true,
  },
  marketplace: {
    color: '#EAB308', // 🟡 Gold
    label: 'Marketplace',
    badgeType: 'marketplace',
    isOfficial: true,
  },
  support: {
    color: '#22C55E', // 🟢 Green
    label: 'Support',
    badgeType: 'support',
    isOfficial: true,
  },
  creator: {
    color: '#EC4899', // 🩷 Sparkle Pink
    label: 'Creator',
    badgeType: 'creator',
  },
  business: {
    color: '#A855F7', // 🟣 Purple
    label: 'Business',
    badgeType: 'business',
  },
  user: {
    color: '#3B82F6', // 💙 Blue
    label: 'Verified',
    badgeType: 'user',
  },
};

export interface ResolvedIdentity {
  id: string;
  displayName: string;
  username: string;
  avatar: string;
  isSystem: boolean;
  accountType: string;
  badge: {
    show: boolean;
    color: string;
    label: string;
    badgeType: string;
    isOfficial: boolean;
  };
  subtitle: string;
  presence: {
    showPresence: boolean;
    isOnline: boolean;
    statusText: string;
  };
  capabilities: {
    canMessage: boolean;
    canCall: boolean;
    canReport: boolean;
    canFollow: boolean;
  };
}

export class IdentityManager {
  /**
   * Resolves unified identity details for any user payload across the platform.
   */
  static resolveIdentity(user: any): ResolvedIdentity {
    if (!user) {
      return {
        id: '',
        displayName: 'Sparkle User',
        username: 'sparkleuser',
        avatar: '/assets/system/sparkle-logo.svg',
        isSystem: false,
        accountType: 'user',
        badge: { show: false, color: '#3B82F6', label: '', badgeType: 'user', isOfficial: false },
        subtitle: '',
        presence: { showPresence: true, isOnline: false, statusText: 'Offline' },
        capabilities: { canMessage: true, canCall: true, canReport: true, canFollow: true },
      };
    }

    const cleanUsername = (user.username || user.partner_username || user.handle || '').toLowerCase().replace(/^@/, '');
    const userId = String(user.user_id || user.id || user.partner_id || user.participant_id || '');
    
    const isSystemAccount = (
      (userId && (userId === 'd75fe3b5-7a45-4581-ab13-91934d8b54de' || userId.startsWith('d75fe3b5-7a45-4581-ab13-91934d8b54e'))) ||
      ['sparkleofficial', 'sparklesafety', 'sparkleai', 'sparklesupport', 'sparklemarket', 'sparklecampus', 'sparkle'].includes(cleanUsername) ||
      user.account_type === 'system' ||
      user.is_system_account === 1 ||
      user.is_system_account === true
    );

    const isBot = user.account_type === 'bot' || user.account_type === 'ai' || cleanUsername.includes('sparkle_ai') || cleanUsername === 'sparkleai';
    const isMarketplace = user.account_type === 'marketplace' || cleanUsername.includes('sparkle_marketplace') || cleanUsername === 'sparklemarket';
    const isSupport = user.account_type === 'support' || cleanUsername.includes('sparkle_support') || cleanUsername === 'sparklesupport';

    const accountType = isSystemAccount ? 'system' : (user.account_type || user.accountType || 'user').toLowerCase();
    const validDisplayName = (!isSystemAccount && user.display_name === 'Sparkle Official') ? null : user.display_name;
    const displayName = user.displayName || validDisplayName || user.partner_name || user.name || user.username || 'Sparkle User';

    // 1. Avatar Pipeline Resolution
    // System/Official -> Sparkle Logo -> avatar_url -> profile_photo -> partner_avatar -> generated avatar -> placeholder
    let avatar = '/assets/system/sparkle-logo.svg';
    if (!isSystemAccount) {
      if (user.avatar_url) avatar = user.avatar_url;
      else if (user.profile_photo) avatar = user.profile_photo;
      else if (user.avatar) avatar = user.avatar;
      else if (user.partner_avatar) avatar = user.partner_avatar;
      else {
        avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;
      }
    }

    // 2. Badge Resolution
    let badgeTypeKey = accountType;
    if (isSystemAccount) badgeTypeKey = 'system';
    else if (isBot) badgeTypeKey = 'ai';
    else if (isMarketplace) badgeTypeKey = 'marketplace';
    else if (isSupport) badgeTypeKey = 'support';

    const isVerified = user.is_verified === 1 || user.is_verified === true || isSystemAccount || isBot || isMarketplace || isSupport;
    const badgeConfig = VerificationBadgeConfig[badgeTypeKey] || VerificationBadgeConfig.user;

    const badge = {
      show: isVerified,
      color: badgeConfig.color,
      label: badgeConfig.label,
      badgeType: badgeConfig.badgeType,
      isOfficial: !!badgeConfig.isOfficial || isSystemAccount,
    };

    // 3. Subtitle Resolution
    let subtitle = user.bio || user.status_message || '';
    if (isSystemAccount) {
      subtitle = user.bio || 'Official Sparkle Account • Helping you discover Sparkle';
    } else if (isBot) {
      subtitle = 'Sparkle AI • Always here to help';
    } else if (isMarketplace) {
      subtitle = 'Sparkle Marketplace • Buy • Sell • Discover';
    } else if (isSupport) {
      subtitle = 'Sparkle Support • Average reply time < 1 min';
    } else if (accountType === 'creator') {
      subtitle = user.bio || 'Verified Sparkle Creator';
    } else if (accountType === 'business') {
      subtitle = user.bio || 'Official Business Account';
    }

    // 4. Presence Resolution
    const isOnline = user.partner_online === true || user.is_online === 1 || user.is_online === true;
    const presence = {
      showPresence: !isSystemAccount && !isBot && !isMarketplace && !isSupport,
      isOnline,
      statusText: isOnline ? 'Online' : 'Offline',
    };

    // 5. Capabilities Resolution
    const capabilities = {
      canMessage: !isSystemAccount, // System accounts are read-only official broadcast channels
      canCall: !isSystemAccount && !isBot && !isMarketplace,
      canReport: !isSystemAccount,
      canFollow: !isSystemAccount,
    };

    return {
      id: user.user_id || user.id || user.partner_id || '',
      displayName,
      username: cleanUsername ? `@${cleanUsername}` : '',
      avatar,
      isSystem: isSystemAccount,
      accountType,
      badge,
      subtitle,
      presence,
      capabilities,
    };
  }
}
