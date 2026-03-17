import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';

interface User {
  phoneNumber?: string | null;
  usuarioId?: number;
  usuario?: Usuario;
  firebaseUser?: FirebaseUser;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  needsOnboarding: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, phoneNumber: string | undefined, displayName?: string) => Promise<void>;
  completeOnboarding: (phoneNumber?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (identityToken: string, nonce: string, fullName?: { givenName?: string | null, familyName?: string | null }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const isRegisteringRef = useRef(false);

  useEffect(() => {
    // Observar mudanças no estado de autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      __DEV__ && console.log('onAuthStateChanged acionado:', firebaseUser ? 'usuário autenticado' : 'usuário não autenticado');

      // Skip processing if register() is handling everything
      if (isRegisteringRef.current) {
        __DEV__ && console.log('Registro em andamento, pulando onAuthStateChanged');
        return;
      }

      if (firebaseUser) {
        // Usuário autenticado no Firebase
        __DEV__ && console.log('Usuário autenticado, verificando perfil...');

        // Buscar perfil do usuário no Firestore
        let userProfile: any = null;
        try {
          userProfile = await firestoreService.getUserProfile(firebaseUser.uid);

          // Se não encontrou, aguardar um pouco e tentar novamente (pode estar sendo criado)
          if (!userProfile) {
            __DEV__ && console.log('Perfil não encontrado, aguardando 1 segundo e tentando novamente...');
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

        __DEV__ && console.log('Status do perfil:', { hasProfile, hasCompletedOnboarding });

        // 1. Tentar buscar usuário no Supabase pelo EMAIL (Prioridade)
        let usuario: Usuario | null = null;
        if (firebaseUser.email) {
          __DEV__ && console.log('Buscando usuário no Supabase por email...');
          usuario = await usuariosService.getByEmail(firebaseUser.email);
        }

        // 2. Se não achou pelo email, e tem telefone salvo, tentar pelo telefone (Legado/Fallback)
        if (!usuario && savedPhone) {
          __DEV__ && console.log('Usuário não encontrado por email, tentando por telefone...');
          usuario = await usuariosService.getByCelular(savedPhone);
        }

        // Verificar o resultado da busca
        if (usuario && usuario.status === 'ativo') {
          __DEV__ && console.log('Usuário encontrado e ativo:', usuario.id);

          // Se encontrou usuário, mas não tinha telefone no Firestore ou era diferente, atualizar Firestore
          if (usuario.celular && usuario.celular !== savedPhone) {
            __DEV__ && console.log('Atualizando telefone no Firestore para coincidir com Supabase');
            await firestoreService.updatePhoneNumber(firebaseUser.uid, usuario.celular);
          }

          // Se encontrou usuário mas flag de onboarding estava false, corrigir
          if (!hasCompletedOnboarding) {
            __DEV__ && console.log('Marcando onboarding como completo pois usuário já existe no Supabase');
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
          __DEV__ && console.log('Usuário não encontrado no Supabase. Verificando necessidade de criação automática...');

          // Se tivermos email (Google/Apple/EmailAuth), podemos criar automaticamente
          if (firebaseUser.email) {
            __DEV__ && console.log('Criando usuário automaticamente...');
            try {
              const novoUsuario = await usuariosService.create({
                nome: firebaseUser.displayName || 'Usuário',
                email: firebaseUser.email,
                celular: savedPhone || null, // Celular é opcional agora
                status: 'ativo',
                foto_perfil: firebaseUser.photoURL || null,
              });

              if (novoUsuario) {
                usuario = novoUsuario;

                // Forçar atualização do user state
                const userData: User = {
                  phoneNumber: savedPhone || null,
                  usuarioId: usuario.id,
                  usuario,
                  firebaseUser,
                };

                setUser(userData);
                setNeedsOnboarding(false);
              } else {
                // Fallback se falhar criação
                setUser({ phoneNumber: savedPhone || null, firebaseUser });
                setNeedsOnboarding(true);
              }
            } catch (e) {
              console.error('Erro na criação automática:', e);
              setUser({ phoneNumber: savedPhone || null, firebaseUser });
              setNeedsOnboarding(true);
            }
          } else {
            // Se não tem email (muito raro hoje em dia), pede onboarding
            const userData: User = {
              phoneNumber: savedPhone || null,
              firebaseUser,
            };
            setUser(userData);
            setNeedsOnboarding(true);
          }
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
  const register = async (email: string, password: string, phoneNumber?: string, displayName?: string): Promise<void> => {
    isRegisteringRef.current = true;
    try {
      // Criar conta no Firebase (isso já faz login automático)
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        __DEV__ && console.log('✅ Conta criada no Firebase');
      } catch (createError: any) {
        if (createError.code === 'auth/email-already-in-use') {
          // Email já existe, tentar fazer login
          __DEV__ && console.log('Email já em uso, tentando login...');
          userCredential = await signInWithEmailAndPassword(auth, email, password);
          __DEV__ && console.log('✅ Login realizado (email já existia)');
        } else {
          throw createError;
        }
      }

      // Atualizar perfil com nome se fornecido
      if (displayName) {
        try {
          await updateProfile(userCredential.user, {
            displayName,
          });
          __DEV__ && console.log('✅ Perfil atualizado com nome');
        } catch (profileError) {
          console.warn('⚠️ Erro ao atualizar perfil com nome:', profileError);
          // Não bloquear o fluxo se falhar
        }
      }

      // Criar usuário no Supabase IMEDIATAMENTE
      let usuario: Usuario | null = null;
      try {
        __DEV__ && console.log('Criando usuário no Supabase...');

        // Verificar se já existe (raro, mas possível)
        const existingByEmail = await usuariosService.getByEmail(email);
        const existingByPhone = await usuariosService.getByCelular(phoneNumber);

        if (existingByEmail) {
          __DEV__ && console.log('Usuário já existia por email (Supabase):', existingByEmail.id);
          usuario = existingByEmail;
          // Atualizar telefone se necessário
          if (usuario && usuario.celular !== phoneNumber) {
            await usuariosService.update(usuario.id, { celular: phoneNumber || null });
            usuario.celular = phoneNumber || null;
          }
        } else if (existingByPhone) {
          __DEV__ && console.log('Usuário já existia por telefone (Supabase):', existingByPhone.id);
          usuario = existingByPhone;
          // Atualizar email se necessário (embora email seja unico...)
        } else {
          // Criar novo
          usuario = await usuariosService.create({
            nome: displayName || 'Usuário',
            email: email,
            celular: phoneNumber || null,
            status: 'ativo',
            foto_perfil: userCredential.user.photoURL || null,
          });
        }
      } catch (supabaseError) {
        console.error('Erro crítico ao criar usuário no Supabase:', supabaseError);
        // Ainda não vamos falhar o registro inteiro, mas isso é grave
      }

      // Criar perfil inicial no Firestore COM telefone e onboarding COMPLETO
      try {
        const profileResult = await firestoreService.createOrUpdateUserProfile(userCredential.user, {
          email,
          displayName,
          phoneNumber: phoneNumber || null,
          hasCompletedOnboarding: true, // Já marcamos como completo pois pegamos o telefone no registro
        });

        if (!profileResult) {
          console.warn('⚠️ Perfil não foi criado no Firestore, mas continuando...');
        } else {
          __DEV__ && console.log('✅ Perfil criado no Firestore (com onboarding completo)');
        }
      } catch (firestoreError: any) {
        console.warn('⚠️ Erro ao criar perfil no Firestore (não bloqueia o fluxo):', firestoreError);
      }

      // IMPORTANTE: Forçar atualização do estado imediatamente
      const userData: User = {
        phoneNumber: phoneNumber || null,
        usuarioId: usuario?.id,
        usuario: usuario || undefined,
        firebaseUser: userCredential.user,
      };

      setUser(userData);
      setNeedsOnboarding(false); // NÃO precisa mais de onboarding
      setLoading(false);

      if (userData.usuarioId) {
        await AsyncStorage.setItem('user', JSON.stringify({
          phoneNumber: userData.phoneNumber,
          usuarioId: userData.usuarioId,
        }));
      }

      __DEV__ && console.log('✅ Estado atualizado manualmente - redirecionando para app principal');

    } catch (error: any) {
      console.error('Error registering:', error);

      // Tratar erros específicos do Firebase
      if (error.code === 'auth/invalid-email') {
        throw new Error('Email inválido. Verifique o formato.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Senha muito fraca. Use pelo menos 6 caracteres.');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error('Este email já está cadastrado e a senha está incorreta. Tente fazer login.');
      }

      throw new Error(error.message || 'Erro ao criar conta');
    } finally {
      isRegisteringRef.current = false;
    }
  };

  // Completar onboarding
  const completeOnboarding = async (phoneNumber?: string): Promise<void> => {
    try {
      if (!user?.firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const email = user.firebaseUser.email || '';
      __DEV__ && console.log('Completando onboarding...');

      // 1. Verificar se já existe usuário no Supabase com esse email
      let usuario = await usuariosService.getByEmail(email);

      // 2. Se não existe por email, verificar por telefone SE fornecido
      if (!usuario && phoneNumber) {
        usuario = await usuariosService.getByCelular(phoneNumber);
      }

      // 3. Se ainda não existe, criar
      if (!usuario) {
        __DEV__ && console.log('Criando novo usuário no Supabase...');
        usuario = await usuariosService.create({
          nome: user.firebaseUser.displayName || 'Usuário',
          email: email,
          celular: phoneNumber || null,
          status: 'ativo',
          foto_perfil: user.firebaseUser.photoURL || null,
        });
      } else {
        __DEV__ && console.log('Usuário já existe no Supabase, atualizando dados se necessário...');
        // Opcional: Atualizar celular se mudou?
        // Opcional: Atualizar celular se mudou e foi fornecido novo
        if (phoneNumber && usuario.celular !== phoneNumber) {
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
        phoneNumber || null
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
      // Se falhar o onboarding, deslogar o usuário para ele tentar novamente limpo
      // Isso evita que ele fique preso na tela de onboarding com um usuário bugado
      try {
        await logout();
      } catch (logoutError) {
        console.warn('Erro ao deslogar após falha no onboarding:', logoutError);
      }
      throw error;
    }
  };



  const loginWithGoogle = async (idToken: string) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      __DEV__ && console.log('Google Sign-In successful');
      // onAuthStateChanged will handle the rest
    } catch (error: any) {
      console.error('Error logging in with Google:', error);
      throw error;
    }
  };

  const loginWithApple = async (identityToken: string, nonce: string, fullName?: { givenName?: string | null, familyName?: string | null }) => {
    try {
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: nonce,
      });

      const userCredential = await signInWithCredential(auth, credential);
      __DEV__ && console.log('Apple Sign-In successful');

      if (fullName?.givenName || fullName?.familyName) {
        try {
          const displayName = [fullName.givenName, fullName.familyName].filter(Boolean).join(' ');
          if (displayName) {
            await updateProfile(userCredential.user, { displayName });
          }
        } catch (e) {
          console.warn('Error updating profile name from Apple:', e);
        }
      }
    } catch (error: any) {
      console.error('Error logging in with Apple:', error);
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
      loginWithGoogle,
      loginWithApple,
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

