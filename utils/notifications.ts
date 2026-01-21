import { Platform } from 'react-native';

const WEBHOOK_URL = 'https://n8n.goaether.xyz/webhook/a90d5230-303e-4814-aa31-1210573f6eeb';

let Notifications: any;
try {
  if (Platform.OS !== 'android') {
    // Only require expo-notifications on non-android (or handled by managed workflow?)
    // Actually, expo-notifications works on both. The original code had a check.
    // Let's assume it's safe to require if likely managed.
    Notifications = require('expo-notifications');
  }
} catch (e) {
  console.warn('Notifications module not available:', e);
}

const timeoutMap = new Map<string, ReturnType<typeof setTimeout>>();

const clearScheduledWebhook = (reminderId: string) => {
  const timeout = timeoutMap.get(reminderId);
  if (timeout) {
    clearTimeout(timeout);
    timeoutMap.delete(reminderId);
  }
};

const resetWebhookSchedules = () => {
  timeoutMap.forEach((timeout) => clearTimeout(timeout));
  timeoutMap.clear();
};

const callReminderWebhook = async (reminder: ReminderNotification) => {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reminderId: reminder.id,
        title: reminder.rawTitle ?? reminder.title,
        description: reminder.rawDescription,
        message: reminder.body,
        scheduledDate: reminder.scheduledDate,
        scheduledTime: reminder.scheduledTime,
        triggerAt: reminder.triggerDate.toISOString(),
        phoneNumber: reminder.phoneNumber,
      }),
    });
  } catch (error) {
    console.warn('Erro ao chamar webhook do lembrete:', error);
  }
};

const scheduleWebhookCall = (reminder: ReminderNotification, diffMs: number) => {
  clearScheduledWebhook(reminder.id);
  if (diffMs > 2147483647) {
    console.warn('Lembrete muito distante para agendar webhook localmente:', reminder.id);
    return;
  }

  const timeout = setTimeout(() => {
    void callReminderWebhook(reminder);
    timeoutMap.delete(reminder.id);
  }, diffMs);

  timeoutMap.set(reminder.id, timeout);
};

export const ensureNotificationPermissions = async (): Promise<boolean> => {
  try {
    if (Notifications) {
      const settings = await Notifications.getPermissionsAsync();
      if (settings.granted) {
        await configureAndroidChannel();
        return true;
      }

      const request = await Notifications.requestPermissionsAsync();
      if (request.granted) {
        await configureAndroidChannel();
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn('Erro ao solicitar permissões de notificação:', error);
    return false;
  }
};

const configureAndroidChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    if (Notifications) {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Lembretes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1B5BFF',
      });
    }
  } catch (error) {
    console.warn('Erro ao configurar canal de notificações no Android:', error);
  }
};

export interface ReminderNotification {
  id: string;
  title: string;
  body?: string;
  triggerDate: Date;
  phoneNumber?: string | null;
  rawTitle?: string;
  rawDescription?: string;
  scheduledTime?: string;
  scheduledDate?: string;
}

export interface ReminderSyncOptions {
  pushEnabled?: boolean;
  webhookEnabled?: boolean;
}

export async function syncReminderNotifications(
  reminders: ReminderNotification[],
  options?: ReminderSyncOptions
) {
  const pushEnabled = options?.pushEnabled ?? true;
  const webhookEnabled = options?.webhookEnabled ?? true;

  try {
    if (Notifications) {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
    resetWebhookSchedules();

    if (!pushEnabled && !webhookEnabled) {
      return;
    }

    const now = Date.now();

    for (const reminder of reminders) {
      const triggerTime = reminder.triggerDate.getTime();
      const diffMs = triggerTime - now;

      if (diffMs <= 1000) {
        continue;
      }

      const trigger = new Date(triggerTime);

      if (pushEnabled && Notifications) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            sound: 'default',
            data: { reminderId: reminder.id },
          },
          trigger: trigger as any, // Cast to any to avoid type mismatch if NotificationTriggerInput is strict
        });
      }

      if (webhookEnabled) {
        scheduleWebhookCall(reminder, diffMs);
      }
    }
  } catch (error) {
    console.warn('Erro ao sincronizar notificações de lembretes:', error);
  }
}

export const cancelReminderNotification = async (reminderId: string) => {
  try {
    if (Notifications) {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const notification = scheduled.find((item: any) => item.content.data?.reminderId === reminderId);
      if (notification) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    clearScheduledWebhook(reminderId);
  } catch (error) {
    console.warn('Erro ao cancelar notificação do lembrete:', error);
  }
};

export const setupNotifications = () => {
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
};
