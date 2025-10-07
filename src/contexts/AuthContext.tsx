import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  type User as FirebaseUser
} from 'firebase/auth'
import { auth } from '../firebase/config'
import { firebaseDataService } from '../services/firebaseDataService'
import type { User } from '../types'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string, displayName: string) => Promise<any>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function signUp(email: string, password: string, displayName: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName });

    const newUser = {
      id: user.uid,
      name: displayName,
      username: email.split('@')[0],
      email: user.email,
      avatar: user.photoURL || '',
      bio: '',
      influences: 0,
      tags: [],
      location: '',
      followers: [],
      following: [],
      createdAt: new Date().toISOString()
    };
    
    await firebaseDataService.createUser(newUser);

    const defaultLists = [
      { name: 'All Loved', description: 'All the places you\'ve loved.', privacy: 'private', tags: ['auto-generated', 'loved'] },
      { name: 'All Tried', description: 'All the places you\'ve tried.', privacy: 'private', tags: ['auto-generated', 'tried'] },
      { name: 'All Want', description: 'All the places you want to try.', privacy: 'private', tags: ['auto-generated', 'want'] }
    ];

    for (const list of defaultLists) {
      await firebaseDataService.createList({ ...list, userId: user.uid });
    }

    return userCredential;
  }

  function signIn(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  function logout() {
    return signOut(auth)
  }

  function resetPassword(email: string) {
    return sendPasswordResetEmail(auth, email)
  }

      useEffect(() => {
        // Check for screenshot/demo mode (for automated testing/screenshots)
        const isScreenshotMode = localStorage.getItem('__screenshot_mode') === 'true' || 
                                 new URLSearchParams(window.location.search).get('screenshot') === 'true';
        
        if (isScreenshotMode) {
          // Create a mock user for screenshot mode
          const mockUser: User = {
            id: 'screenshot-user-id',
            name: 'Demo User',
            username: 'demo',
            email: 'demo@thisisdemo.app',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
            bio: 'Demo user for screenshots',
            influences: 42,
            tags: ['coffee', 'cozy', 'exploring'],
            location: 'San Francisco, CA',
            followers: [],
            following: [],
            createdAt: new Date().toISOString()
          };
          setCurrentUser(mockUser);
          setLoading(false);
          return;
        }

        // Normal Firebase auth flow
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
              const appUser = await firebaseDataService.getCurrentUser(user.uid);
              setCurrentUser(appUser);
            } else {
              setCurrentUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

  const value = {
    currentUser,
    loading,
    signIn,
    signUp,
    logout,
    resetPassword
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
} 