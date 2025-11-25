import { Tabs } from 'expo-router';
import { HugeIcon } from '../../components/HugeIcon';
import { AnimatedChatIcon } from '../../components/AnimatedChatIcon';
import { useAuth } from '../../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../../hooks/useAppColors';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const Colors = useAppColors();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.ionBlue} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: Colors.backgroundDarkTertiary,
          borderTopWidth: 0.5,
          borderTopColor: Colors.border,
          height: 70 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 12,
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={20}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              backgroundColor: Colors.glassBackground,
            }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Compras',
          tabBarIcon: ({ color, focused }) => (
            <HugeIcon name="cart" size={32} color={focused ? '#FFFFFF' : color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finanças',
          tabBarIcon: ({ color, focused }) => (
            <HugeIcon name="wallet" size={32} color={focused ? '#FFFFFF' : color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedChatIcon color={color} size={32} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendário',
          tabBarIcon: ({ color, focused }) => (
            <HugeIcon name="calendar" size={32} color={focused ? '#FFFFFF' : color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <HugeIcon name="person" size={32} color={focused ? '#FFFFFF' : color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="savings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

