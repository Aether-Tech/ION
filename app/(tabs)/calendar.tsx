import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Calendar, DateData } from 'react-native-calendars';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAppColors } from '../../hooks/useAppColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { lembretesService } from '../../services/supabaseService';
import { Lembrete } from '../../services/supabase';
import { ensureNotificationPermissions, syncReminderNotifications, cancelReminderNotification } from '../../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Helper function to parse date string (yyyy-MM-dd) in local timezone
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
  const date = parseLocalDate(event.date);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export default function CalendarScreen() {
  const Colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({ app: true, whatsapp: true });
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const setupNotifications = async () => {
      const granted = await ensureNotificationPermissions();
      if (isMounted) {
        setNotificationsReady(granted);
        if (!granted) {
          console.warn('Permissões de notificação não concedidas. Lembretes não serão enviados.');
          Alert.alert(
            'Notificações desativadas',
            'Ative as permissões de notificação nas configurações do dispositivo para receber alertas de lembretes.'
          );
        }
      }
    };

    setupNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const stored = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored);
          const appPref = typeof parsed?.app === 'boolean' ? parsed.app : true;
          const whatsappPref = typeof parsed?.whatsapp === 'boolean' ? parsed.whatsapp : true;
          setNotificationPreferences({ app: appPref, whatsapp: whatsappPref });
        }
      } catch (error) {
        console.warn('Erro ao carregar preferências de lembretes:', error);
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTime, setNewTime] = useState('');

  // Carregar lembretes do Supabase
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

  const loadData = async () => {
    if (!user?.usuarioId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const lembretesData = await lembretesService.getByUsuarioId(user.usuarioId);
      
      // Converter lembretes para eventos
      const eventsFormatted: Event[] = lembretesData
        .filter((lembrete) => lembrete.data_para_lembrar) // Apenas lembretes com data
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
      console.error('Error loading reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key: 'app' | 'whatsapp') => (value: boolean) => {
    setNotificationPreferences((prev) => {
      if (prev[key] === value) {
        return prev;
      }

      const updated = { ...prev, [key]: value };
      AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated)).catch((error) => {
        console.warn('Erro ao salvar preferências de lembretes:', error);
      });
      return updated;
    });
  };

  useEffect(() => {
    if (loading) {
      return;
    }

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
  }, [
    events,
    notificationsReady,
    loading,
    notificationPreferences.app,
    notificationPreferences.whatsapp,
    user?.usuario?.celular,
  ]);

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

  const addEvent = async () => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    if (!newTitle.trim() || !newTime.trim()) {
      Alert.alert('Erro', 'Por favor, preencha o título e o horário');
      return;
    }

    try {
      // Combinar data e hora
      const [hours, minutes] = newTime.split(':').map(Number);
      const selectedDateObj = parseLocalDate(selectedDate);
      selectedDateObj.setHours(hours || 0, minutes || 0, 0, 0);

      const lembrete = await lembretesService.create({
        data_para_lembrar: selectedDateObj.toISOString(),
        lembrete: newTitle,
        celular: user.usuario?.celular || null,
        usuario_id: user.usuarioId,
        recorrencia: newDescription || 'Unico',
      });

      if (lembrete) {
        const event: Event = {
          id: lembrete.id.toString(),
          title: lembrete.lembrete || newTitle,
          description: lembrete.recorrencia || undefined,
          date: selectedDate,
          time: newTime,
          lembreteId: lembrete.id,
          dateTimeISO: lembrete.data_para_lembrar || selectedDateObj.toISOString(),
          phoneNumber: lembrete.celular,
        };

        setEvents([...events, event]);
        setNewTitle('');
        setNewDescription('');
        setNewTime('');
        setModalVisible(false);
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
                } else {
                  Alert.alert('Erro', 'Não foi possível excluir o evento');
                }
              } else {
                // Fallback para eventos sem lembreteId
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

  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

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
        {/* Header */}
        <BlurView intensity={20} style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Calendário</Text>
              <Text style={styles.headerSubtitle}>
                {selectedEvents.length} eventos hoje
              </Text>
            </View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setPreferencesModalVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="settings-outline" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </BlurView>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Calendar */}
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

          {/* Events List */}
          <View style={styles.eventsContainer}>
            <Text style={styles.sectionTitle}>
              Eventos em {format(parseLocalDate(selectedDate), "dd 'de' MMMM", { locale: ptBR })}
            </Text>

            {selectedEvents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={64} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>Nenhum evento agendado</Text>
              </View>
            ) : (
              selectedEvents.map((event) => (
                <BlurView key={event.id} intensity={20} style={styles.eventCard}>
                  <View style={styles.eventTime}>
                    <Ionicons name="time-outline" size={20} color={Colors.ionBlue} />
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
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </BlurView>
              ))
            )}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.fab, { bottom: Math.max(insets.bottom, 16) + 60 }]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={32} color={Colors.textInverse} />
        </TouchableOpacity>

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
                  <Ionicons name="close" size={28} color={Colors.textPrimary} />
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

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Novo Evento</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Data</Text>
              <Text style={styles.modalDateText}>
                {format(parseLocalDate(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </Text>

              <Text style={styles.modalLabel}>Título *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Reunião importante"
                placeholderTextColor={Colors.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.modalLabel}>Horário *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 14:00"
                placeholderTextColor={Colors.textSecondary}
                value={newTime}
                onChangeText={setNewTime}
              />

              <Text style={styles.modalLabel}>Descrição</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Detalhes do evento"
                placeholderTextColor={Colors.textSecondary}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />

              <TouchableOpacity style={styles.modalButton} onPress={addEvent}>
                <Text style={styles.modalButtonText}>Adicionar</Text>
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
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
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
