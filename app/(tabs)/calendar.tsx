import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HugeIcon } from '../../components/HugeIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Calendar, DateData } from 'react-native-calendars';
import { format, differenceInDays, differenceInHours, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAppColors } from '../../hooks/useAppColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { toDoService, lembretesService } from '../../services/supabaseService';
import { IONLogo } from '../../components/IONLogo';
import { chatService } from '../../services/api';
import { ensureNotificationPermissions, syncReminderNotifications, cancelReminderNotification } from '../../utils/notifications';

interface Reminder {
  id: string;
  title: string;
  description?: string;
  date: Date;
  completed: boolean;
  category?: string;
  createdAt: Date;
  completedAt?: Date;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  lembreteId?: number;
  dateTimeISO: string;
  phoneNumber?: string | null;
}

type TaskCategory = 'Pessoal' | 'Trabalho' | 'Saúde';
type TabType = 'tasks' | 'calendar';

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const PREFERENCES_STORAGE_KEY = '@ion/reminder-notification-preferences';

const getEventTriggerDate = (event: Event): Date => {
  if (event.dateTimeISO) {
    return new Date(event.dateTimeISO);
  }
  const [hours = 0, minutes = 0] = event.time.split(':').map(Number);
  const date = new Date(event.date);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export default function CalendarScreen() {
  const Colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  
  // Calendar states
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [events, setEvents] = useState<Event[]>([]);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({ app: true, whatsapp: true });
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);

  // Tasks states
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<TaskCategory>('Pessoal');
  const [oldTaskSuggestion, setOldTaskSuggestion] = useState<Reminder | null>(null);
  const [showIONMessage, setShowIONMessage] = useState(false);
  const [isGeneratingReminder, setIsGeneratingReminder] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [messageType, setMessageType] = useState<'old_task' | 'reminder_passed'>('old_task');
  const [activeLembrete, setActiveLembrete] = useState<any>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number>(15);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  
  // Calendar modal states
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventTime, setNewEventTime] = useState('');

  // Notifications setup
  useEffect(() => {
    let isMounted = true;
    const setupNotifications = async () => {
      const granted = await ensureNotificationPermissions();
      if (isMounted) {
        setNotificationsReady(granted);
        if (!granted) {
          console.warn('Permissões de notificação não concedidas.');
        }
      }
    };
    setupNotifications();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadPreferences = async () => {
      try {
        const stored = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored);
          setNotificationPreferences({
            app: typeof parsed?.app === 'boolean' ? parsed.app : true,
            whatsapp: typeof parsed?.whatsapp === 'boolean' ? parsed.whatsapp : true,
          });
        }
      } catch (error) {
        console.warn('Erro ao carregar preferências:', error);
      }
    };
    loadPreferences();
    return () => { isMounted = false; };
  }, []);

  // Load data
  useEffect(() => {
    if (authLoading) return;
    if (!user?.usuarioId) {
      setLoading(false);
      return;
    }
    loadData();
  }, [user?.usuarioId, user, authLoading]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60 * 60 * 1000);
    setCurrentDate(new Date());
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    if (!user?.usuarioId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setCurrentDate(new Date());
    
    try {
      // Load tasks
      const todosData = await toDoService.getByUsuarioId(user.usuarioId);
      const lembretesData = await lembretesService.getByUsuarioId(user.usuarioId);
      
      const now = new Date();
      const tasksToDelete: number[] = [];
      
      const remindersFormatted: Reminder[] = todosData.map((todo) => {
        const completed = todo.status === 'concluido' || todo.status === 'completo';
        const completedAt = todo.completed_at ? new Date(todo.completed_at) : null;
        
        if (completed && completedAt) {
          const hoursSinceCompletion = differenceInHours(now, completedAt);
          if (hoursSinceCompletion >= 24) {
            tasksToDelete.push(todo.id);
          }
        }
        
        return {
          id: todo.id.toString(),
          title: todo.item || 'Sem título',
          description: todo.categoria || undefined,
          date: todo.date ? new Date(todo.date) : new Date(),
          completed,
          category: todo.categoria as TaskCategory | undefined,
          createdAt: new Date(todo.created_at),
          completedAt: completedAt || undefined,
        };
      });
      
      let finalReminders: Reminder[];
      if (tasksToDelete.length > 0) {
        await Promise.all(tasksToDelete.map(id => toDoService.delete(id)));
        const updatedTodosData = await toDoService.getByUsuarioId(user.usuarioId);
        finalReminders = updatedTodosData.map((todo) => ({
          id: todo.id.toString(),
          title: todo.item || 'Sem título',
          description: todo.categoria || undefined,
          date: todo.date ? new Date(todo.date) : new Date(),
          completed: todo.status === 'concluido' || todo.status === 'completo',
          category: todo.categoria as TaskCategory | undefined,
          createdAt: new Date(todo.created_at),
          completedAt: todo.completed_at ? new Date(todo.completed_at) : undefined,
        }));
        setReminders(finalReminders);
      } else {
        finalReminders = remindersFormatted;
        setReminders(remindersFormatted);
      }
      
      // Check for old tasks or passed reminders
      const pendingReminders = finalReminders.filter(r => !r.completed);
      let reminderPassedTask: Reminder | null = null;
      let reminderPassedLembrete: any = null;
      
      for (const reminder of pendingReminders) {
        const taskLembretes = lembretesData.filter(l => 
          l.lembrete && reminder.title && 
          l.lembrete.toLowerCase().includes(reminder.title.toLowerCase()) &&
          l.data_para_lembrar
        );
        
        if (taskLembretes.length > 0) {
          for (const lembrete of taskLembretes) {
            if (lembrete.data_para_lembrar) {
              const lembreteDate = new Date(lembrete.data_para_lembrar);
              const hoursSinceLembrete = differenceInHours(now, lembreteDate);
              
              if (hoursSinceLembrete >= 2 && lembreteDate <= now) {
                reminderPassedTask = reminder;
                reminderPassedLembrete = lembrete;
                break;
              }
            }
          }
        }
      }
      
      if (reminderPassedTask && reminderPassedLembrete) {
        setOldTaskSuggestion(reminderPassedTask);
        setActiveLembrete(reminderPassedLembrete);
        setMessageType('reminder_passed');
        setShowIONMessage(true);
      } else {
        const oldTasks = finalReminders.filter((r) => {
          if (r.completed) return false;
          const hasActiveLembrete = lembretesData.some(l => 
            l.lembrete && r.title && 
            l.lembrete.toLowerCase().includes(r.title.toLowerCase()) &&
            l.data_para_lembrar &&
            new Date(l.data_para_lembrar) > now
          );
          if (hasActiveLembrete) return false;
          const daysSinceCreation = differenceInCalendarDays(now, r.createdAt);
          return daysSinceCreation >= 7;
        });
        
        if (oldTasks.length > 0) {
          const oldestTask = oldTasks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
          setOldTaskSuggestion(oldestTask);
          setMessageType('old_task');
          setActiveLembrete(null);
          setShowIONMessage(true);
        } else {
          setOldTaskSuggestion(null);
          setShowIONMessage(false);
        }
      }
      
      // Load calendar events
      const eventsFormatted: Event[] = lembretesData
        .filter((lembrete) => lembrete.data_para_lembrar)
        .map((lembrete) => {
          const dataLembrete = new Date(lembrete.data_para_lembrar!);
          return {
            id: lembrete.id.toString(),
            title: lembrete.lembrete || 'Lembrete',
            description: lembrete.recorrencia || undefined,
            date: format(dataLembrete, 'yyyy-MM-dd'),
            time: format(dataLembrete, 'HH:mm'),
            lembreteId: lembrete.id,
            dateTimeISO: lembrete.data_para_lembrar!,
            phoneNumber: lembrete.celular,
          };
        });
      
      setEvents(eventsFormatted);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sync notifications
  useEffect(() => {
    if (loading) return;
    const syncNotifications = async () => {
      const reminders = events.map((event) => {
        const triggerDate = getEventTriggerDate(event);
        return {
          id: event.id,
          title: `Lembrete: ${event.title}`,
          body: event.description ? `${event.description} • ${event.time}` : `Horário: ${event.time}`,
          triggerDate,
          phoneNumber: event.phoneNumber ?? user?.usuario?.celular ?? null,
          rawTitle: event.title,
          rawDescription: event.description,
          scheduledTime: event.time,
          scheduledDate: event.date,
        };
      });

      const pushEnabled = notificationsReady && notificationPreferences.app;
      const webhookEnabled = notificationPreferences.whatsapp;

      await syncReminderNotifications(reminders, {
        pushEnabled,
        webhookEnabled,
      });
    };
    void syncNotifications();
  }, [events, notificationsReady, loading, notificationPreferences.app, notificationPreferences.whatsapp, user?.usuario?.celular]);

  // Task functions (from reminders.tsx)
  const addReminder = async () => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    if (!newTitle.trim()) {
      Alert.alert('Erro', 'Por favor, insira um título para o lembrete');
      return;
    }

    try {
      const todo = await toDoService.create({
        item: newTitle,
        categoria: newCategory,
        date: format(new Date(), 'yyyy-MM-dd'),
        usuario_id: user.usuarioId,
        status: 'pendente',
      });

      if (todo) {
        const reminder: Reminder = {
          id: todo.id.toString(),
          title: todo.item || 'Sem título',
          description: todo.categoria || undefined,
          date: todo.date ? new Date(todo.date) : new Date(),
          completed: false,
          category: newCategory,
          createdAt: new Date(todo.created_at),
        };

        setReminders([...reminders, reminder]);
        setNewTitle('');
        setNewDescription('');
        setNewCategory('Pessoal');
        setModalVisible(false);
        await loadData();
    } else {
        throw new Error('Não foi possível criar a tarefa');
      }
    } catch (error) {
      console.error('Error adding reminder:', error);
      Alert.alert('Erro', 'Não foi possível adicionar a tarefa');
    }
  };

  const openEditModal = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setNewTitle(reminder.title);
    setNewDescription(reminder.description || '');
    setNewCategory((reminder.category as TaskCategory) || 'Pessoal');
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingReminder(null);
    setNewTitle('');
    setNewDescription('');
    setNewCategory('Pessoal');
  };

  const updateReminder = async () => {
    if (!user?.usuarioId || !editingReminder) {
      Alert.alert('Erro', 'Usuário não autenticado ou tarefa não encontrada');
      return;
    }

    if (!newTitle.trim()) {
      Alert.alert('Erro', 'Por favor, insira um título para o lembrete');
      return;
    }

    try {
      const todoId = parseInt(editingReminder.id);
      const updated = await toDoService.update(todoId, {
        item: newTitle,
        categoria: newCategory,
      });

      if (updated) {
        closeEditModal();
        await loadData();
      } else {
        throw new Error('Não foi possível atualizar a tarefa');
      }
    } catch (error) {
      console.error('Error updating reminder:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a tarefa');
    }
  };

  const getSimilarRemindersHistory = async (taskTitle: string): Promise<string> => {
    if (!user?.usuarioId) return '';
    try {
      const lembretes = await lembretesService.getByUsuarioId(user.usuarioId);
      const similarReminders = lembretes
        .filter(l => {
          const lembreteText = (l.lembrete || '').toLowerCase();
          const taskWords = taskTitle.toLowerCase().split(' ');
          return taskWords.some(word => word.length > 3 && lembreteText.includes(word));
        })
        .slice(0, 5);
      
      if (similarReminders.length === 0) return '';
      
      return similarReminders.map(l => {
        const date = l.data_para_lembrar ? new Date(l.data_para_lembrar) : null;
        const hour = date ? date.getHours() : null;
        return `- "${l.lembrete}" - geralmente lembrado às ${hour}h`;
      }).join('\n');
    } catch (error) {
      console.error('Error fetching similar reminders:', error);
      return '';
    }
  };

  const getSuggestedTimeFromGPT = async (taskTitle: string): Promise<number | null> => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const history = await getSimilarRemindersHistory(taskTitle);
      const preferredHours = await getPreferredHours(taskTitle);
      
      const prompt = `Você é a ION, uma assistente pessoal inteligente. Preciso que você sugira um horário (apenas a hora, número inteiro de 0 a 23) para criar um lembrete de uma tarefa.

Tarefa: "${taskTitle}"
Horário atual: ${currentHour}h${currentMinute > 0 ? currentMinute : ''}

${preferredHours.length > 0 ? `Horários preferidos do usuário para tarefas similares: ${preferredHours.join('h, ')}h
PRIORIZE usar um desses horários se ainda não tiver passado hoje.` : ''}

${history ? `Histórico de lembretes similares do usuário:
${history}

