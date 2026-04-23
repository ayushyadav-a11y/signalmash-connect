import { create } from 'zustand';

export type NotificationVariant = 'success' | 'error' | 'info';

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  variant: NotificationVariant;
}

interface NotificationState {
  notifications: NotificationItem[];
  push: (notification: Omit<NotificationItem, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  push: (notification) => {
    const id = crypto.randomUUID();
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));
    return id;
  },
  dismiss: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
    }));
  },
}));

export const notify = {
  success: (title: string, description?: string) =>
    useNotificationStore.getState().push({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useNotificationStore.getState().push({ title, description, variant: 'error' }),
  info: (title: string, description?: string) =>
    useNotificationStore.getState().push({ title, description, variant: 'info' }),
};
