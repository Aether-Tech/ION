import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  createdAt: any;
  updatedAt: any;
  hasCompletedOnboarding: boolean;
}

export const firestoreService = {
  // Criar ou atualizar perfil do usuário
  createOrUpdateUserProfile: async (
    firebaseUser: FirebaseUser,
    additionalData?: {
      phoneNumber?: string;
      displayName?: string;
      email?: string;
      photoURL?: string;
    }
  ): Promise<UserProfile | null> => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      const userData: Partial<UserProfile> = {
        uid: firebaseUser.uid,
        phoneNumber: additionalData?.phoneNumber || firebaseUser.phoneNumber || '',
        displayName: additionalData?.displayName || firebaseUser.displayName || '',
        email: additionalData?.email || firebaseUser.email || '',
        photoURL: additionalData?.photoURL || firebaseUser.photoURL || '',
        updatedAt: serverTimestamp(),
      };

      if (!userSnap.exists()) {
        // Criar novo perfil
        await setDoc(userRef, {
          ...userData,
          createdAt: serverTimestamp(),
          hasCompletedOnboarding: false,
        });
      } else {
        // Atualizar perfil existente
        await updateDoc(userRef, userData);
      }

      // Retornar dados atualizados
      const updatedSnap = await getDoc(userRef);
      return updatedSnap.data() as UserProfile;
    } catch (error) {
      console.error('Error creating/updating user profile:', error);
      return null;
    }
  },

  // Buscar perfil do usuário
  getUserProfile: async (uid: string): Promise<UserProfile | null> => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        return userSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  },

  // Atualizar número de telefone
  updatePhoneNumber: async (uid: string, phoneNumber: string): Promise<boolean> => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        phoneNumber,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      console.error('Error updating phone number:', error);
      return false;
    }
  },

  // Marcar onboarding como completo
  completeOnboarding: async (uid: string, phoneNumber: string): Promise<boolean> => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        phoneNumber,
        hasCompletedOnboarding: true,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      console.error('Error completing onboarding:', error);
      return false;
    }
  },
};

