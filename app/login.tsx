import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppColors } from '../hooks/useAppColors';
import { IONLogo } from '../components/IONLogo';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const Colors = useAppColors();
  const styles = getStyles(Colors);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Erro', 'Por favor, insira seu email');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Erro', 'Por favor, insira sua senha');
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erro', 'Por favor, insira um email válido');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      // O redirecionamento será feito automaticamente pelo index.tsx baseado no estado de autenticação
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível fazer login. Verifique suas credenciais.';
      Alert.alert('Erro no Login', errorMessage);
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
        {/* Background blur elements */}
        <View style={styles.blurCircles}>
          <View style={[styles.blurCircle, styles.blurCircle1]} />
          <View style={[styles.blurCircle, styles.blurCircle2]} />
        </View>

        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <IONLogo size={64} variant="icon" />
            </View>
            <Text style={styles.title}>ION</Text>
            <Text style={styles.subtitle}>Sua Assistente Pessoal</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Email</Text>
            <BlurView intensity={20} style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ex: seu@email.com"
                placeholderTextColor={Colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCapitalize="none"
              />
            </BlurView>

            <Text style={styles.label}>Senha</Text>
            <BlurView intensity={20} style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
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

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.secondaryButtonText}>Criar uma conta</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Ao continuar, você concorda com nossos
            </Text>
            <View style={styles.footerLinks}>
              <Text style={styles.footerLink}>Termos e Condições</Text>
              <Text style={styles.footerText}> e </Text>
              <Text style={styles.footerLink}>Política de Privacidade</Text>
            </View>
          </View>
        </View>
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
    marginBottom: 48,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `rgba(0, 191, 255, 0.2)`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: `rgba(0, 191, 255, 0.3)`,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textSecondary,
  },
  formContainer: {
    width: '100%',
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
    marginBottom: 24,
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
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  footerLinks: {
    flexDirection: 'row',
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerLink: {
    fontSize: 12,
    color: Colors.textPrimary,
    textDecorationLine: 'underline',
  },
  });
}

