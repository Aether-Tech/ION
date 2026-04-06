import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { setupNotifications } from '../utils/notifications';
import { useEffect, Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// ErrorBoundary para capturar erros de render e evitar crash total do app
class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message || 'Erro desconhecido' };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary] Erro capturado:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Algo deu errado</Text>
          <Text style={errorStyles.message}>{this.state.error}</Text>
          <TouchableOpacity
            style={errorStyles.button}
            onPress={() => this.setState({ hasError: false, error: '' })}
          >
            <Text style={errorStyles.buttonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  message: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
});

// setupNotifications(); // Removido do top-level para evitar bloqueios/hangs

export default function RootLayout() {
  useEffect(() => {
    try {
      setupNotifications();
    } catch (e) {
      console.warn('Error setting up notifications:', e);
    }
  }, []);

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <RootLayoutNav />
              </SubscriptionProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';

function RootLayoutNav() {
  const { user, loading: authLoading } = useAuth();
  // @ts-ignore
  const { isSubscribed, isLoading: subLoading } = useSubscription();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || subLoading) return;

    // Normalizar segmentos para facilitar verificação
    const inAuthGroup = segments[0] === '(tabs)';
    const inPublicGroup = ['welcome', 'login', 'register', 'onboarding'].includes(segments[0] || '');

    // Quando segments[0] é undefined (root index '/'), o index.tsx já cuida do roteamento.
    // Só intervir em rotas específicas para evitar dupla-navegação que causa crashes.
    const atRoot = !segments[0];
    if (atRoot) return;

    // 1. Se não tem usuário e tenta acessar rota protegida (tabs), manda para welcome
    if (!user && !inPublicGroup) {
      router.replace('/welcome');
      return;
    }

    // 2. Se tem usuário mas não tem assinatura e tenta acessar tabs diretamente (deep link)
    if (user && !isSubscribed && inAuthGroup) {
      router.replace('/subscription');
    }
  }, [user, isSubscribed, segments, authLoading, subLoading]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="subscription" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

