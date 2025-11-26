import { Tabs } from 'expo-router';
import { HugeIcon } from '../../components/HugeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../../hooks/useAppColors';
import { LinearGradient } from 'expo-linear-gradient';
import { TabBarIndicator } from '../../components/TabBarIndicator';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// ===== CONFIGURAÇÕES DE PADDING DA NAVBAR =====
const NAVBAR_PADDING_LEFT = 24;  // Ajuste este valor para mudar o padding esquerdo
const NAVBAR_PADDING_RIGHT = 24; // Ajuste este valor para mudar o padding direito
// ==============================================

// Navbar customizada completamente do zero
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const Colors = useAppColors();
  const screenWidth = Dimensions.get('window').width;
  const navbarWidth = screenWidth - NAVBAR_PADDING_LEFT - NAVBAR_PADDING_RIGHT;
  
  // ===== CONFIGURAÇÃO DOS ÍCONES =====
  // ⚠️ EDITE OS VALORES DE iconOffset PARA AJUSTAR A POSIÇÃO HORIZONTAL DE CADA ÍCONE ⚠️
  // Valores negativos movem o ícone para a esquerda
  // Valores positivos movem o ícone para a direita
  const tabs = [
    { key: 'shopping', route: '/(tabs)/shopping', icon: 'cart', iconOffset: 5 },      // shopping - offset horizontal
    { key: 'finances', route: '/(tabs)/finances', icon: 'wallet', iconOffset: 0 },   // finances - offset horizontal
    { key: 'chat', route: '/(tabs)/chat', icon: 'chatbubbles', iconOffset: 0 },      // chat - offset horizontal
    { key: 'calendar', route: '/(tabs)/calendar', icon: 'calendar', iconOffset: 0 },  // calendar - offset horizontal
    { key: 'profile', route: '/(tabs)/profile', icon: 'person', iconOffset: -10 },     // profile - offset horizontal
  ];
  // ====================================

  return (
    <View
      style={{
        position: 'absolute',
        left: NAVBAR_PADDING_LEFT,
        bottom: insets.bottom + 18,
        width: navbarWidth,
        height: 64,
      }}
    >
      {/* Background com desfoque e liquid glass effect */}
      <View style={styles.navbarContainer}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(9, 14, 24, 0.4)', 'rgba(14, 20, 32, 0.3)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Ícones */}
      <View style={styles.iconsContainer}>
        {tabs.map((tab, index) => {
          const route = state.routes[index];
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as any);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.iconButton}
            >
              <View style={[styles.iconWrapper, tab.iconOffset !== 0 && { marginLeft: tab.iconOffset }]}>
                <HugeIcon
                  name={tab.icon as any}
                  size={32}
                  color={isFocused ? '#FFFFFF' : Colors.textSecondary}
                  strokeWidth={1.5}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bolhinha indicadora */}
      <View style={styles.indicatorContainer} pointerEvents="none">
        <TabBarIndicator tabCount={5} tabBarWidth={navbarWidth} />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
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
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="shopping"
          options={{
            title: 'Compras',
          }}
        />
        <Tabs.Screen
          name="finances"
          options={{
            title: 'Finanças',
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendário',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
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
    </View>
  );
}

const styles = StyleSheet.create({
  navbarContainer: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(15,20,30,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 0,
  },
  iconsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center', // ⚠️ Centraliza verticalmente os ícones
    // ⚠️ DISTRIBUIÇÃO HORIZONTAL DOS ÍCONES:
    // 'space-around' = espaça igualmente com espaço nas bordas
    // 'space-between' = espaça igualmente sem espaço nas bordas
    // 'space-evenly' = espaça igualmente com espaço igual em todos os lados
    // 'center' = centraliza todos os ícones juntos
    justifyContent: 'space-around',
  },
  iconButton: {
    flex: 1, // ⚠️ Cada botão ocupa espaço igual na navbar
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingVertical: 0,
    // ⚠️ PADDING HORIZONTAL - Ajuste este valor para mudar o espaçamento lateral de cada ícone
    paddingHorizontal: 8,
  },
  iconWrapper: {
    // ⚠️ POSIÇÃO VERTICAL DO ÍCONE - Ajuste este valor para mover o ícone para cima/baixo
    // Valores negativos = para cima, valores positivos = para baixo
    marginTop: 0,
  },
  indicatorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

