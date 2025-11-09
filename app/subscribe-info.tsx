import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
} from 'react-native';
import { useAppColors } from '../hooks/useAppColors';

export default function SubscribeInfoScreen() {
  const router = useRouter();
  const Colors = useAppColors();
  const styles = getStyles(Colors);

  return (
    <LinearGradient colors={Colors.backgroundGradient as any} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="card-outline" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Assinatura ION</Text>
          </View>

          <Text style={styles.paragraph}>
            A assinatura da ION é realizada com segurança através do Stripe. Assim que o pagamento é concluído,
            o sistema valida automaticamente sua nova conta.
          </Text>

          <Text style={styles.paragraph}>
            Para que possamos registrar seu número no banco de dados envie
            uma mensagem para a ION no WhatsApp informando que você finalizou a assinatura.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={() => Linking.openURL('https://ion.goaether.com.br/')}
            >
              <Ionicons name="link-outline" size={20} color={Colors.textInverse} />
              <Text style={[styles.actionButtonText, styles.primaryButtonText]}>Assinar com Stripe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                Linking.openURL('https://wa.me/5527992491404?text=Ol%C3%A1!%20Quero%20testar%20a%20ION.')
              }
            >
              <Ionicons name="logo-whatsapp" size={20} color={Colors.primary} />
              <Text style={styles.actionButtonText}>Falar com a ION no WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function getStyles(Colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    gradient: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 48,
      paddingBottom: 32,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingVertical: 8,
    },
    backButtonText: {
      marginLeft: 4,
      fontSize: 16,
      color: Colors.textPrimary,
      fontWeight: '600',
    },
    content: {
      marginTop: 32,
      backgroundColor: Colors.glassBackground,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      shadowColor: Colors.primary,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 12 },
      shadowRadius: 24,
      elevation: 6,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: `rgba(0, 191, 255, 0.15)`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      borderWidth: 2,
      borderColor: `rgba(0, 191, 255, 0.25)`,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: Colors.textPrimary,
      textAlign: 'center',
    },
    paragraph: {
      fontSize: 16,
      lineHeight: 24,
      color: Colors.textSecondary,
      marginBottom: 16,
      textAlign: 'center',
    },
    actions: {
      marginTop: 24,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      backgroundColor: Colors.surface,
      marginBottom: 16,
    },
    primaryButton: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
      marginBottom: 12,
    },
    actionButtonText: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    primaryButtonText: {
      color: Colors.textInverse,
    },
  });
}

