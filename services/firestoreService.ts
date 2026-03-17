import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  phoneNumber?: string | null;
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
      phoneNumber?: string | null;
      displayName?: string;
      email?: string;
      photoURL?: string;
      hasCompletedOnboarding?: boolean;
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

      if (additionalData?.hasCompletedOnboarding !== undefined) {
        userData.hasCompletedOnboarding = additionalData.hasCompletedOnboarding;
      }

      if (!userSnap.exists()) {
        // Criar novo perfil
        await setDoc(userRef, {
          ...userData,
          createdAt: serverTimestamp(),
          hasCompletedOnboarding: additionalData?.hasCompletedOnboarding !== undefined ? additionalData.hasCompletedOnboarding : false,
        });
      } else {
        // Atualizar perfil existente
        await setDoc(userRef, userData, { merge: true });
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
  updatePhoneNumber: async (uid: string, phoneNumber: string | null): Promise<boolean> => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        phoneNumber,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error updating phone number:', error);
      return false;
    }
  },

  // Marcar onboarding como completo
  completeOnboarding: async (uid: string, phoneNumber: string | null): Promise<boolean> => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        uid,
        phoneNumber,
        hasCompletedOnboarding: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error completing onboarding:', error);
      return false;
    }
  },
};

