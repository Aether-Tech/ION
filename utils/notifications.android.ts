import { ReminderNotification, ReminderSyncOptions } from './notifications.types';

// Implementação STUB para Android (sem expo-notifications) para evitar crash
// "expo-notifications: Android Push notifications ... removed from Expo Go"

export const ensureNotificationPermissions = async (): Promise<boolean> => {
    console.log('Notifications (Android): Permissions check skipped (module disabled)');
    return false;
};

export const syncReminderNotifications = async (
    reminders: ReminderNotification[],
    options?: ReminderSyncOptions
) => {
    console.log('Notifications (Android): Sync skipped (module disabled)');
};

export const cancelReminderNotification = async (reminderId: string) => {
    console.log('Notifications (Android): Remove skipped (module disabled)');
};

export const setupNotifications = () => {
    console.log('Notifications (Android): Setup skipped (module disabled)');
};
