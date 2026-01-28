import { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { HugeIcon } from '../components/HugeIcon';
import { useAppColors } from '../hooks/useAppColors';
import { IONLogo } from '../components/IONLogo';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { login, loginWithGoogle, loginWithApple, user, loading: authLoading, needsOnboarding } = useAuth();
  const Colors = useAppColors();
  const styles = getStyles(Colors);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      if (id_token) {
        setLoading(true);
        loginWithGoogle(id_token)
          .then(() => setSuccess(true))
          .catch((error) => {
            setLoading(false);
            Alert.alert('Erro', 'Falha no login com Google');
          });
      }
    }
  }, [response]);

  const handleAppleLogin = async () => {
    try {
      const nonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const { identityToken, fullName } = credential;
      if (identityToken) {
        setLoading(true);
        await loginWithApple(identityToken, nonce, fullName ?? undefined);
        setSuccess(true);
      }
    } catch (e: any) {
      setLoading(false);
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // user canceled
      } else {
        Alert.alert('Erro', 'Falha no login com Apple');
      }
    }
  };


  // Redirecionar quando o usuário for autenticado
  useEffect(() => {
    if (success && !authLoading && user) {
      console.log('Login bem-sucedido, redirecionando...', {
        needsOnboarding,
        hasUsuario: !!user.usuario,
      });
      setLoading(false); // Desabilitar loading antes de redirecionar

      // Sempre redirecionar para o index ('/') para que ele decida o destino
      // baseado no needsOnboarding E no isSubscribed
      router.replace('/');
    }
  }, [success, user, authLoading, needsOnboarding, router]);

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
    setSuccess(false);
    try {
      await login(email.trim(), password);
      // Login bem-sucedido - mostrar feedback visual
      setSuccess(true);
      // Manter loading até o redirecionamento acontecer (via useEffect)
      // Não desabilitar o loading aqui, deixar o useEffect gerenciar
    } catch (error) {
      setSuccess(false);
      setLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível fazer login. Verifique suas credenciais.';
      Alert.alert('Erro no Login', errorMessage);
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
              <View style={styles.inputIcon}>
                <HugeIcon name="mail-outline" size={24} color={Colors.primary} />
              </View>
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
              <View style={styles.inputIcon}>
                <HugeIcon name="lock-closed-outline" size={24} color={Colors.primary} />
              </View>
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
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </BlurView>

            <TouchableOpacity
              style={[
                styles.button,
                loading && styles.buttonDisabled,
                success && styles.buttonSuccess
              ]}
              onPress={handleLogin}
              disabled={loading || success}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : success ? (
                <View style={styles.successContainer}>
                  <HugeIcon name="checkmark-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Login realizado!</Text>
                </View>
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

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtonsContainer}>
              <TouchableOpacity
                style={[styles.socialButton, styles.googleButton]}
                onPress={() => promptAsync()}
                disabled={loading || success}
              >
                <Ionicons name="logo-google" size={24} color="#DB4437" />
                <Text style={[styles.socialButtonText, { color: '#DB4437' }]}>Google</Text>
              </TouchableOpacity>

              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={16}
                style={styles.appleButton}
                onPress={handleAppleLogin}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Ao continuar, você concorda com nossos
            </Text>
            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => Linking.openURL('https://ion.goaether.com.br/terms')}>
                <Text style={styles.footerLink}>Termos e Condições</Text>
              </TouchableOpacity>
              <Text style={styles.footerText}> e </Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://ion.goaether.com.br/privacy-policy')}>
                <Text style={styles.footerLink}>Política de Privacidade</Text>
              </TouchableOpacity>
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
    buttonSuccess: {
      backgroundColor: '#10B981', // Verde de sucesso
    },
    successContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 24,
      gap: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: Colors.glassBorder,
    },
    dividerText: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    socialButtonsContainer: {
      gap: 12,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      height: 56,
      borderRadius: 16,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
    },
    googleButton: {
      backgroundColor: '#FFFFFF',
    },
    socialButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    appleButton: {
      width: '100%',
      height: 56,
    },
  });
}
