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
import { Usuario } from '../services/supabase';
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
        try {
          // Tentar buscar o perfil, com retry se necessário
          let userProfile: any = null;
          
          try {
            userProfile = await firestoreService.getUserProfile(firebaseUser.uid);
          } catch (firestoreError) {
            console.warn('Erro ao buscar perfil no Firestore (primeira tentativa):', firestoreError);
          }
          
          // Se não encontrou, aguardar um pouco e tentar novamente (pode estar sendo criado)
          if (!userProfile) {
            console.log('Perfil não encontrado, aguardando 1 segundo e tentando novamente...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
              userProfile = await firestoreService.getUserProfile(firebaseUser.uid);
            } catch (firestoreError) {
              console.warn('Erro ao buscar perfil no Firestore (segunda tentativa):', firestoreError);
            }
          }
          
          // Se não tem perfil ou não completou onboarding, mostrar onboarding
          // Mesmo se houver erro no Firestore, assumir que precisa de onboarding
          if (!userProfile || !userProfile.hasCompletedOnboarding) {
            console.log('Usuário precisa de onboarding:', {
              hasProfile: !!userProfile,
              hasCompletedOnboarding: userProfile?.hasCompletedOnboarding,
            });
            setNeedsOnboarding(true);
            const userData: User = {
              phoneNumber: '', // Será coletado no onboarding
              firebaseUser,
            };
            setUser(userData);
            setLoading(false);
            return;
          }

          // Se tem perfil completo, buscar dados do Supabase usando o telefone do Firestore
          const phoneNumber = userProfile.phoneNumber || '';
          
          if (!phoneNumber) {
            // Se não tem telefone mesmo após onboarding, mostrar novamente
            setNeedsOnboarding(true);
            const userData: User = {
              phoneNumber: '',
              firebaseUser,
            };
            setUser(userData);
            setLoading(false);
            return;
          }

          const usuario = await usuariosService.getByCelular(phoneNumber);
          
          if (usuario && usuario.status === 'ativo') {
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
            // Usuário não encontrado no Supabase ou inativo
            // Mas já tem perfil no Firestore, então manter autenticado
            const userData: User = {
              phoneNumber: phoneNumber,
              firebaseUser,
            };
            setUser(userData);
            setNeedsOnboarding(false);
          }
        } catch (error) {
          console.error('Error loading user:', error);
          // Se houver erro, assumir que é novo usuário e mostrar onboarding
          // Isso garante que o fluxo continue mesmo se houver problemas
          const userData: User = {
            phoneNumber: '',
            firebaseUser,
          };
          setUser(userData);
          setNeedsOnboarding(true); // Mostrar onboarding em caso de erro
          setLoading(false); // IMPORTANTE: garantir que o loading termine
        }
      } else {
        // Usuário não autenticado
        await AsyncStorage.removeItem('user');
        setUser(null);
        setNeedsOnboarding(false);
      }
      setLoading(false);
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

      // Atualizar perfil no Firestore com número de telefone e marcar onboarding como completo
      const success = await firestoreService.completeOnboarding(
        user.firebaseUser.uid,
        phoneNumber
      );

      if (!success) {
        throw new Error('Erro ao salvar dados do usuário');
      }

      // Criar ou buscar usuário no Supabase
      let usuario = await usuariosService.getByCelular(phoneNumber);
      
      if (!usuario) {
        // Criar novo usuário no Supabase
        usuario = await usuariosService.create({
          nome: 'Usuário',
          email: user.firebaseUser.email || '',
          celular: phoneNumber,
          status: 'ativo',
        });
      }

      if (usuario) {
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
      }
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

