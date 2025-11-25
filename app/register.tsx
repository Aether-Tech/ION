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

export default function RegisterScreen() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const { register } = useAuth();
  const Colors = useAppColors();
  const styles = getStyles(Colors);

  const handleRegister = async () => {
    if (!nome.trim()) {
      Alert.alert('Erro', 'Por favor, insira seu nome');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Erro', 'Por favor, insira seu email');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Erro', 'Por favor, insira uma senha');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      Alert.alert('Erro', 'Por favor, insira um email válido');
      return;
    }

    setLoading(true);
    try {
      await register(normalizedEmail, password, nome.trim());
      
      // Mostrar feedback de sucesso
      setSuccess(true);
      
      // Timeout de segurança: se após 3 segundos não redirecionou, forçar redirecionamento
      setTimeout(() => {
        // Verificar se ainda está na tela de registro (não redirecionou)
        // Se sim, forçar redirecionamento para index que vai decidir o destino
        router.replace('/');
      }, 3000);
      
      // O redirecionamento será feito automaticamente pelo index.tsx
      // O onAuthStateChanged vai detectar o novo usuário e redirecionar para onboarding
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar a conta. Tente novamente mais tarde.';
      Alert.alert('Erro no cadastro', errorMessage);
      setLoading(false);
      setSuccess(false);
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

              <Text style={styles.label}>Senha</Text>
              <BlurView intensity={20} style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={Colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password-new"
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={24} 
                    color={Colors.textSecondary} 
                  />
                </TouchableOpacity>
              </BlurView>

              <Text style={styles.label}>Confirmar Senha</Text>
              <BlurView intensity={20} style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Digite a senha novamente"
                  placeholderTextColor={Colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="password-new"
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons 
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                    size={24} 
                    color={Colors.textSecondary} 
                  />
                </TouchableOpacity>
              </BlurView>

              <TouchableOpacity
                style={[styles.button, (loading || success) && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading || success}
              >
                {loading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#FFFFFF" />
                    <Text style={styles.buttonText}>Criando conta...</Text>
                  </View>
                ) : success ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Conta criada! Redirecionando...</Text>
                  </View>
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


