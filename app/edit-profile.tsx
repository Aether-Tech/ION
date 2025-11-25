import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HugeIcon } from "../components/HugeIcon";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAppColors } from '../hooks/useAppColors';
import { usuariosService } from '../services/supabaseService';
import { supabase } from '../services/supabase';
import * as FileSystem from 'expo-file-system/legacy';

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const Colors = useAppColors();
  
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user?.usuario) {
      setNome(user.usuario.nome || '');
      setEmail(user.usuario.email || '');
      setFotoPerfil(user.usuario.foto_perfil || null);
    }
  }, [user]);

  const handlePickImage = async () => {
    Alert.alert(
      'Alterar Foto de Perfil',
      'Escolha uma opção',
      [
        {
          text: 'Tirar Foto',
          onPress: async () => {
            try {
              const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
              if (!cameraPermission.granted) {
                Alert.alert(
                  'Permissão necessária',
                  'Precisamos de permissão para usar a câmera. Por favor, habilite nas configurações do dispositivo.'
                );
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled && result.assets && result.assets.length > 0) {
                await uploadImage(result.assets[0].uri);
              }
            } catch (error) {
              console.error('Error taking photo:', error);
              Alert.alert('Erro', 'Não foi possível tirar a foto.');
            }
          },
        },
        {
          text: 'Escolher da Galeria',
          onPress: async () => {
            try {
              const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!mediaLibraryPermission.granted) {
                Alert.alert(
                  'Permissão necessária',
                  'Precisamos de permissão para acessar suas fotos. Por favor, habilite nas configurações do dispositivo.'
                );
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled && result.assets && result.assets.length > 0) {
                await uploadImage(result.assets[0].uri);
              }
            } catch (error) {
              console.error('Error picking image:', error);
              Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
            }
          },
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  const uploadImage = async (imageUri: string) => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não encontrado.');
      return;
    }

    setUploading(true);
    try {
      console.log('📸 Iniciando upload de imagem...');
      console.log('📸 Image URI:', imageUri);
      console.log('📸 User ID:', user.usuarioId);

      // Criar nome único para o arquivo
      const fileName = `profile_${user.usuarioId}_${Date.now()}.jpg`;
      const filePath = fileName;

      console.log('📸 File name:', fileName);
      console.log('📸 File path:', filePath);

      // No React Native, o Supabase Storage aceita diretamente o FormData ou Blob
      // Vamos usar uma abordagem mais compatível: ler como base64 e converter
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('📸 Base64 length:', base64Image.length);

      // Converter base64 para ArrayBuffer (Uint8Array)
      const byteCharacters = atob(base64Image);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      console.log('📸 Byte array length:', byteArray.length);

      // Tentar fazer upload diretamente (assumindo que o bucket existe)
      // Não vamos tentar listar ou criar buckets, pois isso requer permissões especiais
      console.log('📸 Tentando fazer upload diretamente no bucket "perfis"...');
      
      // Fazer upload para Supabase Storage
      console.log('📸 Fazendo upload...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('perfis')
        .upload(filePath, byteArray, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      console.log('📸 Upload response:', { uploadData, uploadError });

      if (uploadError) {
        console.error('📸 Erro no upload:', uploadError);
        console.error('📸 Erro completo:', JSON.stringify(uploadError, null, 2));
        console.error('📸 Status code:', uploadError.statusCode);
        console.error('📸 Error message:', uploadError.message);
        
        // Verificar tipo de erro
        if (uploadError.message?.includes('Bucket not found') || 
            uploadError.message?.includes('not found') ||
            uploadError.statusCode === 404) {
          throw new Error(
            `❌ O bucket "perfis" não foi encontrado.\n\n` +
            `Verifique se:\n` +
            `1. O bucket foi criado com o nome exato: "perfis"\n` +
            `2. Você está no projeto correto do Supabase\n` +
            `3. O bucket está visível no painel Storage`
          );
        }
        
        if (uploadError.message?.includes('new row violates row-level security') || 
            uploadError.message?.includes('policy') ||
            uploadError.message?.includes('permission') ||
            uploadError.message?.includes('row-level security') ||
            uploadError.statusCode === 403) {
          throw new Error(
            `❌ Erro de permissão ao fazer upload.\n\n` +
            `As políticas de segurança do bucket precisam ser configuradas:\n\n` +
            `1. Acesse Storage > Policies > perfis\n` +
            `2. Clique em "New policy" ao lado de INSERT\n` +
            `3. Escolha "Create from scratch"\n` +
            `4. Nome: "Allow upload"\n` +
            `5. SQL: true\n` +
            `6. Salve\n\n` +
            `Consulte o arquivo STORAGE_SETUP.md para instruções detalhadas.`
          );
        }
        
        // Verificar se é erro de autenticação
        if (uploadError.statusCode === 401) {
          throw new Error(
            `❌ Erro de autenticação.\n\n` +
            `Verifique se as credenciais do Supabase estão configuradas corretamente.`
          );
        }
        
        throw new Error(
          `❌ Erro ao fazer upload\n\n` +
          `Mensagem: ${uploadError.message || 'Erro desconhecido'}\n` +
          `Código: ${uploadError.statusCode || 'N/A'}\n\n` +
          `Verifique os logs do console para mais detalhes.`
        );
      }

      console.log('📸 Upload concluído com sucesso!');

      // Obter URL pública da imagem
      const { data: urlData } = supabase.storage
        .from('perfis')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      console.log('📸 URL pública:', publicUrl);

      // Atualizar estado local com a nova URL
      setFotoPerfil(publicUrl);

      Alert.alert('Sucesso', 'Foto de perfil carregada com sucesso! Ela será salva quando você clicar em "Salvar Alterações".');
    } catch (error) {
      console.error('📸 Error completo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      Alert.alert(
        'Erro ao fazer upload',
        errorMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              // Mesmo com erro, permitir usar a foto local temporariamente
              setFotoPerfil(imageUri);
            },
          },
        ]
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.usuarioId) {
      Alert.alert('Erro', 'Usuário não encontrado.');
      return;
    }

    if (!nome.trim()) {
      Alert.alert('Erro', 'O nome é obrigatório.');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Erro', 'O email é obrigatório.');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erro', 'Por favor, insira um email válido.');
      return;
    }

    setLoading(true);
    try {
      const updates: any = {
        nome: nome.trim(),
        email: email.trim(),
      };

      // Tentar adicionar foto_perfil apenas se a URL for válida (não é URI local)
      if (fotoPerfil && !fotoPerfil.startsWith('file://') && !fotoPerfil.startsWith('ph://')) {
        updates.foto_perfil = fotoPerfil;
      }

      const updatedUsuario = await usuariosService.update(user.usuarioId, updates);

      if (!updatedUsuario) {
        // Se falhou, tentar sem foto_perfil (caso a coluna não exista)
        if (updates.foto_perfil) {
          console.log('Tentando salvar sem foto_perfil (coluna pode não existir)...');
          const updatesWithoutPhoto = { ...updates };
          delete updatesWithoutPhoto.foto_perfil;
          
          const retryUsuario = await usuariosService.update(user.usuarioId, updatesWithoutPhoto);
          
          if (!retryUsuario) {
            throw new Error('Não foi possível atualizar o perfil.');
          }
          
          // Usar o retorno sem foto
          const updatedUser = {
            ...user,
            usuario: retryUsuario,
          };
          
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
          await refreshUser();
          
          Alert.alert(
            'Perfil atualizado',
            'Nome e email atualizados com sucesso!\n\n' +
            'Nota: A foto não foi salva porque a coluna "foto_perfil" não existe na tabela usuarios. ' +
            'Adicione a coluna no Supabase para salvar fotos de perfil.',
            [
              {
                text: 'OK',
                onPress: () => {
                  router.back();
                },
              },
            ]
          );
          return;
        }
        
        throw new Error('Não foi possível atualizar o perfil.');
      }

      // Atualizar o contexto do usuário
      const updatedUser = {
        ...user,
        usuario: updatedUsuario,
      };
      
      // Salvar no AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

      // Atualizar o estado global
      await refreshUser();

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

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
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <HugeIcon name="arrow-back" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar Perfil</Text>
          <View style={styles.headerButton} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Profile Photo Section */}
            <View style={styles.profilePhotoSection}>
              <View style={styles.avatarContainer}>
                {fotoPerfil ? (
                  <Image source={{ uri: fotoPerfil }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <HugeIcon name="person" size={48} color={Colors.primary} />
                  </View>
                )}
                <View style={styles.avatarRing} />
              </View>
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={handlePickImage}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <HugeIcon name="camera" size={20} color={Colors.primary} />
                    <Text style={styles.changePhotoText}>Alterar Foto de Perfil</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formSection}>
              {/* Número do Usuário (não editável) */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Número do Usuário</Text>
                <BlurView intensity={20} style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={user?.usuario?.celular || user?.phoneNumber || ''}
                    editable={false}
                    placeholder="Número do usuário"
                    placeholderTextColor={Colors.textSecondary}
                  />
                  <HugeIcon
                    name="lock-closed"
                    size={20}
                    color={Colors.textSecondary}
                    style={styles.inputIcon}
                  />
                </BlurView>
                <Text style={styles.helperText}>Este campo não pode ser alterado</Text>
              </View>

              {/* Nome */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nome</Text>
                <BlurView intensity={20} style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Seu nome"
                    placeholderTextColor={Colors.textSecondary}
                    autoCapitalize="words"
                  />
                </BlurView>
              </View>

              {/* Email */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <BlurView intensity={20} style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="seu@email.com"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </BlurView>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <>
                  <HugeIcon name="checkmark-circle" size={24} color={Colors.textInverse} />
                  <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
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
    keyboardView: {
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
    profilePhotoSection: {
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
    changePhotoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
    },
    changePhotoText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    formSection: {
      marginBottom: 24,
      gap: 20,
    },
    inputContainer: {
      marginBottom: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 8,
    },
    inputWrapper: {
      borderRadius: 16,
      backgroundColor: Colors.glassBackground,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      padding: 16,
      fontSize: 16,
      color: Colors.textPrimary,
    },
    inputDisabled: {
      color: Colors.textSecondary,
      opacity: 0.7,
    },
    inputIcon: {
      marginRight: 16,
    },
    helperText: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 4,
      marginLeft: 4,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 16,
      backgroundColor: Colors.primary,
      gap: 12,
      marginTop: 8,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textInverse,
    },
  });
}

