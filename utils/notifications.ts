import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const WEBHOOK_URL = 'https://n8n.goaether.xyz/webhook/a90d5230-303e-4814-aa31-1210573f6eeb';

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
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Lembretes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1B5BFF',
    });
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

export function syncReminderNotifications(reminders: ReminderNotification[]): Promise<void>;
export function syncReminderNotifications(
  reminders: ReminderNotification[],
  options: ReminderSyncOptions
): Promise<void>;
export async function syncReminderNotifications(
  reminders: ReminderNotification[],
  options?: ReminderSyncOptions
) {
  const pushEnabled = options?.pushEnabled ?? true;
  const webhookEnabled = options?.webhookEnabled ?? true;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
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

      if (pushEnabled) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            sound: 'default',
            data: { reminderId: reminder.id },
          },
          trigger,
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
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const notification = scheduled.find((item) => item.content.data?.reminderId === reminderId);
    if (notification) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
    clearScheduledWebhook(reminderId);
  } catch (error) {
    console.warn('Erro ao cancelar notificação do lembrete:', error);
  }
};


