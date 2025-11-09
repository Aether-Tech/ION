import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppColors } from '../hooks/useAppColors';
import { IONLogo } from '../components/IONLogo';
import { useAuth } from '../contexts/AuthContext';
import { usuariosService } from '../services/supabaseService';
import { Usuario } from '../services/supabase';

export default function RegisterScreen() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { login } = useAuth();
  const Colors = useAppColors();
  const styles = getStyles(Colors);

  const normalizePhoneNumber = (value: string) => {
    const cleanPhone = value.replace(/\D/g, '');
    const normalizedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    return normalizedPhone;
  };

  const handleRegister = async () => {
    if (!nome.trim() || !email.trim() || !phoneNumber.trim()) {
      Alert.alert('Campos obrigatórios', 'Informe nome, e-mail e número de telefone.');
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (normalizedPhone.length < 12 || normalizedPhone.length > 13) {
      Alert.alert('Número inválido', 'Use um número com DDD. Ex: 27999999999');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert('E-mail inválido', 'Insira um e-mail válido.');
      return;
    }

    setLoading(true);
    try {
      const alreadyExists = await usuariosService.existsByCelular(normalizedPhone);
      if (alreadyExists) {
        Alert.alert('Usuário existente', 'Já existe uma conta com este número de telefone.');
        setLoading(false);
        return;
      }

      const newUser: Omit<Usuario, 'id' | 'created_at'> = {
        nome: nome.trim(),
        email: normalizedEmail,
        celular: normalizedPhone,
        status: 'ativo',
        foto_perfil: null,
      };

      const createdUser = await usuariosService.create(newUser);

      if (!createdUser) {
        throw new Error('Não foi possível criar a conta. Tente novamente.');
      }

      await login(normalizedPhone);
      router.replace('/(tabs)/chat');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar a conta. Tente novamente mais tarde.';
      Alert.alert('Erro no cadastro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={Colors.backgroundGradient as any}
        style={styles.gradient}
      >
        <View style={styles.blurCircles}>
          <View style={[styles.blurCircle, styles.blurCircle1]} />
          <View style={[styles.blurCircle, styles.blurCircle2]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <IONLogo size={64} variant="icon" />
              </View>
              <Text style={styles.title}>Criar conta</Text>
              <Text style={styles.subtitle}>Preencha seus dados para começar</Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.label}>Nome completo</Text>
              <BlurView intensity={20} style={styles.inputContainer}>
                <Ionicons name="person-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Maria Silva"
                  placeholderTextColor={Colors.textSecondary}
                  value={nome}
                  onChangeText={setNome}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                />
              </BlurView>

              <Text style={styles.label}>E-mail</Text>
              <BlurView intensity={20} style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ex: maria@email.com"
                  placeholderTextColor={Colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </BlurView>

              <Text style={styles.label}>Número de telefone</Text>
              <BlurView intensity={20} style={styles.inputContainer}>
                <Ionicons name="call-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 27999999999"
                  placeholderTextColor={Colors.textSecondary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
              </BlurView>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Criar conta</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.replace('/login')}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Já tenho uma conta</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Ao criar uma conta, você concorda com nossos Termos e Política de Privacidade.
              </Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

function getStyles(Colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    gradient: {
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
      opacity: 0.5,
    },
    blurCircle1: {
      width: 300,
      height: 300,
      backgroundColor: Colors.primary,
      top: -100,
      left: -100,
      opacity: 0.3,
    },
    blurCircle2: {
      width: 250,
      height: 250,
      backgroundColor: Colors.ionBlue,
      bottom: -50,
      right: -50,
      opacity: 0.3,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingTop: 60,
      paddingBottom: 40,
      zIndex: 1,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 32,
    },
    logoCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: `rgba(0, 191, 255, 0.2)`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 2,
      borderColor: `rgba(0, 191, 255, 0.3)`,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: Colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    formContainer: {
      width: '100%',
      marginTop: 8,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 12,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.glassBackground,
      borderRadius: 16,
      paddingHorizontal: 16,
      marginBottom: 20,
      height: 56,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      overflow: 'hidden',
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: Colors.textPrimary,
    },
    button: {
      backgroundColor: Colors.primary,
      borderRadius: 16,
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 5,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.textInverse,
    },
    secondaryButton: {
      marginTop: 16,
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: Colors.textPrimary,
      textDecorationLine: 'underline',
    },
    footer: {
      marginTop: 32,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 12,
      color: Colors.textTertiary,
      textAlign: 'center',
    },
  });
}


