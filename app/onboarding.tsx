import { useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Onboarding } from '../components/Onboarding';

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleComplete = async (phoneNumber: string) => {
    setLoading(true);
    try {
      await completeOnboarding(phoneNumber);
      // Redirecionar para a tela principal após completar onboarding
      router.replace('/(tabs)/chat');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar dados. Tente novamente.';
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Onboarding onComplete={handleComplete} loading={loading} />
    </View>
  );
}

