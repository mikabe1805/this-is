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
  refreshCurrentUser: () => Promise<void>
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
      { name: 'All Loved', description: 'All the places you\'ve loved.', privacy: 'private' as const, tags: ['auto-generated', 'loved'] },
      { name: 'All Tried', description: 'All the places you\'ve tried.', privacy: 'private' as const, tags: ['auto-generated', 'tried'] },
      { name: 'All Want', description: 'All the places you want to try.', privacy: 'private' as const, tags: ['auto-generated', 'want'] }
    ];

    // Parallelize the three default-list creates. Was a sequential loop —
    // the third roundtrip was held up behind the first two, slowing
    // signup→onboarding by a few seconds on cold connections.
    await Promise.all(
      defaultLists.map(list =>
        firebaseDataService.createList({ ...list, userId: user.uid }).catch(e => {
          console.warn('[signUp] failed to create default list', list.name, e)
          return null
        })
      )
    );

    // Hydrate currentUser immediately so the UI advances past the auth gate
    // without waiting for the onAuthStateChanged race to resolve.
    try {
      firebaseDataService.invalidateUserCache?.(user.uid)
    } catch {}
    const fresh = await firebaseDataService.getCurrentUser(user.uid)
    if (fresh) setCurrentUser(fresh)

    return userCredential;
  }

  async function refreshCurrentUser() {
    const fbUser = auth.currentUser
    if (!fbUser) return
    try {
      firebaseDataService.invalidateUserCache?.(fbUser.uid)
    } catch {}
    const fresh = await firebaseDataService.getCurrentUser(fbUser.uid)
    if (fresh) setCurrentUser(fresh)
  }

  function signIn(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    // Wipe per-user caches BEFORE signing out so any in-flight queries that
    // depend on auth.currentUser don't refill the cache during the brief
    // window where the next user is loading.
    try {
      firebaseDataService.clearAllUserScopedState()
    } catch (e) {
      console.warn('[logout] cache cleanup failed', e)
    }
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

        // Normal Firebase auth flow.
        // We retry the Firestore lookup briefly to handle two cases: (1) signup
        // race — Firebase Auth fires before our Firestore user doc has been
        // written; (2) a partially-completed prior signup where the doc was
        // never created — in which case we bootstrap a minimal one from the
        // auth user so the UI doesn't soft-lock at the auth gate.
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
              setCurrentUser(null);
              setLoading(false);
              return;
            }
            let appUser = await firebaseDataService.getCurrentUser(user.uid);
            for (let i = 0; !appUser && i < 3; i++) {
              await new Promise(r => setTimeout(r, 500));
              try { firebaseDataService.invalidateUserCache?.(user.uid) } catch {}
              appUser = await firebaseDataService.getCurrentUser(user.uid);
            }
            if (!appUser) {
              try {
                const minimal: User = {
                  id: user.uid,
                  name: user.displayName || (user.email?.split('@')[0] ?? 'New user'),
                  username: (user.email?.split('@')[0] || `user_${user.uid.slice(0, 6)}`).toLowerCase(),
                  email: user.email || '',
                  avatar: user.photoURL || '',
                  bio: '',
                  influences: 0,
                  tags: [],
                  location: '',
                  followers: [],
                  following: [],
                  createdAt: new Date().toISOString(),
                };
                await firebaseDataService.createUser(minimal);
                appUser = minimal;
                console.warn('[auth] bootstrapped missing user doc for', user.uid);
              } catch (e) {
                console.error('[auth] failed to bootstrap user doc', e);
              }
            }
            setCurrentUser(appUser);
            setLoading(false);
        });

        // Listen for profile-update events so the cached `currentUser` reflects
        // edits the user made on the EditProfile page without a hard refresh.
        const onUserUpdated = async (e: Event) => {
          const detail = (e as CustomEvent).detail as { userId?: string } | undefined
          if (!detail?.userId) return
          if (auth.currentUser && auth.currentUser.uid === detail.userId) {
            const fresh = await firebaseDataService.getCurrentUser(detail.userId)
            if (fresh) setCurrentUser(fresh)
          }
        }
        window.addEventListener('this-is:userUpdated', onUserUpdated)

        return () => {
          unsubscribe()
          window.removeEventListener('this-is:userUpdated', onUserUpdated)
        }
    }, []);

  const value = {
    currentUser,
    loading,
    signIn,
    signUp,
    logout,
    resetPassword,
    refreshCurrentUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
} 