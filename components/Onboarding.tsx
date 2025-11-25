import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { HugeIcon } from './HugeIcon';
import { useAppColors } from '../hooks/useAppColors';
import { IONLogo } from './IONLogo';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  title: string;
  description: string;
  icon: string;
  color: string;
}

interface OnboardingProps {
  onComplete: (phoneNumber: string) => Promise<void>;
  loading?: boolean;
}

const slides: OnboardingSlide[] = [
  {
    title: 'Bem-vindo ao ION',
    description: 'Sua assistente pessoal inteligente que te ajuda a organizar sua vida de forma simples e eficiente.',
    icon: 'sparkles',
    color: '#00BFFF',
  },
  {
    title: 'Tarefas e Lembretes',
    description: 'Gerencie suas tarefas e receba lembretes inteligentes no melhor horário para você.',
    icon: 'checkmark-circle',
    color: '#6366F1',
  },
  {
    title: 'Controle Financeiro',
    description: 'Acompanhe suas finanças, receitas e despesas de forma organizada e visual.',
    icon: 'wallet',
    color: '#10B981',
  },
  {
    title: 'Lista de Compras',
    description: 'Organize suas compras e nunca mais esqueça de comprar algo importante.',
    icon: 'cart',
    color: '#F59E0B',
  },
  {
    title: 'Chat Inteligente',
    description: 'Converse com a ION e receba sugestões personalizadas para melhorar seu dia a dia.',
    icon: 'chatbubbles',
    color: '#8B5CF6',
  },
];

export function Onboarding({ onComplete, loading = false }: OnboardingProps) {
  const Colors = useAppColors();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const handleNext = () => {
    // slides.length é o índice do slide final (telefone)
    if (currentSlide < slides.length) {
      const nextSlide = currentSlide + 1;
      setCurrentSlide(nextSlide);
      scrollViewRef.current?.scrollTo({
        x: nextSlide * width,
        animated: true,
      });
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      const previousSlide = currentSlide - 1;
      setCurrentSlide(previousSlide);
      scrollViewRef.current?.scrollTo({
        x: previousSlide * width,
        animated: true,
      });
    }
  };

  const handleComplete = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Erro', 'Por favor, insira seu número de telefone');
      return;
    }

    // Validar formato básico
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    const localNumber = digitsOnly.startsWith('55') ? digitsOnly.slice(2) : digitsOnly;

    if (localNumber.length < 10) {
      Alert.alert('Erro', 'Por favor, insira um número de telefone válido');
      return;
    }

    const normalizedPhone = digitsOnly.startsWith('55') ? digitsOnly : `55${digitsOnly}`;
    await onComplete(normalizedPhone);
  };

  const styles = getStyles(Colors);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.backgroundGradient as any}
        style={StyleSheet.absoluteFill}
      />

      {/* Indicadores de slide */}
      <View style={styles.indicators}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              index === currentSlide && styles.indicatorActive,
            ]}
          />
        ))}
        {/* Indicador para o slide final (telefone) */}
        <View
          style={[
            styles.indicator,
            currentSlide === slides.length && styles.indicatorActive,
          ]}
        />
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.scrollView}
      >
        {slides.map((slide, index) => (
          <View key={index} style={styles.slide}>
            <View style={styles.slideContent}>
              <View style={[styles.iconContainer, { backgroundColor: `${slide.color}20` }]}>
                <HugeIcon name={slide.icon as any} size={64} color={slide.color} strokeWidth={2} />
              </View>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideDescription}>{slide.description}</Text>
            </View>
          </View>
        ))}

        {/* Último slide com input de telefone */}
        <View style={styles.slide}>
          <View style={styles.slideContent}>
            <View style={[styles.iconContainer, { backgroundColor: `${Colors.ionBlue}20` }]}>
              <IONLogo size={64} />
            </View>
            <Text style={styles.slideTitle}>Tudo em um lugar só</Text>
            <Text style={styles.slideDescription}>
              Insira seu telefone para começar
            </Text>

            <View style={styles.phoneInputContainer}>
              <BlurView intensity={20} style={styles.phoneInput}>
                <HugeIcon name="call-outline" size={24} color={Colors.primary} strokeWidth={1.5} style={styles.inputIcon} />
                <TextInput
                  style={styles.phoneInputField}
                  placeholder="Ex: 5527999999999"
                  placeholderTextColor={Colors.textSecondary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
              </BlurView>
              <Text style={styles.phoneHint}>
                Digite seu número com código do país (ex: 5527999999999)
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Botões de navegação */}
      <View style={styles.navigation}>
        {currentSlide > 0 && (
          <TouchableOpacity
            style={styles.navButton}
            onPress={handlePrevious}
            disabled={loading}
          >
            <HugeIcon name="chevron-back" size={24} color={Colors.textPrimary} strokeWidth={1.5} />
            <Text style={styles.navButtonText}>Voltar</Text>
          </TouchableOpacity>
        )}

        <View style={styles.navSpacer} />

        <TouchableOpacity
          style={[styles.navButton, styles.navButtonPrimary]}
          onPress={currentSlide === slides.length ? handleComplete : handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>
                {currentSlide === slides.length ? 'Começar' : 'Próximo'}
              </Text>
              {currentSlide === slides.length ? (
                <HugeIcon name="checkmark" size={24} color={Colors.textInverse} strokeWidth={1.5} />
              ) : (
                <HugeIcon name="chevron-forward" size={24} color={Colors.textInverse} strokeWidth={1.5} />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(Colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    indicators: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 60,
      paddingBottom: 20,
      gap: 8,
    },
    indicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.textSecondary,
      opacity: 0.3,
    },
    indicatorActive: {
      width: 24,
      backgroundColor: Colors.ionBlue,
      opacity: 1,
    },
    scrollView: {
      flex: 1,
    },
    slide: {
      width,
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    slideContent: {
      alignItems: 'center',
      maxWidth: 400,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
    },
    slideTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      textAlign: 'center',
      marginBottom: 16,
    },
    slideDescription: {
      fontSize: 18,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 28,
    },
    phoneInputContainer: {
      width: '100%',
      marginTop: 32,
    },
    phoneInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.glassBackground,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 56,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      overflow: 'hidden',
      marginBottom: 12,
    },
    inputIcon: {
      marginRight: 12,
    },
    phoneInputField: {
      flex: 1,
      fontSize: 16,
      color: Colors.textPrimary,
    },
    phoneHint: {
      fontSize: 14,
      color: Colors.textTertiary,
      textAlign: 'center',
    },
    navigation: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingBottom: 40,
      paddingTop: 20,
    },
    navSpacer: {
      flex: 1,
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDarkTertiary,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    navButtonPrimary: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    navButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    navButtonTextPrimary: {
      color: Colors.textInverse,
    },
  });
}

