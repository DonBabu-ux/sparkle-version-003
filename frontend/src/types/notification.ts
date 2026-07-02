export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export type NotificationCategory = 
  | 'security'
  | 'social'
  | 'system'
  | 'announcement'
  | 'onboarding'
  | 'commerce'
  | 'community';

export interface NotificationEntity {
  type: 'user' | 'group' | 'hashtag' | 'post';
  id: string;
  text: string;
}

export interface NotificationAction {
  label: string;
  route: string | null;
  style: 'primary' | 'secondary' | 'ghost';
}

export interface SparkleNotification {
  id: string;
  type: string;
  senderId: string | null;
  title: string;
  body: string;
  icon: string | null;
  entities: NotificationEntity[];
  actions: NotificationAction[];
  priority: NotificationPriority;
  category: NotificationCategory;
  isOfficial: boolean;
  isRead: boolean;
  createdAt: string;
  
  // Backwards compatibility
  notification_id?: string;
  content?: string;
  action_url?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_username?: string | null;
  actor_avatar?: string | null;
  aggregation_count?: number;
  related_user?: {
    id: string;
    username: string;
    name: string;
    avatar: string;
  } | null;
}
