import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../contexts/AuthContext';
import { useAppColors } from '../../hooks/useAppColors';
import { IONLogo } from '../../components/IONLogo';
import { chatService } from '../../services/api';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  imageUri?: string;
  attachmentUri?: string;
  attachmentName?: string;
  attachmentType?: string;
  isThinking?: boolean;
  isTyping?: boolean;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Olá! Sou a ION, sua assistente pessoal. Como posso ajudá-lo hoje?',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImagePickerAsset | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [isPickingDocument, setIsPickingDocument] = useState(false);
  const pickingDocumentRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const Colors = useAppColors();

  useEffect(() => {
    // Solicitar permissões de áudio ao montar o componente
    (async () => {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        
        // Solicitar permissões de câmera e galeria
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (!cameraPermission.granted) {
          console.warn('Camera permission not granted');
        }
        if (!mediaLibraryPermission.granted) {
          console.warn('Media library permission not granted');
        }
      } catch (err) {
        console.error('Failed to set up permissions', err);
      }
    })();

    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      // Limpar recursos de gravação
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(console.error);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim() || !user?.phoneNumber) return;
    await sendMessageWithText(inputText);
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const startRecording = async () => {
    try {
      // Verificar permissões
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para gravar áudio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingTime(0);

      // Timer para mostrar tempo de gravação
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação. Tente novamente.');
    }
  };

  const stopRecording = async (autoSend: boolean = false) => {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        Alert.alert('Erro', 'Não foi possível salvar o áudio.');
        return;
      }

      // Transcrever o áudio
      setTranscribing(true);
      const transcriptionResponse = await chatService.transcribeAudio(uri);

      if (transcriptionResponse.success && transcriptionResponse.data) {
        const transcribedText = transcriptionResponse.data;
        if (transcribedText.trim()) {
          if (autoSend) {
            // Se autoSend = true, enviar direto sem deixar no input
            sendMessageWithText(transcribedText);
          } else {
            // Se autoSend = false, colocar no input para o usuário editar
            setInputText(transcribedText);
          }
        } else {
          Alert.alert('Atenção', 'Não foi possível transcrever o áudio. Tente falar mais claramente.');
        }
      } else {
        Alert.alert(
          'Erro na transcrição',
          transcriptionResponse.error || 'Não foi possível transcrever o áudio. Tente novamente.'
        );
      }

      // Limpar arquivo temporário
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (e) {
        console.warn('Failed to delete audio file', e);
      }

      setRecordingTime(0);
      setTranscribing(false);
    } catch (err) {
      console.error('Failed to stop recording', err);
      setTranscribing(false);
      Alert.alert('Erro', 'Não foi possível parar a gravação.');
    }
  };

  const handleTakePhoto = async () => {
    console.log('📸 handleTakePhoto called');
    
    // Fechar modal primeiro
    setShowAttachmentModal(false);
    console.log('📸 Modal closed');
    
    try {
      // Verificar permissões antes de abrir
      console.log('📸 Requesting camera permissions...');
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📸 Camera permission result:', cameraPermission);
      
      if (!cameraPermission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Precisamos de permissão para usar a câmera. Por favor, habilite nas configurações do dispositivo.'
        );
        return;
      }

      // Delay maior para garantir que o modal feche completamente
      console.log('📸 Waiting for modal to close...');
      await new Promise(resolve => setTimeout(resolve, 800));

      console.log('📸 Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      console.log('📸 Camera result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('📸 Image selected:', result.assets[0].uri);
        setSelectedImage(result.assets[0]);
      } else {
        console.log('📸 Camera was canceled or no assets');
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Erro', `Não foi possível tirar a foto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handlePickFromGallery = async () => {
    console.log('🖼️ handlePickFromGallery called');
    
    // Fechar modal primeiro
    setShowAttachmentModal(false);
    console.log('🖼️ Modal closed');
    
    try {
      // Verificar permissões antes de abrir
      console.log('🖼️ Requesting media library permissions...');
      const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('🖼️ Media library permission result:', mediaLibraryPermission);
      
      if (!mediaLibraryPermission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Precisamos de permissão para acessar suas fotos. Por favor, habilite nas configurações do dispositivo.'
        );
        return;
      }

      // Delay maior para garantir que o modal feche completamente
      console.log('🖼️ Waiting for modal to close...');
      await new Promise(resolve => setTimeout(resolve, 800));

      console.log('🖼️ Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      console.log('🖼️ Gallery result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('🖼️ Image selected:', result.assets[0].uri);
        setSelectedImage(result.assets[0]);
      } else {
        console.log('🖼️ Gallery was canceled or no assets');
      }
    } catch (error) {
      console.error('❌ Error picking image:', error);
      Alert.alert('Erro', `Não foi possível selecionar a imagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handlePickDocument = async () => {
    // Prevenir múltiplas chamadas simultâneas (usando ref para evitar race conditions)
    if (isPickingDocument || pickingDocumentRef.current) {
      console.log('Document picker already in progress, ignoring...');
      return;
    }
    
    // Fechar modal primeiro
    setShowAttachmentModal(false);
    pickingDocumentRef.current = true;
    setIsPickingDocument(true);
    
    try {
      // Pequeno delay para garantir que o modal feche completamente
      await new Promise(resolve => setTimeout(resolve, 600));

      console.log('Opening document picker...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      console.log('Document picker result:', JSON.stringify(result, null, 2));

      if (result.canceled) {
        console.log('Document picker was canceled');
        pickingDocumentRef.current = false;
        setIsPickingDocument(false);
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        console.warn('Document picker returned no assets');
        Alert.alert('Aviso', 'Nenhum documento foi selecionado.');
        pickingDocumentRef.current = false;
        setIsPickingDocument(false);
        return;
      }

      const asset = result.assets[0];
      console.log('Selected document:', asset.name, asset.uri);

      // Armazenar documento selecionado para preview (não enviar imediatamente)
      setSelectedDocument({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
      });
      
      pickingDocumentRef.current = false;
      setIsPickingDocument(false);
    } catch (error) {
      console.error('Error picking document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Verificar se é o erro de "document picking in progress"
      if (errorMessage.includes('Different document picking in progress') || 
          errorMessage.includes('document picking in progress')) {
        Alert.alert(
          'Aguarde',
          'Um seletor de documento já está aberto. Por favor, aguarde alguns segundos e tente novamente.'
        );
      } else {
        Alert.alert('Erro', `Não foi possível selecionar o documento: ${errorMessage}`);
      }
      
      pickingDocumentRef.current = false;
      setIsPickingDocument(false);
    }
  };

  const handleCancelImage = () => {
    setSelectedImage(null);
  };

  const handleCancelDocument = () => {
    setSelectedDocument(null);
  };

  const handleSendImage = async () => {
    if (!selectedImage || !user?.phoneNumber) {
      Alert.alert('Erro', 'Usuário não autenticado ou imagem não selecionada.');
      return;
    }

    const imageUri = selectedImage.uri;
    const messageText = inputText || '';
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText || 'Enviei uma imagem',
      isUser: true,
      timestamp: new Date(),
      imageUri: imageUri,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setSelectedImage(null);
    setLoading(true);

    // Criar mensagem da IA vazia para streaming
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      text: '',
      isUser: false,
      timestamp: new Date(),
      isThinking: true,
      isTyping: false,
    };
    setMessages((prev) => [...prev, aiMessage]);
    setStreamingMessageId(aiMessageId);

    try {
      const response = await chatService.sendMessageWithImage(
        user.phoneNumber,
        messageText,
        imageUri,
        // onStream
        (chunk: string, fullText: string) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, text: fullText, isThinking: false, isTyping: true }
                : msg
            )
          );
        },
        // onThinking
        () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, isThinking: true, isTyping: false } : msg
            )
          );
        },
        // onStartTyping
        () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, isThinking: false, isTyping: true } : msg
            )
          );
        }
      );
      
      if (response.success && response.data) {
        const responseData = response.data as any;
        const aiResponse = responseData.message || responseData.response || responseData.text || responseData;
        
        if (typeof aiResponse === 'string') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, text: aiResponse, isThinking: false, isTyping: false }
                : msg
            )
          );
        }
      } else {
        throw new Error(response.error || 'Erro ao processar imagem');
      }
    } catch (error) {
      console.error('Error sending message with image:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                text: 'Desculpe, ocorreu um erro ao processar a imagem. Tente novamente.',
                isThinking: false,
                isTyping: false,
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
    }
  };

  const handleSendDocument = async () => {
    if (!selectedDocument || !user?.phoneNumber) {
      Alert.alert('Erro', 'Usuário não autenticado ou documento não selecionado.');
      return;
    }

    const messageText = inputText || '';
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText || `Enviei um documento: ${selectedDocument.name}`,
      isUser: true,
      timestamp: new Date(),
      attachmentUri: selectedDocument.uri,
      attachmentName: selectedDocument.name,
      attachmentType: selectedDocument.mimeType,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setSelectedDocument(null);
    setLoading(true);

    try {
      const response = await chatService.sendMessageWithDocument(
        user.phoneNumber,
        messageText,
        selectedDocument.uri,
        selectedDocument.name,
        selectedDocument.mimeType
      );
      
      if (response.success && response.data) {
        const responseData = response.data as any;
        const aiResponse = responseData.message || responseData.response || responseData.text || responseData;
        
        if (typeof aiResponse === 'string') {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: aiResponse,
            isUser: false,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
        }
      } else {
        throw new Error(response.error || 'Erro ao processar documento');
      }
    } catch (error) {
      console.error('Error sending message with attachment:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Desculpe, ocorreu um erro ao processar o documento. Tente novamente.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessageWithText = async (text: string) => {
    if (!text.trim() || !user?.phoneNumber) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = text;
    setInputText('');
    setLoading(true);

    // Criar mensagem da IA vazia para streaming
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      text: '',
      isUser: false,
      timestamp: new Date(),
      isThinking: true,
      isTyping: false,
    };
    setMessages((prev) => [...prev, aiMessage]);
    setStreamingMessageId(aiMessageId);

    try {
      const response = await chatService.sendMessage(
        user.phoneNumber,
        messageText,
        // onStream
        (chunk: string, fullText: string) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, text: fullText, isThinking: false, isTyping: true }
                : msg
            )
          );
        },
        // onThinking
        () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, isThinking: true, isTyping: false } : msg
            )
          );
        },
        // onStartTyping
        () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, isThinking: false, isTyping: true } : msg
            )
          );
        },
        // userId
        user.usuarioId
      );
      
      console.log('API Response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        const responseData = response.data as any;
        
        if (responseData.error) {
          throw new Error(responseData.error);
        }
        
        const aiResponse = responseData.message || responseData.response || responseData.text || responseData;
        
        if (typeof aiResponse !== 'string') {
          console.error('Invalid response format:', aiResponse);
          throw new Error('Formato de resposta inválido da API');
        }
        
        const responseLower = aiResponse.toLowerCase();
        if (responseLower.includes('erro ao processar sua imagem') || 
            responseLower.includes('erro ao processar imagem') ||
            (responseLower.includes('imagem') && responseLower.includes('erro'))) {
          console.warn('API retornou erro sobre imagem sem imagem ter sido enviada');
          throw new Error('Erro na resposta da API: mensagem incorreta sobre imagem');
        }
        
        // Atualizar mensagem final e remover estado de digitação
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, text: aiResponse, isThinking: false, isTyping: false }
              : msg
          )
        );
      } else {
        const errorMsg = response.error || 'Erro ao enviar mensagem';
        
        if (errorMsg.includes('Nenhum endpoint') || errorMsg.includes('404')) {
          throw new Error('O serviço de chat não está disponível no momento. Verifique se a API está configurada corretamente.');
        }
        
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      let errorText = 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
      
      if (error instanceof Error) {
        const errorLower = error.message.toLowerCase();
        if (!errorLower.includes('imagem')) {
          if (errorLower.includes('network') || errorLower.includes('fetch')) {
            errorText = 'Erro de conexão. Verifique sua internet e tente novamente.';
          } else if (errorLower.includes('timeout')) {
            errorText = 'A requisição demorou muito. Tente novamente.';
          } else if (error.message && !error.message.includes('Erro na resposta da API')) {
            errorText = 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
          }
        }
      }
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, text: errorText, isThinking: false, isTyping: false }
            : msg
        )
      );
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
    }
  };

  const styles = getStyles(Colors);

  // Calcular o espaçamento do input baseado no estado do teclado
  const inputBottomMargin = keyboardVisible 
    ? 0 // Quando o teclado está aberto, sem margem extra
    : Math.max(insets.bottom, 8) + 72; // Quando fechado, espaço suficiente para a tab bar (60) + padding (12)

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.backgroundGradient as any}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.isUser ? styles.userMessageRow : styles.aiMessageRow,
                ]}
              >
                {!message.isUser && (
                  <View style={styles.aiAvatar}>
                    <IONLogo size={40} />
                  </View>
                )}
                <View style={styles.messageContent}>
                  <Text style={styles.messageLabel}>
                    {message.isUser ? 'Você' : 'ION'}
                  </Text>
                  <BlurView
                    intensity={20}
                    style={[
                      styles.messageBubble,
                      message.isUser ? styles.userBubble : styles.aiBubble,
                    ]}
                  >
                    {message.imageUri && (
                      <Image
                        source={{ uri: message.imageUri }}
                        style={styles.messageImage}
                        resizeMode="cover"
                      />
                    )}
                    {message.attachmentUri && (
                      <View style={[
                        styles.attachmentContainer,
                        message.isUser && styles.attachmentContainerUser
                      ]}>
                        <Ionicons name="document" size={24} color={message.isUser ? Colors.textInverse : Colors.primary} />
                        <Text
                          style={[
                            styles.attachmentText,
                            message.isUser ? styles.userText : styles.aiText,
                          ]}
                          numberOfLines={1}
                        >
                          {message.attachmentName || 'Documento anexado'}
                        </Text>
                      </View>
                    )}
                    {message.isThinking && !message.isUser && (
                      <View style={styles.thinkingContainer}>
                        <ActivityIndicator size="small" color={Colors.ionBlue} style={styles.thinkingIndicator} />
                        <Text style={styles.thinkingText}>Pensando...</Text>
                      </View>
                    )}
                    {message.isTyping && !message.isUser && !message.text && (
                      <View style={styles.typingContainer}>
                        <View style={styles.typingDots}>
                          <View style={styles.typingDot} />
                          <View style={styles.typingDot} />
                          <View style={styles.typingDot} />
                        </View>
                        <Text style={styles.typingText}>Escrevendo...</Text>
                      </View>
                    )}
                    {message.text && (
                      <Text
                        style={[
                          styles.messageText,
                          message.isUser ? styles.userText : styles.aiText,
                          (message.imageUri || message.attachmentUri) && styles.messageTextWithAttachment,
                        ]}
                      >
                        {message.text}
                        {message.isTyping && (
                          <Text style={styles.cursor}>▊</Text>
                        )}
                      </Text>
                    )}
                  </BlurView>
                </View>
                {message.isUser && (
                  <View style={styles.userAvatar}>
                    {user?.usuario?.foto_perfil ? (
                      <Image
                        source={{ uri: user.usuario.foto_perfil }}
                        style={styles.userAvatarImage}
                      />
                    ) : (
                      <Ionicons name="person" size={20} color={Colors.primary} />
                    )}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Image Preview */}
          {selectedImage && (
            <View style={styles.imagePreviewContainer}>
              <BlurView intensity={20} style={styles.imagePreview}>
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.imagePreviewImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.imagePreviewCancel}
                  onPress={handleCancelImage}
                >
                  <Ionicons name="close-circle" size={28} color={Colors.error || '#FF3B30'} />
                </TouchableOpacity>
              </BlurView>
            </View>
          )}

          {/* Document Preview */}
          {selectedDocument && (
            <View style={styles.documentPreviewContainer}>
              <BlurView intensity={20} style={styles.documentPreview}>
                <View style={styles.documentPreviewContent}>
                  <Ionicons name="document" size={48} color={Colors.primary} />
                  <Text style={styles.documentPreviewName} numberOfLines={2}>
                    {selectedDocument.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.documentPreviewCancel}
                  onPress={handleCancelDocument}
                >
                  <Ionicons name="close-circle" size={28} color={Colors.error || '#FF3B30'} />
                </TouchableOpacity>
              </BlurView>
            </View>
          )}

          {/* Input Area */}
          <View style={{ paddingBottom: keyboardVisible ? 0 : inputBottomMargin }}>
            <BlurView intensity={20} style={styles.inputContainer}>
              <TouchableOpacity 
                style={styles.inputIconButton}
                onPress={() => setShowAttachmentModal(true)}
                disabled={!!selectedImage || !!selectedDocument}
              >
                <Ionicons 
                  name="add-circle" 
                  size={28} 
                  color={(selectedImage || selectedDocument) ? Colors.textSecondary + '80' : Colors.textSecondary} 
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={
                  selectedImage 
                    ? "Adicione uma mensagem para a imagem..." 
                    : selectedDocument
                    ? "Adicione uma mensagem para o documento..."
                    : "Converse com a ION..."
                }
                placeholderTextColor={Colors.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />
              <View style={styles.inputActions}>
                {!selectedImage && !selectedDocument && (
                  <>
                    <TouchableOpacity
                      style={[styles.inputIconButton, isRecording && styles.recordingButton]}
                      onPress={isRecording ? () => stopRecording(false) : startRecording}
                      disabled={loading || transcribing}
                    >
                      {transcribing ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Ionicons
                          name={isRecording ? "stop-circle" : "mic"}
                          size={28}
                          color={isRecording ? Colors.error || '#FF3B30' : Colors.textSecondary}
                        />
                      )}
                    </TouchableOpacity>
                    {isRecording && (
                      <View style={styles.recordingIndicator}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingTime}>
                          {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                        </Text>
                      </View>
                    )}
                  </>
                )}
                <TouchableOpacity
                  style={[
                    styles.sendButton, 
                    (!inputText.trim() && !isRecording && !selectedImage && !selectedDocument) && styles.sendButtonDisabled
                  ]}
                  onPress={() => {
                    if (selectedImage) {
                      handleSendImage();
                    } else if (selectedDocument) {
                      handleSendDocument();
                    } else if (isRecording) {
                      stopRecording(true);
                    } else {
                      sendMessage();
                    }
                  }}
                  disabled={(!inputText.trim() && !isRecording && !selectedImage && !selectedDocument) || loading || transcribing}
                >
                  <Ionicons
                    name="arrow-up"
                    size={24}
                    color={(inputText.trim() || isRecording || selectedImage || selectedDocument) ? Colors.textInverse : Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Attachment Modal */}
      <Modal
        visible={showAttachmentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachmentModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachmentModal(false)}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleTakePhoto()}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={24} color={Colors.primary} />
              <Text style={styles.modalOptionText}>Tirar Foto</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handlePickFromGallery()}
              activeOpacity={0.7}
            >
              <Ionicons name="images" size={24} color={Colors.primary} />
              <Text style={styles.modalOptionText}>Escolher da Galeria</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalOption, isPickingDocument && styles.modalOptionDisabled]}
              onPress={() => handlePickDocument()}
              activeOpacity={0.7}
              disabled={isPickingDocument}
            >
              <Ionicons 
                name="document" 
                size={24} 
                color={isPickingDocument ? Colors.textSecondary : Colors.primary} 
              />
              <Text style={[
                styles.modalOptionText,
                isPickingDocument && styles.modalOptionTextDisabled
              ]}>
                {isPickingDocument ? 'Abrindo...' : 'Anexar Documento'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalOption, styles.modalCancel]}
              onPress={() => setShowAttachmentModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function getStyles(Colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'flex-end',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  aiMessageRow: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `rgba(0, 191, 255, 0.2)`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: `rgba(0, 191, 255, 0.3)`,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `rgba(43, 108, 238, 0.2)`,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  messageContent: {
    flex: 1,
    maxWidth: '75%',
  },
  messageLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
    borderColor: Colors.primary,
  },
  aiBubble: {
    backgroundColor: Colors.glassBackground,
    borderBottomLeftRadius: 4,
    borderColor: Colors.glassBorder,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: Colors.textInverse,
  },
  aiText: {
    color: Colors.textPrimary,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 4,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassBackgroundLight,
    overflow: 'hidden',
  },
  inputIconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    marginHorizontal: 4,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.backgroundDarkTertiary,
  },
  recordingButton: {
    backgroundColor: `rgba(255, 59, 48, 0.1)`,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `rgba(255, 59, 48, 0.1)`,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error || '#FF3B30',
    marginRight: 6,
  },
  recordingTime: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error || '#FF3B30',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.glassBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.glassBackgroundLight,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  modalOptionDisabled: {
    opacity: 0.5,
  },
  modalOptionTextDisabled: {
    color: Colors.textSecondary,
  },
  modalCancel: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginTop: 8,
    marginBottom: 0,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error || '#FF3B30',
    textAlign: 'center',
    width: '100%',
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  attachmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 191, 255, 0.1)',
    marginBottom: 8,
  },
  attachmentContainerUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  attachmentText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  messageTextWithAttachment: {
    marginTop: 8,
  },
  imagePreviewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  imagePreview: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    position: 'relative',
  },
  imagePreviewImage: {
    width: '100%',
    height: 200,
  },
  imagePreviewCancel: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 4,
  },
  documentPreviewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  documentPreview: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    position: 'relative',
    padding: 16,
  },
  documentPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 40,
  },
  documentPreviewName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginLeft: 12,
    flex: 1,
  },
  documentPreviewCancel: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 4,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  thinkingIndicator: {
    marginRight: 8,
  },
  thinkingText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.textSecondary,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.ionBlue || Colors.primary,
    marginRight: 4,
    opacity: 0.6,
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.textSecondary,
  },
  messageTextTyping: {
    // Estilo adicional quando está digitando
  },
  cursor: {
    color: Colors.primary,
    opacity: 0.8,
    fontWeight: 'bold',
  },
  });
}
