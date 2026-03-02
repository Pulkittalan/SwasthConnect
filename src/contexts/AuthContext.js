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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const signInInProgress = useRef(false);

  // Check if user is admin
  const checkIfAdmin = async (user) => {
    try {
      // Check in admins collection by UID
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if (adminDoc.exists()) {
        return true;
      }

      // Check by email in admins collection
      const adminByEmail = await getDoc(doc(db, 'admins', user.email));
      if (adminByEmail.exists()) {
        return true;
      }

      // Check in admin_emails collection
      const adminEmailDoc = await getDoc(doc(db, 'admin_emails', user.email));
      if (adminEmailDoc.exists()) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };

  const saveUserToFirestore = async (user) => {
    try {
      // First check if user is admin
      const adminStatus = await checkIfAdmin(user);
      
      if (adminStatus) {
        // This is an admin - save to admins collection
        const adminRef = doc(db, 'admins', user.uid);
        const adminDoc = await getDoc(adminRef);
        
        if (!adminDoc.exists()) {
          await setDoc(adminRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Admin',
            photoURL: user.photoURL || null,
            role: 'admin',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            status: 'active'
          });
        } else {
          await updateDoc(adminRef, {
            lastLogin: new Date().toISOString(),
            photoURL: user.photoURL || adminDoc.data().photoURL
          });
        }
        
        setIsAdmin(true);
        setUserData(null);
        return;
      }

      // Regular user flow
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      const userDataObj = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: new Date().toISOString(),
        role: 'user'
      };

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          ...userDataObj,
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
          lastLogin: new Date().toISOString(),
          photoURL: user.photoURL || userDoc.data().photoURL
        });
      }
      
      const updatedDoc = await getDoc(userRef);
      setUserData(updatedDoc.data());
      setIsAdmin(false);
      
    } catch (error) {
      console.error("Error saving user to Firestore:", error);
    }
  };

  const signInWithGoogle = async () => {
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
      
      provider.addScope('profile');
      provider.addScope('email');
      
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user);
      return result.user;
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    } finally {
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
      setIsAdmin(false);
      
      // Clear all storage
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('adminEmail');
      localStorage.removeItem('adminUid');
      sessionStorage.clear();
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
          const adminStatus = await checkIfAdmin(user);
          
          if (adminStatus) {
            const adminRef = doc(db, 'admins', user.uid);
            const adminDoc = await getDoc(adminRef);
            
            if (adminDoc.exists()) {
              setIsAdmin(true);
              setUserData(null);
              
              await updateDoc(adminRef, {
                lastLogin: new Date().toISOString()
              });
            } else {
              await saveUserToFirestore(user);
            }
          } else {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
              setUserData(userDoc.data());
              setIsAdmin(false);
              
              await updateDoc(userRef, {
                lastLogin: new Date().toISOString()
              });
            } else {
              await saveUserToFirestore(user);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    isAdmin,
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