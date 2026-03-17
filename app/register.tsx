import { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { HugeIcon } from '../components/HugeIcon';
import { useRouter } from 'expo-router';
import { useAppColors } from '../hooks/useAppColors';
import { IONLogo } from '../components/IONLogo';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';

export default function RegisterScreen() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const { register, loginWithGoogle, loginWithApple, user, loading: authLoading } = useAuth();
  const Colors = useAppColors();
  const styles = getStyles(Colors);

  // Redirecionar quando registro/login social for concluído (igual ao login.tsx)
  useEffect(() => {
    if (success && !authLoading && user) {
      router.replace('/');
    }
  }, [success, user, authLoading, router]);

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
          .then(() => {
            setSuccess(true);
            // Navegação feita pelo useEffect de estado (success + user + !authLoading)
          })
          .catch((error) => {
            setLoading(false);
            Alert.alert('Erro', 'Falha no cadastro com Google');
          });
      }
    }
  }, [response]);

  const handleAppleLogin = async () => {
    try {
      const nonceBytes = await Crypto.getRandomBytesAsync(32);
      const nonce = Array.from(new Uint8Array(nonceBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
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
        // Navegação feita pelo useEffect de estado (success + user + !authLoading)
      }
    } catch (e: any) {
      setLoading(false);
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // user canceled
      } else {
        Alert.alert('Erro', 'Falha no cadastro com Apple');
      }
    }
  };


  const handleRegister = async () => {
    if (!nome.trim()) {
      Alert.alert('Erro', 'Por favor, insira seu nome');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Erro', 'Por favor, insira seu email');
      return;
    }

    // Validar formato básico do telefone SE informado
    let normalizedPhone = '';
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    if (phoneNumber.trim()) {
      const localNumber = digitsOnly.startsWith('55') ? digitsOnly.slice(2) : digitsOnly;
      if (localNumber.length < 10) {
        Alert.alert('Erro', 'Por favor, insira um número de telefone válido ou deixe em branco');
        return;
      }
      normalizedPhone = digitsOnly.startsWith('55') ? digitsOnly : `55${digitsOnly}`;
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
      await register(normalizedEmail, password, normalizedPhone || undefined, nome.trim());

      // Mostrar feedback de sucesso - navegação feita pelo useEffect de estado
      setSuccess(true);

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
                <HugeIcon name="person-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
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
                <HugeIcon name="mail-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
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

              <Text style={styles.label}>WhatsApp / Celular (Opcional)</Text>
              <BlurView intensity={20} style={styles.inputContainer}>
                <HugeIcon name="call-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
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

              <Text style={styles.label}>Senha</Text>
              <BlurView intensity={20} style={styles.inputContainer}>
                <HugeIcon name="lock-closed-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
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
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={24}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </BlurView>

              <Text style={styles.label}>Confirmar Senha</Text>
              <BlurView intensity={20} style={styles.inputContainer}>
                <HugeIcon name="lock-closed-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
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
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
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
                    <HugeIcon name="checkmark-circle" size={20} color="#FFFFFF" />
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

              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={16}
                  style={styles.appleButton}
                  onPress={handleAppleLogin}
                />
              )}
            </View>


            <View style={styles.footer}>
              <TouchableOpacity onPress={() => Linking.openURL('https://ion.goaether.com.br/terms')}>
                <Text style={styles.footerText}>
                  Ao criar uma conta, você concorda com nossos <Text style={{ textDecorationLine: 'underline' }}>Termos</Text> e <Text style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://ion.goaether.com.br/privacy-policy')}>Política de Privacidade</Text>.
                </Text>
              </TouchableOpacity>
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
      width: '100%',
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


