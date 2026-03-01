import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase/firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const signInInProgress = useRef(false); // Prevent multiple sign-in attempts

  const saveUserToFirestore = async (user) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: new Date().toISOString(),
        role: 'user'
      };

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          ...userData,
          createdAt: new Date().toISOString(),
          profileComplete: false
        });
        
        await setDoc(doc(db, 'userPreferences', user.uid), {
          notifications: true,
          theme: 'light',
          language: 'en'
        });
      } else {
        await updateDoc(userRef, {
          lastLogin: new Date().toISOString()
        });
      }
      
      const updatedDoc = await getDoc(userRef);
      setUserData(updatedDoc.data());
      
    } catch (error) {
      console.error("Error saving user to Firestore:", error);
    }
  };

  const signInWithGoogle = async () => {
    // Prevent multiple sign-in attempts
    if (signInInProgress.current) {
      console.log("Sign-in already in progress");
      return;
    }

    try {
      signInInProgress.current = true;
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Add scopes to get user profile data
      provider.addScope('profile');
      provider.addScope('email');
      
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user);
      return result.user;
    } catch (error) {
      console.error("Google sign-in error:", error);
      
      // Handle specific errors
      if (error.code === 'auth/cancelled-popup-request') {
        console.log("Sign-in was cancelled by user");
      } else if (error.code === 'auth/popup-blocked') {
        console.log("Popup was blocked by browser");
        // You could fallback to redirect here if needed
        // return signInWithRedirect(auth, provider);
      }
      
      throw error;
    } finally {
      // Reset sign-in flag after 2 seconds to prevent rapid clicks
      setTimeout(() => {
        signInInProgress.current = false;
      }, 2000);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserData(null);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            await saveUserToFirestore(user);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    signInWithGoogle,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}