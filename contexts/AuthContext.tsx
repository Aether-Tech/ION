import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { usuariosService } from '../services/supabaseService';
import { Usuario, supabase } from '../services/supabase';
import { firestoreService } from '../services/firestoreService';

interface User {
  phoneNumber: string;
  usuarioId?: number;
  usuario?: Usuario;
  firebaseUser?: FirebaseUser;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  needsOnboarding: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  completeOnboarding: (phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Observar mudanças no estado de autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('onAuthStateChanged acionado:', firebaseUser ? `usuário autenticado (${firebaseUser.uid})` : 'usuário não autenticado');

      if (firebaseUser) {
        // Usuário autenticado no Firebase
        console.log('Usuário autenticado, verificando perfil...', firebaseUser.uid);

        // Buscar perfil do usuário no Firestore
        let userProfile: any = null;
        try {
          userProfile = await firestoreService.getUserProfile(firebaseUser.uid);

          // Se não encontrou, aguardar um pouco e tentar novamente (pode estar sendo criado)
          if (!userProfile) {
            console.log('Perfil não encontrado, aguardando 1 segundo e tentando novamente...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              userProfile = await firestoreService.getUserProfile(firebaseUser.uid);
            } catch (retryError) {
              console.warn('Erro ao buscar perfil no Firestore (retry):', retryError);
            }
          }
        } catch (firestoreError) {
          console.warn('Erro ao buscar perfil no Firestore:', firestoreError);
        }

        const hasProfile = !!userProfile;
        const hasCompletedOnboarding = userProfile?.hasCompletedOnboarding === true;
        const savedPhone = userProfile?.phoneNumber;

        console.log('Status do perfil:', { hasProfile, hasCompletedOnboarding, savedPhone });

        // 1. Tentar buscar usuário no Supabase pelo EMAIL (Prioridade)
        let usuario: Usuario | null = null;
        if (firebaseUser.email) {
          console.log('Buscando usuário no Supabase com email:', firebaseUser.email);
          usuario = await usuariosService.getByEmail(firebaseUser.email);
        }

        // 2. Se não achou pelo email, e tem telefone salvo, tentar pelo telefone (Legado/Fallback)
        if (!usuario && savedPhone) {
          console.log('Usuário não encontrado por email, tentando por telefone:', savedPhone);
          usuario = await usuariosService.getByCelular(savedPhone);
        }

        // Verificar o resultado da busca
        if (usuario && usuario.status === 'ativo') {
          console.log('Usuário encontrado e ativo:', usuario.id);

          // Se encontrou usuário, mas não tinha telefone no Firestore ou era diferente, atualizar Firestore
          if (usuario.celular && usuario.celular !== savedPhone) {
            console.log('Atualizando telefone no Firestore para coincidir com Supabase');
            await firestoreService.updatePhoneNumber(firebaseUser.uid, usuario.celular);
          }

          // Se encontrou usuário mas flag de onboarding estava false, corrigir
          if (!hasCompletedOnboarding) {
            console.log('Marcando onboarding como completo pois usuário já existe no Supabase');
            await firestoreService.completeOnboarding(firebaseUser.uid, usuario.celular);
          }

          const userData: User = {
            phoneNumber: usuario.celular,
            usuarioId: usuario.id,
            usuario,
            firebaseUser,
          };

          await AsyncStorage.setItem('user', JSON.stringify({
            phoneNumber: userData.phoneNumber,
            usuarioId: userData.usuarioId,
          }));

          setUser(userData);
          setNeedsOnboarding(false);
        } else {
          // Usuário NÃO encontrado no Supabase (ou inativo)
          console.log('Usuário não encontrado no Supabase ou inativo. Precisa de cadastro/onboarding.');

          const userData: User = {
            phoneNumber: savedPhone || '',
            firebaseUser,
          };

          setUser(userData);
          // Se não tem usuário no supabase, DEVE ir para onboarding/criação
          setNeedsOnboarding(true);
        }

        setLoading(false);
      } else {
        // Usuário não autenticado
        await AsyncStorage.removeItem('user');
        setUser(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Login com email e senha
  const login = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O onAuthStateChanged vai lidar com o resto
    } catch (error: any) {
      console.error('Error logging in:', error);

      // Tratar erros específicos do Firebase
      if (error.code === 'auth/invalid-email') {
        throw new Error('Email inválido. Verifique o formato.');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('Usuário não encontrado. Verifique seu email.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Senha incorreta. Tente novamente.');
      } else if (error.code === 'auth/invalid-credential') {
        throw new Error('Email ou senha incorretos.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Muitas tentativas. Tente novamente mais tarde.');
      }

      throw new Error(error.message || 'Erro ao fazer login');
    }
  };

  // Registrar novo usuário com email e senha
  const register = async (email: string, password: string, displayName?: string): Promise<void> => {
    try {
      // Criar conta no Firebase (isso já faz login automático)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      console.log('✅ Conta criada no Firebase, UID:', userCredential.user.uid);

      // Atualizar perfil com nome se fornecido
      if (displayName) {
        try {
          await updateProfile(userCredential.user, {
            displayName,
          });
          console.log('✅ Perfil atualizado com nome:', displayName);
        } catch (profileError) {
          console.warn('⚠️ Erro ao atualizar perfil com nome:', profileError);
          // Não bloquear o fluxo se falhar
        }
      }

      // Criar perfil inicial no Firestore (sem telefone e sem completar onboarding)
      // Isso garante que o usuário será redirecionado para o onboarding
      // Se falhar, não bloquear o fluxo - vamos tratar manualmente
      try {
        const profileResult = await firestoreService.createOrUpdateUserProfile(userCredential.user, {
          email,
          displayName,
        });

        if (!profileResult) {
          console.warn('⚠️ Perfil não foi criado no Firestore, mas continuando...');
        } else {
          console.log('✅ Perfil criado no Firestore:', profileResult.hasCompletedOnboarding);
        }
      } catch (firestoreError: any) {
        console.warn('⚠️ Erro ao criar perfil no Firestore (não bloqueia o fluxo):', firestoreError);
        // Não lançar erro - vamos tratar manualmente abaixo
      }

      // IMPORTANTE: Forçar atualização do estado imediatamente
      // O onAuthStateChanged pode demorar, então vamos setar manualmente
      const userData: User = {
        phoneNumber: '',
        firebaseUser: userCredential.user,
      };
      setUser(userData);
      setNeedsOnboarding(true);
      setLoading(false);

      console.log('✅ Estado atualizado manualmente - redirecionando para onboarding');

      // O onAuthStateChanged também vai ser acionado, mas já temos o estado correto

    } catch (error: any) {
      console.error('Error registering:', error);

      // Tratar erros específicos do Firebase
      if (error.code === 'auth/invalid-email') {
        throw new Error('Email inválido. Verifique o formato.');
      } else if (error.code === 'auth/email-already-in-use') {
        throw new Error('Este email já está em uso. Tente fazer login.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Senha muito fraca. Use pelo menos 6 caracteres.');
      }

      throw new Error(error.message || 'Erro ao criar conta');
    }
  };

  // Completar onboarding
  const completeOnboarding = async (phoneNumber: string): Promise<void> => {
    try {
      if (!user?.firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const email = user.firebaseUser.email || '';
      console.log('Completando onboarding para:', email, phoneNumber);

      // 1. Verificar se já existe usuário no Supabase com esse email
      let usuario = await usuariosService.getByEmail(email);

      // 2. Se não existe por email, verificar por telefone (para evitar duplicação se ele já existia mas mudou email no firebase - raro, mas possível)
      if (!usuario) {
        usuario = await usuariosService.getByCelular(phoneNumber);
      }

      // 3. Se ainda não existe, criar
      if (!usuario) {
        console.log('Criando novo usuário no Supabase...');
        usuario = await usuariosService.create({
          nome: user.firebaseUser.displayName || 'Usuário',
          email: email,
          celular: phoneNumber,
          status: 'ativo',
          foto_perfil: user.firebaseUser.photoURL || null,
        });
      } else {
        console.log('Usuário já existe no Supabase, atualizando dados se necessário...');
        // Opcional: Atualizar celular se mudou?
        if (usuario.celular !== phoneNumber) {
          await usuariosService.update(usuario.id, { celular: phoneNumber });
          usuario.celular = phoneNumber;
        }
      }

      if (!usuario) {
        throw new Error('Falha ao criar/recuperar usuário no sistema.');
      }

      // Atualizar perfil no Firestore para ficar sincronizado
      await firestoreService.completeOnboarding(
        user.firebaseUser.uid,
        phoneNumber
      );

      const userData: User = {
        phoneNumber: usuario.celular,
        usuarioId: usuario.id,
        usuario,
        firebaseUser: user.firebaseUser,
      };

      await AsyncStorage.setItem('user', JSON.stringify({
        phoneNumber: userData.phoneNumber,
        usuarioId: userData.usuarioId,
      }));
      setUser(userData);
      setNeedsOnboarding(false);

    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };


  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      await AsyncStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData.usuarioId) {
          const usuario = await usuariosService.getById(userData.usuarioId);
          if (usuario) {
            const updatedUser = { ...userData, usuario, usuarioId: usuario.id };
            await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      needsOnboarding,
      login,
      register,
      completeOnboarding,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

