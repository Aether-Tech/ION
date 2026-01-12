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
