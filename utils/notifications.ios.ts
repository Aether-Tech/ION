import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ReminderNotification, ReminderSyncOptions } from './notifications.types';

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
            // Android channel config removed or logic kept if cross-compat needed, 
            // but this file is .ios.ts so we can skip android channel config.
            return true;
        }

        const request = await Notifications.requestPermissionsAsync();
        if (request.granted) {
            return true;
        }

        return false;
    } catch (error) {
        console.warn('Erro ao solicitar permissões de notificação:', error);
        return false;
    }
};

// No-op on iOS or strict typed? 
// Original code had configureAndroidChannel logic but guarded.
// We can just omit it or keep it empty.

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
                    trigger: trigger as unknown as Notifications.NotificationTriggerInput,
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

export const setupNotifications = () => {
    console.log('Notifications (iOS): Setting up handler...');
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
};
