import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { user, loading, needsOnboarding } = useAuth();

  useEffect(() => {
    console.log('Index - Estado:', {
      hasUser: !!user,
      loading,
      needsOnboarding,
      userUid: user?.firebaseUser?.uid,
      hasUsuario: !!user?.usuario,
      usuarioNome: user?.usuario?.nome,
    });

    if (!loading) {
      if (user) {
        // Se o usuário precisa de onboarding, redirecionar para onboarding
        if (needsOnboarding) {
          console.log('Redirecionando para onboarding');
          router.replace('/onboarding');
        } else {
          console.log('Redirecionando para chat - usuário autenticado:', {
            hasUsuario: !!user.usuario,
            nome: user.usuario?.nome || user.phoneNumber,
          });
          router.replace('/(tabs)/chat');
        }
      } else {
        console.log('Redirecionando para welcome - usuário não autenticado');
        router.replace('/welcome');
      }
    }
  }, [user, loading, needsOnboarding, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );
}

