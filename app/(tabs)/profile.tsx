import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppColors } from '../../hooks/useAppColors';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme, isDark } = useTheme();
  const Colors = useAppColors();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'person-outline',
      title: 'Editar Perfil',
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: 'notifications-outline',
      title: 'Notificações',
      hasSwitch: true,
      switchValue: notificationsEnabled,
      onSwitchChange: setNotificationsEnabled,
    },
    {
      icon: isDark ? 'moon' : 'moon-outline',
      title: 'Modo Escuro',
      hasSwitch: true,
      switchValue: isDark,
      onSwitchChange: toggleTheme,
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacidade e Segurança',
      onPress: () => Alert.alert('Em breve', 'Funcionalidade em desenvolvimento'),
    },
    {
      icon: 'help-circle-outline',
      title: 'Ajuda e Suporte',
      onPress: () => Alert.alert('Em breve', 'Funcionalidade em desenvolvimento'),
    },
    {
      icon: 'document-text-outline',
      title: 'Termos e Condições',
      onPress: () => Alert.alert('Termos', 'Acesse: https://ion.goaether.com.br/legal/termos_condicoes_aethertech.pdf'),
    },
    {
      icon: 'lock-closed-outline',
      title: 'Política de Privacidade',
      onPress: () => Alert.alert('Política', 'Acesse: https://ion.goaether.com.br/legal/politica_privacidade_aethertech.pdf'),
    },
  ];

  const styles = getStyles(Colors);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.backgroundGradient as any}
        style={StyleSheet.absoluteFill}
      />
      {/* Background blur elements */}
      <View style={styles.blurCircles}>
        <View style={[styles.blurCircle, styles.blurCircle1]} />
        <View style={[styles.blurCircle, styles.blurCircle2]} />
        <View style={[styles.blurCircle, styles.blurCircle3]} />
      </View>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="arrow-back" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Perfil & Configurações</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {user?.usuario?.foto_perfil ? (
                <Image 
                  source={{ uri: user.usuario.foto_perfil }} 
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatar}>
                  <Ionicons name="person" size={48} color={Colors.primary} />
                </View>
              )}
              <View style={styles.avatarRing} />
            </View>
            <Text style={styles.profileName}>{user?.usuario?.nome || user?.phoneNumber || 'Usuário'}</Text>
            <Text style={styles.profilePhone}>{user?.usuario?.celular || user?.phoneNumber || ''}</Text>
            {user?.usuario?.email && (
              <Text style={styles.profileEmail}>{user.usuario.email}</Text>
            )}
          </View>

          {/* Settings Sections */}
          <View style={styles.section}>
            {menuItems.map((item, index) => (
              <BlurView key={index} intensity={20} style={styles.menuItem}>
                <TouchableOpacity
                  style={styles.menuItemContent}
                  onPress={item.onPress}
                  disabled={item.hasSwitch}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuIconContainer}>
                      <Ionicons name={item.icon as any} size={24} color={Colors.primary} />
                    </View>
                    <Text style={styles.menuItemText}>{item.title}</Text>
                  </View>
                  {item.hasSwitch ? (
                    <Switch
                      value={item.switchValue}
                      onValueChange={item.onSwitchChange}
                      trackColor={{ false: Colors.textSecondary, true: Colors.primary }}
                      thumbColor={Colors.textInverse}
                    />
                  ) : (
                    <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </BlurView>
            ))}
          </View>

          {/* Logout Button */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={24} color={Colors.error} />
              <Text style={styles.logoutButtonText}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>ION v1.0.0</Text>
            <Text style={styles.footerText}>© 2025 Aether. Todos os direitos reservados.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function getStyles(Colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
  container: {
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
  },
  blurCircle1: {
    width: 384,
    height: 384,
    backgroundColor: Colors.primary,
    top: -80,
    left: -160,
    opacity: 0.2,
  },
  blurCircle2: {
    width: 384,
    height: 384,
    backgroundColor: Colors.ionBlue,
    bottom: -80,
    right: -160,
    opacity: 0.2,
  },
  blurCircle3: {
    width: 288,
    height: 288,
    backgroundColor: Colors.backgroundDarkSecondary,
    top: '33%',
    left: '50%',
    transform: [{ translateX: -144 }],
    opacity: 0.2,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: Colors.backgroundDarkTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: `rgba(43, 108, 238, 0.3)`,
  },
  avatarImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: `rgba(43, 108, 238, 0.3)`,
  },
  avatarRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 68,
    borderWidth: 4,
    borderColor: `rgba(43, 108, 238, 0.3)`,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
    gap: 12,
  },
  menuItem: {
    borderRadius: 16,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: `rgba(43, 108, 238, 0.2)`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: 12,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  });
}
