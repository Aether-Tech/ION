import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usuariosService } from '../services/supabaseService';
import { Usuario } from '../services/supabase';

interface User {
  phoneNumber: string;
  usuarioId?: number;
  usuario?: Usuario;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        // Se temos um usuarioId, buscar dados atualizados do Supabase
        if (userData.usuarioId) {
          const usuario = await usuariosService.getById(userData.usuarioId);
          if (usuario) {
            setUser({ ...userData, usuario, usuarioId: usuario.id });
          } else {
            setUser(userData);
          }
        } else {
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (phoneNumber: string) => {
    try {
      // Buscar usuário pelo celular na tabela de usuários
      const usuario = await usuariosService.getByCelular(phoneNumber);
      
      // Se não existe, retornar erro
      if (!usuario) {
        throw new Error('Usuário não encontrado. Verifique se o número de telefone está correto.');
      }

      // Verificar se o usuário está ativo
      if (usuario.status !== 'ativo') {
        throw new Error(`Usuário ${usuario.status}. Entre em contato com o suporte.`);
      }

      // Carregar todas as informações do usuário do Supabase
      const userData: User = {
        phoneNumber: usuario.celular,
        usuarioId: usuario.id,
        usuario, // Inclui nome, email, celular, status, etc.
      };

      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
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
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
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

