import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from '../../services/resilientFirestoreClient';
import { auth, db } from '../api/firebase';
import { UserData } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let lastUid: string | null = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Don't refetch if the user UID hasn't changed
      if (firebaseUser?.uid === lastUid && userData) {
        setUser(firebaseUser);
        setLoading(false);
        return;
      }
      
      lastUid = firebaseUser?.uid || null;
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Tenta buscar na coleção usuários primeiro
          // Use getDoc which will automatically use local cache if data is fresh
          let userDoc = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
          
          if (userDoc.exists()) {
            setUserData({ id: userDoc.id, ...userDoc.data() } as UserData);
          } else {
            // Se não encontrar, busca na coleção técnicos pelo usuarioId
            const q = query(collection(db, 'tecnicos'), where('usuarioId', '==', firebaseUser.uid));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const docSnap = querySnapshot.docs[0];
              setUserData({ id: docSnap.id, ...docSnap.data() } as UserData);
            }
          }
        } catch (error) {
          console.error("AuthContext: Error fetching user data:", error);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [userData]);

  const signOut = async () => {
    await auth.signOut();
  };

  const signIn = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signOut, signIn }}>
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
