import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { setupNotifications } from '../utils/notifications';
import { useEffect } from 'react';

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
    const inSubscription = segments[0] === 'subscription';
    const inPublicGroup = ['welcome', 'login', 'register', 'onboarding'].includes(segments[0] || '');

    // 1. Se não tem usuário e tenta acessar rota protegida (tabs ou subscription), manda para welcome
    // (Mas permitimos welcome/login/register)
    if (!user && !inPublicGroup) {
      // Se estiver na raiz ou tentando acessar tabs sem user -> login/welcome
      // router.replace('/welcome'); 
      // Deixamos o index.tsx ou logic interna cuidar disso para nao conflitar, 
      // MAS o usuario pediu checagem "estrito".
      // Vamos focar no Subscription Check que é o pedido principal.
    }

    // 2. CHECK DE ASSINATURA (O Pedido do Usuário)
    // Se tem usuário, mas não tem assinatura...
    if (user && !isSubscribed) {
      // Se ele NÃO está na tela de subscription E nem nas telas de auth (ex: onboarding ou algo assim)
      // Precisamos bloquear acesso a (tabs) e qualquer outra coisa.
      if (inAuthGroup || (segments.length === 0 /* index */)) {
        // Redireciona para subscription
        router.replace('/subscription');
      }
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

