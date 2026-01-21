import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';

export default function Index() {
  const router = useRouter();
  const { user, loading: authLoading, needsOnboarding } = useAuth();

  // @ts-ignore
  const { isSubscribed, isLoading: subLoading } = useSubscription();

  useEffect(() => {
    console.log('Index - Estado:', {
      hasUser: !!user,
      loading: authLoading || subLoading,
      needsOnboarding,
      userUid: user?.firebaseUser?.uid,
      hasUsuario: !!user?.usuario,
      usuarioNome: user?.usuario?.nome,
      isSubscribed
    });

    if (!authLoading && !subLoading) {
      if (user) {
        // Se o usuário precisa de onboarding, redirecionar para onboarding
        if (needsOnboarding) {
          console.log('Redirecionando para onboarding');
          router.replace('/onboarding');
        } else if (!isSubscribed) {
          // Se não tem assinatura, redirecionar para tela de assinatura
          console.log('Usuário sem assinatura - Redirecionando para paywall');
          router.replace('/subscription');
        } else {
          console.log('Redirecionando para chat - usuário autenticado e assinado');
          router.replace('/(tabs)/chat');
        }
      } else {
        console.log('Redirecionando para welcome - usuário não autenticado');
        router.replace('/welcome');
      }
    }
  }, [user, authLoading, subLoading, needsOnboarding, isSubscribed, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );
}

