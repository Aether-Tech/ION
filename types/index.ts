// Tipos globais da aplicação

export interface User {
  phoneNumber: string;
  name?: string;
  email?: string;
}

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  date: Date;
  completed: boolean;
  phoneNumber?: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: Date;
  category: string;
  phoneNumber?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  phoneNumber?: string;
}

