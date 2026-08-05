import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export { firebaseConfig };
export const auth = getAuth(app);

// Use persistent cache to reduce quota usage and support multiple tabs (such as the preview iframe and full tab), with safe in-memory fallback
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  }, (firebaseConfig as any).firestoreDatabaseId);
} catch (cacheErr) {
  console.warn("Failed to initialize Firestore with persistent local cache (likely restricted iframe context), falling back to in-memory Firestore:", cacheErr);
  try {
    firestoreInstance = initializeFirestore(app, {}, (firebaseConfig as any).firestoreDatabaseId);
  } catch (secondErr) {
    firestoreInstance = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  }
}
export const db = firestoreInstance;

export const storage = getStorage(app);

let messagingInstance = null;
if (typeof window !== 'undefined') {
  const isMessagingSupported = 
    'serviceWorker' in navigator && 
    'PushManager' in window && 
    'Notification' in window;

  if (isMessagingSupported) {
    try {
      messagingInstance = getMessaging(app);
    } catch (error) {
      console.warn("Firebase Messaging is not supported in this browser:", error);
    }
  } else {
    console.log("Firebase Messaging is not supported in this browser context (missing ServiceWorker, PushManager, or Notification APIs).");
  }
}
export const messaging = messagingInstance;

// Auth Providers
export const googleProvider = new GoogleAuthProvider();

// Custom authentication listener wrapper to support bypassed local sessions
const mockedAuthListeners = new Set<(user: any | null) => void>();

export const triggerMockAuthStateChanged = (user: any | null) => {
  for (const listener of mockedAuthListeners) {
    try {
      listener(user);
    } catch (e) {
      console.error("Error triggering mock auth state listener:", e);
    }
  }
};

const originalOnAuthStateChanged = onAuthStateChanged;

const customOnAuthStateChanged = (authInstance: any, callback: (user: any | null) => void) => {
  mockedAuthListeners.add(callback);
  
  // Immediately execute with local storage user if present
  let localUser = null;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        localUser = JSON.parse(stored);
      }
    } catch (err) {
      console.warn("Could not read currentUser from localStorage:", err);
    }
  }
  
  if (localUser) {
    // Deliver local user immediately
    setTimeout(() => {
      callback(localUser);
    }, 0);
  }
  
  // Also register with standard Firebase Auth to support hybrid logins
  const unsubscribe = originalOnAuthStateChanged(authInstance, (firebaseUser) => {
    if (firebaseUser) {
      callback(firebaseUser);
    } else if (!localUser) {
      callback(null);
    }
  });
  
  return () => {
    mockedAuthListeners.delete(callback);
    unsubscribe();
  };
};

export { customOnAuthStateChanged as onAuthStateChanged };

// Auth Helpers
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export const logout = async () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('currentUser');
  }
  triggerMockAuthStateChanged(null);
  try {
    await signOut(auth);
  } catch (err) {
    console.warn("Standard Firebase logout failed (possibly unauthenticated or disabled Auth API):", err);
  }
};

export type { User };