Use este histórico para sugerir um horário similar se a tarefa for parecida.` : ''}

Regras importantes:
1. O horário deve ser MAIOR que o horário atual (${currentHour}h${currentMinute > 0 ? currentMinute : ''})
2. O horário deve ter PELO MENOS 15 MINUTOS de diferença do horário atual
3. Se já for tarde (após 12h), não sugira horários da manhã
4. Considere o tipo de tarefa
5. ${preferredHours.length > 0 ? `PRIORIZE os horários preferidos: ${preferredHours.join('h, ')}h.` : 'Se houver histórico de lembretes similares, use o mesmo horário ou um pouco antes'}
6. O horário deve ser realista e viável para o tipo de tarefa

Responda APENAS com o número da hora (0-23), sem texto adicional.`;

      const phoneNumber = user?.phoneNumber || user?.usuario?.celular || 'user';
      const response = await chatService.sendMessage(phoneNumber, prompt);
      
      if (response.success && response.data?.message) {
        const responseText = response.data.message.trim();
        const hourMatch = responseText.match(/\b([0-9]|1[0-9]|2[0-3])\b/);
        if (hourMatch) {
          let suggestedHour = parseInt(hourMatch[1], 10);
          if (suggestedHour >= 0 && suggestedHour <= 23) {
            if (suggestedHour <= currentHour) {
              if (suggestedHour >= 6 && suggestedHour <= 22) {
                return suggestedHour;
              }
            } else {
              return suggestedHour;
            }
          }
        }
      }
      
      if (preferredHours.length > 0) {
        const nowForPreferred = new Date();
        const minTimeForPreferred = new Date(nowForPreferred.getTime() + 15 * 60 * 1000);
        const minHourForPreferred = minTimeForPreferred.getHours();
        const minMinuteForPreferred = minTimeForPreferred.getMinutes();
        const minValidHourForPreferred = minMinuteForPreferred > 0 ? minHourForPreferred + 1 : minHourForPreferred;
        
        const validPreferred = preferredHours.find(h => h >= minValidHourForPreferred && h <= 22);
        if (validPreferred) {
          return validPreferred;
        }
      }
      
      const nowForFallback = new Date();
      const minTimeForFallback = new Date(nowForFallback.getTime() + 15 * 60 * 1000);
      const minHourForFallback = minTimeForFallback.getHours();
      const minMinuteForFallback = minTimeForFallback.getMinutes();
      const minValidHourForFallback = minMinuteForFallback > 0 ? minHourForFallback + 1 : minHourForFallback;
      
      let fallbackHour = Math.max(minValidHourForFallback, 8);
      if (fallbackHour <= currentHour) {
        fallbackHour = currentHour + 1;
      }
      return Math.min(fallbackHour, 18);
    } catch (error) {
      console.error('Error getting suggested time from GPT:', error);
      try {
        const preferredHours = await getPreferredHours(taskTitle);
        if (preferredHours.length > 0) {
          const nowForError = new Date();
          const minTimeForError = new Date(nowForError.getTime() + 15 * 60 * 1000);
          const minHourForError = minTimeForError.getHours();
          const minMinuteForError = minTimeForError.getMinutes();
          const minValidHourForError = minMinuteForError > 0 ? minHourForError + 1 : minHourForError;
          
          const validPreferred = preferredHours.find(h => h >= minValidHourForError && h <= 22);
          if (validPreferred) {
            return validPreferred;
          }
        }
      } catch (e) {}
      const nowForFinal = new Date();
      const minTimeForFinal = new Date(nowForFinal.getTime() + 15 * 60 * 1000);
      const minHourForFinal = minTimeForFinal.getHours();
      const minMinuteForFinal = minTimeForFinal.getMinutes();
      const minValidHourForFinal = minMinuteForFinal > 0 ? minHourForFinal + 1 : minHourForFinal;
      const currentHourForFinal = nowForFinal.getHours();
      
      let fallbackHour = Math.max(minValidHourForFinal, 8);
      if (fallbackHour <= currentHourForFinal) {
        fallbackHour = currentHourForFinal + 1;
      }
      return Math.min(fallbackHour, 18);
    }
  };

  const savePreferredHour = async (taskTitle: string, hour: number) => {
    try {
      const key = `preferred_hour_${user?.usuarioId}`;
      const existing = await AsyncStorage.getItem(key);
      const preferences = existing ? JSON.parse(existing) : {};
      
      const keywords = taskTitle.toLowerCase().split(' ');
      const category = keywords.find(w => 
        ['academia', 'exercício', 'treino', 'malhar'].includes(w) ? 'exercicio' :
        ['compras', 'supermercado', 'mercado'].includes(w) ? 'compras' :
        ['médico', 'clínica', 'consulta', 'doutor'].includes(w) ? 'medico' :
        null
      ) || 'geral';
      
      if (!preferences[category]) {
        preferences[category] = [];
      }
      
      if (!preferences[category].includes(hour)) {
        preferences[category].push(hour);
        if (preferences[category].length > 5) {
          preferences[category] = preferences[category].slice(-5);
        }
      }
      
      await AsyncStorage.setItem(key, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving preferred hour:', error);
    }
  };

  const getPreferredHours = async (taskTitle: string): Promise<number[]> => {
    try {
      const key = `preferred_hour_${user?.usuarioId}`;
      const existing = await AsyncStorage.getItem(key);
      if (!existing) return [];
      
      const preferences = JSON.parse(existing);
      const keywords = taskTitle.toLowerCase().split(' ');
      const category = keywords.find(w => 
        ['academia', 'exercício', 'treino', 'malhar'].includes(w) ? 'exercicio' :
        ['compras', 'supermercado', 'mercado'].includes(w) ? 'compras' :
        ['médico', 'clínica', 'consulta', 'doutor'].includes(w) ? 'medico' :
        null
      ) || 'geral';
      
      return preferences[category] || [];
    } catch (error) {
      console.error('Error getting preferred hours:', error);
      return [];
    }
  };

  const handleIONYes = async () => {
    if (!oldTaskSuggestion || !user?.usuarioId) return;
    
    if (messageType === 'reminder_passed') {
      const now = new Date();
      const minTime = new Date(now.getTime() + 15 * 60 * 1000);
      const minHour = minTime.getHours();
      const minMinute = minTime.getMinutes();
      const defaultHour = minMinute > 0 
        ? (minHour + 1 <= 23 ? minHour + 1 : 8) 
        : (minHour <= 23 ? minHour : 8);
      setSelectedHour(defaultHour);
      setSelectedDay(0);
      setShowTimePicker(true);
      return;
    }
    
    try {
      setIsGeneratingReminder(true);
      setShowIONMessage(false);
      
      const suggestedHour = await getSuggestedTimeFromGPT(oldTaskSuggestion.title);
      
      const today = new Date();
      today.setHours(suggestedHour || 15, 0, 0, 0);
      
      const now = new Date();
      const minTime = new Date(now.getTime() + 15 * 60 * 1000);
      
      if (today.getTime() < minTime.getTime()) {
        if (today.getDate() === now.getDate()) {
          today.setTime(minTime.getTime());
          today.setSeconds(0, 0);
        } else {
          today.setDate(today.getDate() + 1);
        }
      }
      
      const lembrete = await lembretesService.create({
        usuario_id: user.usuarioId,
        lembrete: oldTaskSuggestion.title,
        data_para_lembrar: today.toISOString(),
        celular: null,
        recorrencia: 'Unico',
      });

      if (lembrete) {
        await savePreferredHour(oldTaskSuggestion.title, suggestedHour || 15);
        Alert.alert('Sucesso', `Lembrete criado para ${format(today, "dd/MM/yyyy 'às' HH'h'", { locale: ptBR })}`);
        setShowIONMessage(false);
        setOldTaskSuggestion(null);
        await loadData();
      } else {
        throw new Error('Não foi possível criar o lembrete');
      }
    } catch (error) {
      console.error('Error creating reminder:', error);
      Alert.alert('Erro', 'Não foi possível criar o lembrete');
      setShowIONMessage(true);
    } finally {
      setIsGeneratingReminder(false);
    }
  };

  const handleTimeSelection = async (hour: number, dayOffset: number) => {
    if (!oldTaskSuggestion || !user?.usuarioId) return;
    
    try {
      setIsGeneratingReminder(true);
      setShowTimePicker(false);
      setShowIONMessage(false);
      
      const selectedDate = new Date();
      selectedDate.setDate(selectedDate.getDate() + dayOffset);
      selectedDate.setHours(hour, 0, 0, 0);
      selectedDate.setMinutes(0, 0, 0);
      
      const now = new Date();
      const minTime = new Date(now.getTime() + 15 * 60 * 1000);
      
      if (dayOffset === 0) {
        if (selectedDate.getTime() < minTime.getTime()) {
          selectedDate.setTime(minTime.getTime());
          selectedDate.setSeconds(0, 0);
        }
      }
      
      if (activeLembrete) {
        const updated = await lembretesService.update(activeLembrete.id, {
          data_para_lembrar: selectedDate.toISOString(),
        });
        
        if (updated) {
          await savePreferredHour(oldTaskSuggestion.title, hour);
          Alert.alert('Sucesso', `Lembrete atualizado para ${format(selectedDate, "dd/MM/yyyy 'às' HH'h'", { locale: ptBR })}`);
        } else {
          throw new Error('Não foi possível atualizar o lembrete');
        }
      } else {
        const lembrete = await lembretesService.create({
          usuario_id: user.usuarioId,
          lembrete: oldTaskSuggestion.title,
          data_para_lembrar: selectedDate.toISOString(),
          celular: null,
          recorrencia: 'Unico',
        });

        if (lembrete) {
          await savePreferredHour(oldTaskSuggestion.title, hour);
          Alert.alert('Sucesso', `Lembrete criado para ${format(selectedDate, "dd/MM/yyyy 'às' HH'h'", { locale: ptBR })}`);
        } else {
          throw new Error('Não foi possível criar o lembrete');
        }
      }
      
      setOldTaskSuggestion(null);
      setActiveLembrete(null);
      await loadData();
    } catch (error) {
      console.error('Error creating/updating reminder:', error);
      Alert.alert('Erro', 'Não foi possível criar/atualizar o lembrete');
      setShowIONMessage(true);
    } finally {
      setIsGeneratingReminder(false);
    }
  };

  const handleIONNo = () => {
    setShowIONMessage(false);
    setOldTaskSuggestion(null);
  };

  const toggleComplete = async (id: string) => {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;

    const newStatus = !reminder.completed ? 'concluido' : 'pendente';
    const completedAt = !reminder.completed ? new Date().toISOString() : null;
    
    try {
      const todoId = parseInt(id);
      const updated = await toDoService.update(todoId, { 
        status: newStatus,
        completed_at: completedAt,
      });
      
      if (updated) {
        setReminders(reminders.map((r) =>
          r.id === id ? { 
            ...r, 
            completed: !r.completed,
            completedAt: completedAt ? new Date(completedAt) : undefined,
          } : r
        ));
      } else {
        throw new Error('Não foi possível atualizar a tarefa');
      }
    } catch (error) {
      console.error('Error updating todo:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a tarefa');
    }
  };

  const deleteReminder = (id: string) => {
    Alert.alert(
      'Excluir Lembrete',
      'Tem certeza que deseja excluir este lembrete?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const todoId = parseInt(id);
              const success = await toDoService.delete(todoId);
              if (success) {
                setReminders(reminders.filter((r) => r.id !== id));
              } else {
                Alert.alert('Erro', 'Não foi possível excluir a tarefa');
              }
            } catch (error) {
              console.error('Error deleting todo:', error);
              Alert.alert('Erro', 'Não foi possível excluir a tarefa');
            }
          },
        },
      ]
    );
  };

  // Calendar functions
  const handlePreferenceChange = (key: 'app' | 'whatsapp') => (value: boolean) => {
    setNotificationPreferences((prev) => {
      if (prev[key] === value) return prev;
      const updated = { ...prev, [key]: value };
      AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated)).catch((error) => {
        console.warn('Erro ao salvar preferências:', error);
      });
      return updated;
    });
  };

  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const addEvent = async () => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    if (!newEventTitle.trim() || !newEventTime.trim()) {
      Alert.alert('Erro', 'Por favor, preencha o título e o horário');
      return;
    }

    try {
      const [hours, minutes] = newEventTime.split(':').map(Number);
      const selectedDateObj = new Date(selectedDate + 'T00:00:00');
      selectedDateObj.setHours(hours || 0, minutes || 0, 0, 0);

      const lembrete = await lembretesService.create({
        data_para_lembrar: selectedDateObj.toISOString(),
        lembrete: newEventTitle,
        celular: user.usuario?.celular || null,
        usuario_id: user.usuarioId,
        recorrencia: newEventDescription || 'Unico',
      });

      if (lembrete) {
        const event: Event = {
          id: lembrete.id.toString(),
          title: lembrete.lembrete || newEventTitle,
          description: lembrete.recorrencia || undefined,
          date: selectedDate,
          time: newEventTime,
          lembreteId: lembrete.id,
          dateTimeISO: lembrete.data_para_lembrar || selectedDateObj.toISOString(),
          phoneNumber: lembrete.celular,
        };

        setEvents([...events, event]);
        setNewEventTitle('');
        setNewEventDescription('');
        setNewEventTime('');
        setCalendarModalVisible(false);
        await loadData();
      } else {
        throw new Error('Não foi possível criar o lembrete');
      }
    } catch (error) {
      console.error('Error adding event:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o evento');
    }
  };

  const deleteEvent = (id: string) => {
    Alert.alert(
      'Excluir Evento',
      'Tem certeza que deseja excluir este evento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const event = events.find((e) => e.id === id);
              if (event?.lembreteId) {
                const success = await lembretesService.delete(event.lembreteId);
                if (success) {
                  setEvents(events.filter((e) => e.id !== id));
                  await cancelReminderNotification(id);
                  await loadData();
                } else {
                  Alert.alert('Erro', 'Não foi possível excluir o evento');
                }
              } else {
                setEvents(events.filter((e) => e.id !== id));
                await cancelReminderNotification(id);
              }
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Erro', 'Não foi possível excluir o evento');
            }
          },
        },
      ]
    );
  };

  const markedDates: { [key: string]: any } = {};
  events.forEach((event) => {
    if (markedDates[event.date]) {
      markedDates[event.date].dots.push({ color: Colors.ionBlue });
    } else {
      markedDates[event.date] = {
        marked: true,
        dots: [{ color: Colors.ionBlue }],
      };
    }
  });

  const selectedEvents = events.filter((event) => event.date === selectedDate);
  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const renderReminder = ({ item }: { item: Reminder }) => (
    <BlurView intensity={20} style={styles.reminderCard}>
      <TouchableOpacity
        style={styles.reminderContent}
        onPress={() => toggleComplete(item.id)}
      >
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
            {item.completed && (
              <HugeIcon name="checkmark" size={16} color={Colors.textInverse} />
            )}
          </View>
        </View>
        <View style={styles.reminderTextContainer}>
          <Text
            style={[
              styles.reminderTitle,
              item.completed && styles.reminderTitleCompleted,
            ]}
          >
            {item.title}
          </Text>
          {item.category && (
            <View style={styles.categoryBadgeContainer}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
          )}
          {item.description && (
            <Text style={styles.reminderDescription}>{item.description}</Text>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.editButton}
        >
          <HugeIcon name="pencil-outline" size={20} color={Colors.ionBlue} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => deleteReminder(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.deleteButton}
        >
          <HugeIcon name="trash-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </BlurView>
  );

  const styles = getStyles(Colors);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient
          colors={Colors.backgroundGradient as any}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={Colors.ionBlue} />
        <Text style={{ color: Colors.textSecondary, marginTop: 16 }}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.backgroundGradient as any}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header with Tabs */}
        <View style={styles.header}>
          <View style={styles.tabSelector}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'tasks' && styles.tabButtonActive]}
              onPress={() => setActiveTab('tasks')}
            >
              <HugeIcon 
                name="checkmark-circle" 
                size={20} 
                color={activeTab === 'tasks' ? Colors.ionBlue : Colors.textSecondary} 
              />
              <Text style={[styles.tabButtonText, activeTab === 'tasks' && styles.tabButtonTextActive]}>
                Tarefas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'calendar' && styles.tabButtonActive]}
              onPress={() => setActiveTab('calendar')}
            >
              <HugeIcon 
                name="calendar" 
                size={20} 
                color={activeTab === 'calendar' ? Colors.ionBlue : Colors.textSecondary} 
              />
              <Text style={[styles.tabButtonText, activeTab === 'calendar' && styles.tabButtonTextActive]}>
                Calendário
              </Text>
            </TouchableOpacity>
            </View>
          {activeTab === 'tasks' && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setModalVisible(true)}
            >
              <HugeIcon name="add" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
          {activeTab === 'calendar' && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setPreferencesModalVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <HugeIcon name="settings-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          )}
        </View>

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <>
            <FlatList
              data={sortedReminders}
              renderItem={renderReminder}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <HugeIcon name="checkmark-circle-outline" size={64} color={Colors.textSecondary} />
                  <Text style={styles.emptyText}>Nenhuma tarefa</Text>
                </View>
              }
            />

            {/* ION Suggestion */}
            {showIONMessage && oldTaskSuggestion && !isGeneratingReminder && (
              <View style={[styles.insightContainer, { marginBottom: 80 }]}>
                <View style={styles.insightAvatar}>
                  <IONLogo size={40} />
                </View>
                <View style={styles.insightContent}>
                  <Text style={styles.insightLabel}>ION</Text>
                  <BlurView intensity={20} style={styles.insightBubble}>
                    <Text style={styles.insightText}>
                      {messageType === 'old_task' 
                        ? `Percebi que '${oldTaskSuggestion.title}' está na sua lista há ${differenceInCalendarDays(currentDate, oldTaskSuggestion.createdAt)} dias. Posso criar um lembrete inteligente para você em um horário que faça sentido para essa tarefa?`
                        : `Vejo que você ainda não concluiu '${oldTaskSuggestion.title}'. O lembrete que criamos já passou há mais de 2 horas. Gostaria de criar um novo lembrete em outro horário?`
                      }
                    </Text>
                    <View style={styles.insightActions}>
                      <TouchableOpacity 
                        style={styles.insightActionButton}
                        onPress={handleIONYes}
                      >
                        <Text style={styles.insightActionText}>Sim, por favor</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.insightActionButtonSecondary}
                        onPress={handleIONNo}
                      >
                        <Text style={styles.insightActionTextSecondary}>Não</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
                </View>
              </View>
            )}

            {isGeneratingReminder && !showTimePicker && (
              <View style={[styles.insightContainer, { marginBottom: 80 }]}>
                <View style={styles.insightAvatar}>
                  <IONLogo size={40} />
                </View>
                <View style={styles.insightContent}>
                  <Text style={styles.insightLabel}>ION</Text>
                  <BlurView intensity={20} style={styles.insightBubble}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <ActivityIndicator size="small" color={Colors.textInverse} />
                      <Text style={styles.insightText}>
                        Estou escolhendo o melhor horário para você...
                      </Text>
                    </View>
                  </BlurView>
                </View>
              </View>
            )}
          </>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <BlurView intensity={20} style={styles.calendarContainer}>
            <Calendar
              current={selectedDate}
              onDayPress={onDayPress}
              markedDates={{
                ...markedDates,
                [selectedDate]: {
                  ...markedDates[selectedDate],
                  selected: true,
                  selectedColor: Colors.ionBlue,
                },
              }}
              theme={{
                backgroundColor: Colors.glassBackground,
                calendarBackground: Colors.glassBackground,
                textSectionTitleColor: Colors.textSecondary,
                selectedDayBackgroundColor: Colors.ionBlue,
                selectedDayTextColor: Colors.backgroundDark,
                todayTextColor: Colors.ionBlue,
                dayTextColor: Colors.textPrimary,
                textDisabledColor: Colors.textSecondary,
                dotColor: Colors.ionBlue,
                selectedDotColor: Colors.backgroundDark,
                arrowColor: Colors.ionBlue,
                monthTextColor: Colors.textPrimary,
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
              markingType="multi-dot"
            />
          </BlurView>

          <View style={styles.eventsContainer}>
            <Text style={styles.sectionTitle}>
                Eventos em {format(new Date(selectedDate + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}
            </Text>

            {selectedEvents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <HugeIcon name="calendar-outline" size={64} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>Nenhum evento agendado</Text>
              </View>
            ) : (
              selectedEvents.map((event) => (
                <BlurView key={event.id} intensity={20} style={styles.eventCard}>
                  <View style={styles.eventTime}>
                    <HugeIcon name="time-outline" size={20} color={Colors.ionBlue} />
                    <Text style={styles.eventTimeText}>{event.time}</Text>
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.description && (
                      <Text style={styles.eventDescription}>{event.description}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteEvent(event.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <HugeIcon name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </BlurView>
              ))
            )}
          </View>
        </ScrollView>
        )}

        {/* FAB for Calendar */}
        {activeTab === 'calendar' && (
        <TouchableOpacity
          style={[styles.fab, { bottom: Math.max(insets.bottom, 16) + 80 }]}
            onPress={() => setCalendarModalVisible(true)}
        >
          <HugeIcon name="add" size={32} color={Colors.textInverse} />
        </TouchableOpacity>
        )}

        {/* Modals */}
        {/* Task Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Tarefa</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Título *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Reunião importante"
                placeholderTextColor={Colors.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.modalLabel}>Categoria *</Text>
              <View style={styles.categorySelector}>
                {(['Pessoal', 'Trabalho', 'Saúde'] as TaskCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      newCategory === cat && styles.categoryButtonActive,
                    ]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        newCategory === cat && styles.categoryButtonTextActive,
                      ]}
                    >
                      {cat}
                  </Text>
                  </TouchableOpacity>
                ))}
                </View>

              <Text style={styles.modalLabel}>Descrição</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Detalhes da tarefa"
                placeholderTextColor={Colors.textSecondary}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />

              <TouchableOpacity style={styles.modalButton} onPress={addReminder}>
                <Text style={styles.modalButtonText}>Adicionar</Text>
              </TouchableOpacity>
              </View>
          </View>
        </Modal>

        {/* Edit Task Modal */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent
          onRequestClose={closeEditModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Tarefa</Text>
                <TouchableOpacity onPress={closeEditModal}>
                  <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Título *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Reunião importante"
                placeholderTextColor={Colors.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.modalLabel}>Categoria *</Text>
              <View style={styles.categorySelector}>
                {(['Pessoal', 'Trabalho', 'Saúde'] as TaskCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      newCategory === cat && styles.categoryButtonActive,
                    ]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        newCategory === cat && styles.categoryButtonTextActive,
                      ]}
                    >
                      {cat}
                  </Text>
                  </TouchableOpacity>
                ))}
                </View>

              <Text style={styles.modalLabel}>Descrição</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Detalhes da tarefa"
                placeholderTextColor={Colors.textSecondary}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />

              <TouchableOpacity style={styles.modalButton} onPress={updateReminder}>
                <Text style={styles.modalButtonText}>Salvar Alterações</Text>
              </TouchableOpacity>
              </View>
          </View>
        </Modal>

        {/* Time Picker Modal */}
        <Modal
          visible={showTimePicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Escolher Horário</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>
                Escolha um dia e horário para o lembrete de "{oldTaskSuggestion?.title}"
              </Text>

              <View style={styles.daySelectorContainer}>
                <Text style={[styles.modalLabel, { marginTop: 0, marginBottom: 12 }]}>Dia:</Text>
                <View style={styles.daySelector}>
                  {[
                    { label: 'Hoje', value: 0 },
                    { label: 'Amanhã', value: 1 },
                    { label: 'Depois de amanhã', value: 2 },
                  ].map((day) => {
                    const dayDate = new Date();
                    dayDate.setDate(dayDate.getDate() + day.value);
                    const dayLabel = day.value === 0 
                      ? 'Hoje' 
                      : day.value === 1 
                        ? 'Amanhã' 
                        : format(dayDate, "dd/MM", { locale: ptBR });
                    
                    return (
                      <TouchableOpacity
                        key={day.value}
                        style={[
                          styles.dayButton,
                          selectedDay === day.value && styles.dayButtonActive,
                        ]}
                        onPress={() => {
                          setSelectedDay(day.value);
                          if (day.value > 0) {
                            const now = new Date();
                            const currentHour = now.getHours();
                            if (selectedHour <= currentHour) {
                              setSelectedHour(8);
                            }
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.dayButtonText,
                            selectedDay === day.value && styles.dayButtonTextActive,
                          ]}
                        >
                          {dayLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Text style={[styles.modalLabel, { marginTop: 16 }]}>Horário:</Text>
              <View style={styles.timePickerContainer}>
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = i;
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  
                  let isTooClose = false;
                  if (selectedDay === 0) {
                    const hourTime = new Date();
                    hourTime.setHours(hour, 0, 0, 0);
                    const minTime = new Date(now.getTime() + 15 * 60 * 1000);
                    isTooClose = hourTime.getTime() < minTime.getTime();
                  }
                  
                  const isPast = selectedDay === 0 && hour <= currentHour;
                  const isDisabled = isPast || isTooClose;
                  
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.timeButton,
                        selectedHour === hour && styles.timeButtonActive,
                        isDisabled && styles.timeButtonDisabled,
                      ]}
                      onPress={() => !isDisabled && setSelectedHour(hour)}
                      disabled={isDisabled}
                    >
                      <Text
                        style={[
                          styles.timeButtonText,
                          selectedHour === hour && styles.timeButtonTextActive,
                          isDisabled && styles.timeButtonTextDisabled,
                        ]}
                      >
                        {hour.toString().padStart(2, '0')}h
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => handleTimeSelection(selectedHour, selectedDay)}
              >
                <Text style={styles.modalButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Calendar Event Modal */}
        <Modal
          visible={calendarModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCalendarModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Novo Evento</Text>
                <TouchableOpacity onPress={() => setCalendarModalVisible(false)}>
                  <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Data</Text>
              <Text style={styles.modalDateText}>
                {format(new Date(selectedDate + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </Text>

              <Text style={styles.modalLabel}>Título *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Reunião importante"
                placeholderTextColor={Colors.textSecondary}
                value={newEventTitle}
                onChangeText={setNewEventTitle}
              />

              <Text style={styles.modalLabel}>Horário *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 14:00"
                placeholderTextColor={Colors.textSecondary}
                value={newEventTime}
                onChangeText={setNewEventTime}
              />

              <Text style={styles.modalLabel}>Descrição</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Detalhes do evento"
                placeholderTextColor={Colors.textSecondary}
                value={newEventDescription}
                onChangeText={setNewEventDescription}
                multiline
              />

              <TouchableOpacity style={styles.modalButton} onPress={addEvent}>
                <Text style={styles.modalButtonText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Preferences Modal */}
        <Modal
          visible={preferencesModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setPreferencesModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.settingsModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configurações de lembretes</Text>
                <TouchableOpacity onPress={() => setPreferencesModalVisible(false)}>
                  <HugeIcon name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.preferenceItem}>
                <View style={styles.preferenceInfo}>
                  <Text style={styles.preferenceTitle}>Notificações no app</Text>
                  <Text style={styles.preferenceDescription}>
                    Receba alertas diretamente no dispositivo.
                  </Text>
                </View>
                <Switch
                  value={notificationPreferences.app}
                  onValueChange={handlePreferenceChange('app')}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  ios_backgroundColor={Colors.border}
                />
              </View>

              <View style={styles.preferenceDivider} />

              <View style={styles.preferenceItem}>
                <View style={styles.preferenceInfo}>
                  <Text style={styles.preferenceTitle}>Envio via WhatsApp</Text>
                  <Text style={styles.preferenceDescription}>
                    Disparar lembretes para o seu WhatsApp quando chegar a hora.
                  </Text>
                </View>
                <Switch
                  value={notificationPreferences.whatsapp}
                  onValueChange={handlePreferenceChange('whatsapp')}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  ios_backgroundColor={Colors.border}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function getStyles(Colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    },
    tabSelector: {
      flexDirection: 'row',
      gap: 8,
      flex: 1,
    },
    tabButton: {
      flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    tabButtonActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    tabButtonText: {
      fontSize: 14,
      fontWeight: '600',
    color: Colors.textSecondary,
  },
    tabButtonTextActive: {
      color: Colors.textInverse,
    },
    headerButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
    listContent: {
      padding: 16,
      paddingBottom: 20,
    },
    reminderCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      overflow: 'hidden',
    },
    reminderContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkboxContainer: {
      marginRight: 16,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.textSecondary,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: Colors.ionBlue,
      borderColor: Colors.ionBlue,
    },
    reminderTextContainer: {
      flex: 1,
    },
    reminderTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    reminderTitleCompleted: {
      textDecorationLine: 'line-through',
      opacity: 0.5,
    },
    reminderDescription: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: 4,
    },
    categoryBadgeContainer: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: Colors.backgroundDarkTertiary,
      marginTop: 4,
      marginBottom: 4,
    },
    categoryBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.ionBlue,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    editButton: {
      padding: 8,
    },
    deleteButton: {
      padding: 8,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 16,
      color: Colors.textSecondary,
      marginTop: 16,
    },
    insightContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 8,
      gap: 12,
    },
    insightAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `rgba(0, 191, 255, 0.2)`,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: `rgba(0, 191, 255, 0.3)`,
    },
    insightContent: {
      flex: 1,
      maxWidth: '75%',
    },
    insightLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 4,
    },
    insightBubble: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: Colors.primary,
      borderWidth: 1,
      borderColor: Colors.primary,
      overflow: 'hidden',
    },
    insightText: {
      fontSize: 16,
      color: Colors.textInverse,
      marginBottom: 12,
    },
    insightActions: {
      flexDirection: 'row',
      gap: 8,
    },
    insightActionButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: `rgba(255, 255, 255, 0.3)`,
    },
    insightActionText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: Colors.textInverse,
    },
    insightActionButtonSecondary: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: Colors.backgroundDarkTertiary,
    },
    insightActionTextSecondary: {
      fontSize: 14,
      fontWeight: 'bold',
      color: Colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  calendarContainer: {
    borderRadius: 16,
    padding: 8,
    marginBottom: 24,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  eventsContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  eventTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  eventTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ionBlue,
    marginLeft: 8,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.backgroundDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  modalDateText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: Colors.backgroundDarkTertiary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textInverse,
  },
    categorySelector: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    categoryButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.border,
      backgroundColor: Colors.backgroundDarkTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryButtonActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    categoryButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    categoryButtonTextActive: {
      color: Colors.textInverse,
    },
    daySelectorContainer: {
      marginTop: 16,
      marginBottom: 16,
    },
    daySelector: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    dayButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.border,
      backgroundColor: Colors.backgroundDarkTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayButtonActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    dayButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    dayButtonTextActive: {
      color: Colors.textInverse,
    },
    timePickerContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 16,
      marginBottom: 16,
      maxHeight: 300,
    },
    timeButton: {
      width: '22%',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.border,
      backgroundColor: Colors.backgroundDarkTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeButtonActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    timeButtonDisabled: {
      opacity: 0.3,
    },
    timeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    timeButtonTextActive: {
      color: Colors.textInverse,
    },
    timeButtonTextDisabled: {
      color: Colors.textSecondary,
  },
  settingsModalContent: {
    backgroundColor: Colors.backgroundDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  preferenceDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  preferenceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    opacity: 0.6,
    marginVertical: 8,
  },
  });
}
