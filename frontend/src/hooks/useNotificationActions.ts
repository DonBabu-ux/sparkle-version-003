import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notificationStore';
import type { SparkleNotification, NotificationAction } from '../types/notification';

export const useNotificationActions = () => {
  const navigate = useNavigate();
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);

  const handleNotificationClick = async (notification: SparkleNotification) => {
    // Mark as read immediately (optimistic)
    if (!notification.isRead) {
      await markRead(notification.id);
    }

    // Handle primary action navigation
    if (notification.actions && notification.actions.length > 0) {
      const primaryAction = notification.actions[0];
      if (primaryAction.route) {
        navigate(primaryAction.route);
      }
    } else if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleActionClick = async (
    e: React.MouseEvent,
    notification: SparkleNotification,
    action: NotificationAction
  ) => {
    e.stopPropagation();
    e.preventDefault();

    // Mark as read immediately
    if (!notification.isRead) {
      await markRead(notification.id);
    }

    if (action.route) {
      navigate(action.route);
    }
  };

  return {
    handleNotificationClick,
    handleActionClick,
    markRead,
    markAllRead,
  };
};
