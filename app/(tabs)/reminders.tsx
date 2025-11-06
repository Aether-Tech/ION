import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { format, differenceInDays, differenceInHours, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAppColors } from '../../hooks/useAppColors';
import { IONLogo } from '../../components/IONLogo';
import { useAuth } from '../../contexts/AuthContext';
import { toDoService, lembretesService } from '../../services/supabaseService';
import { ToDo } from '../../services/supabase';
import { chatService } from '../../services/api';

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

type TaskCategory = 'Pessoal' | 'Trabalho' | 'Saúde';

export default function RemindersScreen() {
  const Colors = useAppColors();
  const { user, loading: authLoading } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<TaskCategory>('Pessoal');
  
  // Estado para a mensagem da ION
  const [oldTaskSuggestion, setOldTaskSuggestion] = useState<Reminder | null>(null);
  const [showIONMessage, setShowIONMessage] = useState(false);
  const [isGeneratingReminder, setIsGeneratingReminder] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [messageType, setMessageType] = useState<'old_task' | 'reminder_passed'>('old_task');
  const [activeLembrete, setActiveLembrete] = useState<any>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number>(15);
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = hoje, 1 = amanhã, 2 = depois de amanhã

  // Carregar dados do Supabase
  useEffect(() => {
    // Se o auth ainda está carregando, aguardar
    if (authLoading) {
      return;
    }
    
    // Se não há usuário, parar loading
    if (!user?.usuarioId) {
      setLoading(false);
      return;
    }
    
    // Se há usuário, carregar dados
    loadData();
  }, [user?.usuarioId, user, authLoading]);

  // Atualizar a data atual periodicamente para recalcular os dias
  useEffect(() => {
    // Atualizar a cada hora para garantir que os dias sejam recalculados
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60 * 60 * 1000); // A cada 1 hora

    // Também atualizar quando o componente é montado
    setCurrentDate(new Date());

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    if (!user?.usuarioId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    // Atualizar a data atual para recalcular os dias
    setCurrentDate(new Date());
    try {
      const todosData = await toDoService.getByUsuarioId(user.usuarioId);
      const lembretesData = await lembretesService.getByUsuarioId(user.usuarioId);
      
      // Filtrar e deletar tarefas concluídas há mais de 24h
      const now = new Date();
      const tasksToDelete: number[] = [];
      
      const remindersFormatted: Reminder[] = todosData.map((todo) => {
        const completed = todo.status === 'concluido' || todo.status === 'completo';
        const completedAt = todo.completed_at ? new Date(todo.completed_at) : null;
        
        // Se está concluída há mais de 24h, marcar para deletar
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
      
      // Deletar tarefas antigas automaticamente
      let finalReminders: Reminder[];
      if (tasksToDelete.length > 0) {
        await Promise.all(tasksToDelete.map(id => toDoService.delete(id)));
        // Recarregar dados após deletar
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
      
      // Verificar lembretes que passaram mais de 2 horas sem conclusão
      const pendingReminders = finalReminders.filter(r => !r.completed);
      let reminderPassedTask: Reminder | null = null;
      let reminderPassedLembrete: any = null;
      
      for (const reminder of pendingReminders) {
        // Buscar lembretes ativos para esta tarefa
        const taskLembretes = lembretesData.filter(l => 
          l.lembrete && reminder.title && 
          l.lembrete.toLowerCase().includes(reminder.title.toLowerCase()) &&
          l.data_para_lembrar
        );
        
        if (taskLembretes.length > 0) {
          // Verificar se algum lembrete passou há mais de 2 horas
          for (const lembrete of taskLembretes) {
            if (lembrete.data_para_lembrar) {
              const lembreteDate = new Date(lembrete.data_para_lembrar);
              const hoursSinceLembrete = differenceInHours(now, lembreteDate);
              
              // Se passou mais de 2 horas e a tarefa não foi concluída
              if (hoursSinceLembrete >= 2 && lembreteDate <= now) {
                reminderPassedTask = reminder;
                reminderPassedLembrete = lembrete;
                break;
              }
            }
          }
        }
      }
      
      // Priorizar mostrar mensagem de lembrete que passou
      if (reminderPassedTask && reminderPassedLembrete) {
        setOldTaskSuggestion(reminderPassedTask);
        setActiveLembrete(reminderPassedLembrete);
        setMessageType('reminder_passed');
        setShowIONMessage(true);
      } else {
        // Verificar se há tarefas antigas (7+ dias) e pendentes
        // Mas só mostrar se não houver lembrete ativo para essa tarefa
        const oldTasks = finalReminders.filter((r) => {
          if (r.completed) return false;
          
          // Verificar se já existe lembrete ativo para esta tarefa
          const hasActiveLembrete = lembretesData.some(l => 
            l.lembrete && r.title && 
            l.lembrete.toLowerCase().includes(r.title.toLowerCase()) &&
            l.data_para_lembrar &&
            new Date(l.data_para_lembrar) > now
          );
          
          // Se já tem lembrete ativo, não mostrar
          if (hasActiveLembrete) return false;
          
          // Usar differenceInCalendarDays para calcular dias de calendário
          const daysSinceCreation = differenceInCalendarDays(now, r.createdAt);
          return daysSinceCreation >= 7;
        });
        
        // Pegar a tarefa mais antiga
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
    } catch (error) {
      console.error('Error loading todos:', error);
      // Não mostrar alert em caso de erro, apenas logar
      // Alert.alert('Erro', 'Não foi possível carregar as tarefas');
    } finally {
      setLoading(false);
    }
  };

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
        // Recarregar dados para atualizar a sugestão da ION
        await loadData();
      } else {
        throw new Error('Não foi possível criar a tarefa');
      }
    } catch (error) {
      console.error('Error adding reminder:', error);
      Alert.alert('Erro', 'Não foi possível adicionar a tarefa');
    }
  };

  // Função para buscar histórico de lembretes similares
  const getSimilarRemindersHistory = async (taskTitle: string): Promise<string> => {
    if (!user?.usuarioId) return '';
    
    try {
      const lembretes = await lembretesService.getByUsuarioId(user.usuarioId);
      const similarReminders = lembretes
        .filter(l => {
          const lembreteText = (l.lembrete || '').toLowerCase();
          const taskWords = taskTitle.toLowerCase().split(' ');
          return taskWords.some(word => 
            word.length > 3 && lembreteText.includes(word)
          );
        })
        .slice(0, 5); // Limitar a 5 exemplos
      
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

  // Função para obter horário sugerido pelo GPT
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
2. O horário deve ter PELO MENOS 15 MINUTOS de diferença do horário atual (ex: se são ${currentHour}h${currentMinute > 0 ? currentMinute : ''}, não sugira ${currentHour}h${currentMinute > 0 ? currentMinute : ''} ou ${currentHour + 1}h, sugira pelo menos ${currentHour + 1}h ou mais)
3. Se já for tarde (após 12h), não sugira horários da manhã
4. Considere o tipo de tarefa:
   - Tarefas médicas/clínicas: geralmente até 17h ou 18h (horário de funcionamento)
   - Tarefas de academia/exercício: geralmente entre 6h-21h
   - Tarefas de compras: geralmente entre 9h-20h
   - Tarefas pessoais: geralmente entre 8h-20h
5. ${preferredHours.length > 0 ? `PRIORIZE os horários preferidos: ${preferredHours.join('h, ')}h. Se algum ainda não passou hoje e tiver pelo menos 15 minutos de diferença, use-o.` : 'Se houver histórico de lembretes similares, use o mesmo horário ou um pouco antes (até 2 horas antes)'}
6. O horário deve ser realista e viável para o tipo de tarefa

Responda APENAS com o número da hora (0-23), sem texto adicional, sem explicações, sem formatação. Exemplo: se sugerir 15h, responda apenas "15".`;

      const phoneNumber = user?.phoneNumber || user?.usuario?.celular || 'user';
      const response = await chatService.sendMessage(phoneNumber, prompt);
      
      if (response.success && response.data?.message) {
        const responseText = response.data.message.trim();
        // Extrair número da resposta
        const hourMatch = responseText.match(/\b([0-9]|1[0-9]|2[0-3])\b/);
        if (hourMatch) {
          let suggestedHour = parseInt(hourMatch[1], 10);
          
          // Se o horário sugerido já passou hoje, considerar para amanhã
          // Mas validar se está dentro do range válido (0-23)
          if (suggestedHour >= 0 && suggestedHour <= 23) {
            // Se o horário sugerido é menor ou igual ao atual, considerar para amanhã
            // Mas ainda retornar o horário sugerido (o sistema vai criar para amanhã se necessário)
            if (suggestedHour <= currentHour) {
              // Se já passou, mas está dentro de um range razoável (não muito tarde)
              // Aceitar o horário sugerido mesmo assim
              if (suggestedHour >= 6 && suggestedHour <= 22) {
                return suggestedHour;
              }
            } else {
              // Horário é válido e maior que o atual
              return suggestedHour;
            }
          }
        }
      }
      
      // Fallback: usar horário preferido se disponível e válido (com pelo menos 15 min de diferença)
      if (preferredHours.length > 0) {
        const nowForPreferred = new Date();
        const minTimeForPreferred = new Date(nowForPreferred.getTime() + 15 * 60 * 1000); // 15 minutos no futuro
        const minHourForPreferred = minTimeForPreferred.getHours();
        const minMinuteForPreferred = minTimeForPreferred.getMinutes();
        // Se os minutos são > 0, precisamos da próxima hora
        const minValidHourForPreferred = minMinuteForPreferred > 0 ? minHourForPreferred + 1 : minHourForPreferred;
        
        const validPreferred = preferredHours.find(h => h >= minValidHourForPreferred && h <= 22);
        if (validPreferred) {
          return validPreferred;
        }
      }
      
      // Fallback: sugerir pelo menos 1 hora a partir do horário atual (garantindo 15 min mínimo)
      // Mas não depois das 18h e não antes das 8h
      const nowForFallback = new Date();
      const minTimeForFallback = new Date(nowForFallback.getTime() + 15 * 60 * 1000); // 15 minutos no futuro
      const minHourForFallback = minTimeForFallback.getHours();
      const minMinuteForFallback = minTimeForFallback.getMinutes();
      // Se os minutos são > 0, precisamos da próxima hora
      const minValidHourForFallback = minMinuteForFallback > 0 ? minHourForFallback + 1 : minHourForFallback;
      
      let fallbackHour = Math.max(minValidHourForFallback, 8);
      // Se o horário mínimo já passou, adicionar 1 hora
      if (fallbackHour <= currentHour) {
        fallbackHour = currentHour + 1;
      }
      fallbackHour = Math.min(fallbackHour, 18);
      return fallbackHour;
    } catch (error) {
      console.error('Error getting suggested time from GPT:', error);
      // Fallback: tentar usar horário preferido (com pelo menos 15 min de diferença)
      try {
        const preferredHours = await getPreferredHours(taskTitle);
        if (preferredHours.length > 0) {
          const nowForError = new Date();
          const minTimeForError = new Date(nowForError.getTime() + 15 * 60 * 1000); // 15 minutos no futuro
          const minHourForError = minTimeForError.getHours();
          const minMinuteForError = minTimeForError.getMinutes();
          const minValidHourForError = minMinuteForError > 0 ? minHourForError + 1 : minHourForError;
          
          const validPreferred = preferredHours.find(h => h >= minValidHourForError && h <= 22);
          if (validPreferred) {
            return validPreferred;
          }
        }
      } catch (e) {
        // Ignorar erro
      }
      // Fallback final: pelo menos 1 hora a partir do horário atual (garantindo 15 min mínimo)
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

  // Salvar horário preferido do usuário
  const savePreferredHour = async (taskTitle: string, hour: number) => {
    try {
      const key = `preferred_hour_${user?.usuarioId}`;
      const existing = await AsyncStorage.getItem(key);
      const preferences = existing ? JSON.parse(existing) : {};
      
      // Extrair palavras-chave da tarefa para categorizar
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
      
      // Adicionar horário se não existir
      if (!preferences[category].includes(hour)) {
        preferences[category].push(hour);
        // Manter apenas os últimos 5 horários
        if (preferences[category].length > 5) {
          preferences[category] = preferences[category].slice(-5);
        }
      }
      
      await AsyncStorage.setItem(key, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving preferred hour:', error);
    }
  };

  // Obter horários preferidos do usuário
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
    
    // Se for lembrete que passou, mostrar seletor de horário
    if (messageType === 'reminder_passed') {
      // Definir horário padrão válido (garantindo pelo menos 15 minutos de diferença)
      const now = new Date();
      const minTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutos no futuro
      const minHour = minTime.getHours();
      const minMinute = minTime.getMinutes();
      // Se os minutos são > 0, precisamos da próxima hora
      const defaultHour = minMinute > 0 
        ? (minHour + 1 <= 23 ? minHour + 1 : 8) 
        : (minHour <= 23 ? minHour : 8);
      setSelectedHour(defaultHour);
      setSelectedDay(0); // Hoje por padrão
      setShowTimePicker(true);
      return;
    }
    
    try {
      // Mostrar loading
      setIsGeneratingReminder(true);
      setShowIONMessage(false);
      
      // Obter horário sugerido pelo GPT
      const suggestedHour = await getSuggestedTimeFromGPT(oldTaskSuggestion.title);
      
      // Criar lembrete para hoje no horário sugerido
      const today = new Date();
      today.setHours(suggestedHour || 15, 0, 0, 0);
      
      const now = new Date();
      const minTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutos no futuro
      
      // Se o horário já passou ou está muito próximo (menos de 15 min), ajustar
      if (today.getTime() < minTime.getTime()) {
        // Se ainda está no mesmo dia mas muito próximo, ajustar para pelo menos 15 minutos no futuro
        if (today.getDate() === now.getDate()) {
          today.setTime(minTime.getTime());
          today.setSeconds(0, 0);
        } else {
          // Se já passou, criar para amanhã
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
        // Salvar horário preferido
        await savePreferredHour(oldTaskSuggestion.title, suggestedHour || 15);
        
        Alert.alert('Sucesso', `Lembrete criado para ${format(today, "dd/MM/yyyy 'às' HH'h'", { locale: ptBR })}`);
        setShowIONMessage(false);
        setOldTaskSuggestion(null);
        // Recarregar dados para atualizar estado
        await loadData();
      } else {
        throw new Error('Não foi possível criar o lembrete');
      }
    } catch (error) {
      console.error('Error creating reminder:', error);
      Alert.alert('Erro', 'Não foi possível criar o lembrete');
      setShowIONMessage(true); // Reabrir mensagem em caso de erro
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
      
      // Criar lembrete para o dia selecionado no horário escolhido
      const selectedDate = new Date();
      selectedDate.setDate(selectedDate.getDate() + dayOffset);
      selectedDate.setHours(hour, 0, 0, 0);
      selectedDate.setMinutes(0, 0, 0);
      
      const now = new Date();
      const minTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutos no futuro
      
      // Se for hoje, verificar se tem pelo menos 15 minutos de diferença
      if (dayOffset === 0) {
        if (selectedDate.getTime() < minTime.getTime()) {
          // Se o horário escolhido está muito próximo, ajustar para pelo menos 15 minutos no futuro
          selectedDate.setTime(minTime.getTime());
          // Arredondar para o próximo minuto
          selectedDate.setSeconds(0, 0);
        }
      }
      
      // Se havia um lembrete anterior, atualizar em vez de criar novo
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
      // Recarregar dados para atualizar estado
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

  const renderReminder = ({ item }: { item: Reminder }) => (
    <BlurView intensity={20} style={styles.reminderCard}>
      <TouchableOpacity
        style={styles.reminderContent}
        onPress={() => toggleComplete(item.id)}
      >
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
            {item.completed && (
              <Ionicons name="checkmark" size={16} color={Colors.textInverse} />
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
      <TouchableOpacity
        onPress={() => deleteReminder(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={20} color={Colors.error} />
      </TouchableOpacity>
    </BlurView>
  );

  // Mostrar todas as tarefas (pendentes e concluídas)
  // As concluídas aparecem no final
  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  
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
      {/* Background blur elements */}
      <View style={styles.blurCircles}>
        <View style={[styles.blurCircle, styles.blurCircle1]} />
        <View style={[styles.blurCircle, styles.blurCircle2]} />
      </View>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerButton}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.ionBlue} />
          </View>
          <Text style={styles.headerTitle}>Suas Tarefas</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={sortedReminders}
          renderItem={renderReminder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={64} color={Colors.textSecondary} />
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

        {/* Loading indicator while generating reminder */}
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
                  <Ionicons name="close" size={28} color={Colors.textPrimary} />
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
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    newCategory === 'Pessoal' && styles.categoryButtonActive,
                  ]}
                  onPress={() => setNewCategory('Pessoal')}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      newCategory === 'Pessoal' && styles.categoryButtonTextActive,
                    ]}
                  >
                    Pessoal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    newCategory === 'Trabalho' && styles.categoryButtonActive,
                  ]}
                  onPress={() => setNewCategory('Trabalho')}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      newCategory === 'Trabalho' && styles.categoryButtonTextActive,
                    ]}
                  >
                    Trabalho
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    newCategory === 'Saúde' && styles.categoryButtonActive,
                  ]}
                  onPress={() => setNewCategory('Saúde')}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      newCategory === 'Saúde' && styles.categoryButtonTextActive,
                    ]}
                  >
                    Saúde
                  </Text>
                </TouchableOpacity>
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

        {/* Modal de seleção de horário */}
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
                  <Ionicons name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>
                Escolha um dia e horário para o lembrete de "{oldTaskSuggestion?.title}"
              </Text>

              {/* Seletor de Dia */}
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
                          // Se mudar para amanhã ou depois, resetar horário se necessário
                          if (day.value > 0) {
                            const now = new Date();
                            const currentHour = now.getHours();
                            if (selectedHour <= currentHour) {
                              setSelectedHour(8); // Horário padrão para dias futuros
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

              {/* Seletor de Horário */}
              <Text style={[styles.modalLabel, { marginTop: 16 }]}>Horário:</Text>
              <View style={styles.timePickerContainer}>
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = i;
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  
                  // Verificar se o horário está muito próximo (menos de 15 minutos)
                  let isTooClose = false;
                  if (selectedDay === 0) {
                    // Se for hoje, verificar se o horário está muito próximo
                    const hourTime = new Date();
                    hourTime.setHours(hour, 0, 0, 0);
                    const minTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutos no futuro
                    isTooClose = hourTime.getTime() < minTime.getTime();
                  }
                  
                  // Só desabilitar horários passados ou muito próximos se for hoje
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
      </SafeAreaView>
    </View>
  );
}

function getStyles(Colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
  },
  blurCircles: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  blurCircle: {
    position: 'absolute',
    borderRadius: 9999,
  },
  blurCircle1: {
    width: 300,
    height: 300,
    backgroundColor: Colors.primary,
    top: -100,
    left: -100,
    opacity: 0.2,
  },
  blurCircle2: {
    width: 250,
    height: 250,
    backgroundColor: Colors.ionBlue,
    bottom: -50,
    right: -50,
    opacity: 0.2,
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
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
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
  });
}
