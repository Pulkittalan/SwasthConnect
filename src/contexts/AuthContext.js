import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../firebase/firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [hospitalData, setHospitalData] = useState(null);
  const [doctorData, setDoctorData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);
  const signInInProgress = useRef(false);

  const checkIfAdmin = async (user) => {
    try {
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if (adminDoc.exists()) return true;

      const adminByEmail = await getDoc(doc(db, 'admins', user.email));
      if (adminByEmail.exists()) return true;

      const adminEmailDoc = await getDoc(doc(db, 'admin_emails', user.email));
      if (adminEmailDoc.exists()) return true;

      return false;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };

  // Hospital Registration
  const hospitalRegister = async (formData) => {
    try {
      let logoUrl = '';
      
      // Upload logo if selected
      if (formData.hospitalLogo) {
        const logoRef = ref(storage, `hospitals/${formData.newHospitalId}/logo`);
        await uploadBytes(logoRef, formData.hospitalLogo);
        logoUrl = await getDownloadURL(logoRef);
      }
      
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.newHospitalEmail,
        formData.newHospitalPassword
      );
      
      const hospitalDataObj = {
        hospital_id: formData.newHospitalId,
        email: formData.newHospitalEmail,
        name: formData.hospitalName,
        type: formData.hospitalType,
        registration_number: formData.hospitalRegNumber,
        gst_number: formData.hospitalGST,
        year_established: formData.hospitalYear,
        logo_url: logoUrl,
        address: formData.hospitalAddress,
        city: formData.hospitalCity,
        state: formData.hospitalState,
        pincode: formData.hospitalPincode,
        map_location: formData.hospitalMapLocation,
        official_email: formData.hospitalEmail,
        phone: formData.hospitalPhone,
        emergency_phone: formData.hospitalEmergencyPhone,
        admin_name: formData.adminName,
        admin_mobile: formData.adminMobile,
        facilities: formData.facilities,
        total_beds: parseInt(formData.totalBeds) || 0,
        icu_beds: parseInt(formData.icuBeds) || 0,
        general_beds: parseInt(formData.generalBeds) || 0,
        private_rooms: parseInt(formData.privateRooms) || 0,
        bank_account: formData.bankAccount,
        upi_id: formData.upiId,
        razorpay_id: formData.razorpayId,
        uid: userCredential.user.uid,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'hospitals', formData.newHospitalId), hospitalDataObj);
      
      return { success: true, hospitalData: hospitalDataObj };
    } catch (error) {
      console.error('Hospital registration error:', error);
      throw error;
    }
  };

  // Doctor Registration
  const doctorRegister = async (formData) => {
    try {
      let photoUrl = '';
      
      // Upload photo if selected
      if (formData.doctorPhoto) {
        const photoRef = ref(storage, `doctors/${formData.newDoctorId}/photo`);
        await uploadBytes(photoRef, formData.doctorPhoto);
        photoUrl = await getDownloadURL(photoRef);
      }
      
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.newDoctorEmail,
        formData.newDoctorPassword
      );
      
      const doctorDataObj = {
        doctor_id: formData.newDoctorId,
        email: formData.newDoctorEmail,
        name: formData.doctorName,
        gender: formData.doctorGender,
        dob: formData.doctorDob,
        registration_no: formData.doctorRegistrationNo,
        specialization: formData.doctorSpecialization,
        qualification: formData.doctorQualification,
        experience: formData.doctorExperience,
        department: formData.doctorDepartment,
        opd_days: formData.doctorOPDDays,
        opd_time: formData.doctorOPDTime,
        consultation_fee: formData.doctorConsultationFee,
        online_fee: formData.doctorOnlineFee,
        phone: formData.doctorPhone,
        photo_url: photoUrl,
        uid: userCredential.user.uid,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'doctors', formData.newDoctorId), doctorDataObj);
      
      return { success: true, doctorData: doctorDataObj };
    } catch (error) {
      console.error('Doctor registration error:', error);
      throw error;
    }
  };

  const hospitalLogin = async (hospitalId, password) => {
    try {
      const hospitalRef = doc(db, 'hospitals', hospitalId);
      const hospitalSnap = await getDoc(hospitalRef);
      
      if (!hospitalSnap.exists()) {
        throw new Error('Hospital not found');
      }

      const hospitalDataFromDb = hospitalSnap.data();
      
      if (hospitalDataFromDb.status !== 'approved') {
        throw new Error('Hospital account pending verification');
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        hospitalDataFromDb.email,
        password
      );

      setCurrentUser(userCredential.user);
      setHospitalData(hospitalDataFromDb);
      setUserType('hospital');
      
      localStorage.setItem('userType', 'hospital');
      localStorage.setItem('hospitalId', hospitalId);
      localStorage.setItem('hospitalName', hospitalDataFromDb.name);
      localStorage.setItem('hospitalLogo', hospitalDataFromDb.logo_url || '/images/default-avatar.png');
      
      await updateDoc(hospitalRef, {
        lastLogin: new Date().toISOString()
      });

      return { success: true, hospitalData: hospitalDataFromDb };
    } catch (error) {
      console.error('Hospital login error:', error);
      throw error;
    }
  };

  const doctorLogin = async (doctorId, password) => {
    try {
      const doctorRef = doc(db, 'doctors', doctorId);
      const doctorSnap = await getDoc(doctorRef);
      
      if (!doctorSnap.exists()) {
        throw new Error('Doctor not found');
      }

      const doctorDataFromDb = doctorSnap.data();
      
      if (doctorDataFromDb.status !== 'approved') {
        throw new Error('Doctor account pending verification');
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        doctorDataFromDb.email,
        password
      );

      setCurrentUser(userCredential.user);
      setDoctorData(doctorDataFromDb);
      setUserType('doctor');
      
      localStorage.setItem('userType', 'doctor');
      localStorage.setItem('doctorId', doctorId);
      localStorage.setItem('doctorName', doctorDataFromDb.name);
      localStorage.setItem('doctorPhoto', doctorDataFromDb.photo_url || '/images/default-avatar.png');
      
      await updateDoc(doctorRef, {
        lastLogin: new Date().toISOString()
      });

      return { success: true, doctorData: doctorDataFromDb };
    } catch (error) {
      console.error('Doctor login error:', error);
      throw error;
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
      
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user);
      
      setUserType('user');
      localStorage.setItem('userType', 'user');
      
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

  const saveUserToFirestore = async (user) => {
    try {
      const adminStatus = await checkIfAdmin(user);
      
      if (adminStatus) {
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
        setUserType('admin');
        return;
      }

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
      setUserType('user');
      
    } catch (error) {
      console.error("Error saving user to Firestore:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      
      setCurrentUser(null);
      setUserData(null);
      setHospitalData(null);
      setDoctorData(null);
      setIsAdmin(false);
      setUserType(null);
      
      localStorage.removeItem('userType');
      localStorage.removeItem('hospitalId');
      localStorage.removeItem('hospitalName');
      localStorage.removeItem('hospitalLogo');
      localStorage.removeItem('doctorId');
      localStorage.removeItem('doctorName');
      localStorage.removeItem('doctorPhoto');
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
    const checkExistingSession = async (user) => {
      if (user) {
        try {
          // First check if this is an admin
          const adminStatus = await checkIfAdmin(user);
          if (adminStatus) {
            setIsAdmin(true);
            setUserType('admin');
            setLoading(false);
            return;
          }

          // Check for hospital session from localStorage
          const storedHospitalId = localStorage.getItem('hospitalId');
          const storedUserType = localStorage.getItem('userType');
          
          if (storedHospitalId && storedUserType === 'hospital') {
            const hospitalRef = doc(db, 'hospitals', storedHospitalId);
            const hospitalSnap = await getDoc(hospitalRef);
            
            if (hospitalSnap.exists() && hospitalSnap.data().email === user.email) {
              const hospitalDataFromDb = hospitalSnap.data();
              setHospitalData(hospitalDataFromDb);
              setUserType('hospital');
              
              // Store logo in localStorage if not already there
              if (hospitalDataFromDb.logo_url) {
                localStorage.setItem('hospitalLogo', hospitalDataFromDb.logo_url);
              }
              
              // Update last login
              await updateDoc(hospitalRef, {
                lastLogin: new Date().toISOString()
              });
              
              setLoading(false);
              return;
            } else {
              // Invalid hospital session, clear it
              localStorage.removeItem('hospitalId');
              localStorage.removeItem('hospitalName');
              localStorage.removeItem('hospitalLogo');
              localStorage.removeItem('userType');
            }
          }

          // Check for doctor session from localStorage
          const storedDoctorId = localStorage.getItem('doctorId');
          if (storedDoctorId && storedUserType === 'doctor') {
            const doctorRef = doc(db, 'doctors', storedDoctorId);
            const doctorSnap = await getDoc(doctorRef);
            
            if (doctorSnap.exists() && doctorSnap.data().email === user.email) {
              const doctorDataFromDb = doctorSnap.data();
              setDoctorData(doctorDataFromDb);
              setUserType('doctor');
              
              // Store photo in localStorage if not already there
              if (doctorDataFromDb.photo_url) {
                localStorage.setItem('doctorPhoto', doctorDataFromDb.photo_url);
              }
              
              // Update last login
              await updateDoc(doctorRef, {
                lastLogin: new Date().toISOString()
              });
              
              setLoading(false);
              return;
            } else {
              // Invalid doctor session, clear it
              localStorage.removeItem('doctorId');
              localStorage.removeItem('doctorName');
              localStorage.removeItem('doctorPhoto');
              localStorage.removeItem('userType');
            }
          }

          // If no specific role found, check regular users
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setUserData(userSnap.data());
            setUserType('user');
            localStorage.setItem('userType', 'user');
          }
          
        } catch (error) {
          console.error("Error checking session:", error);
        }
      }
      setLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        await checkExistingSession(user);
      } else {
        // Clear all states when user signs out
        setUserData(null);
        setHospitalData(null);
        setDoctorData(null);
        setIsAdmin(false);
        setUserType(null);
        
        // Clear all localStorage items
        localStorage.removeItem('userType');
        localStorage.removeItem('hospitalId');
        localStorage.removeItem('hospitalName');
        localStorage.removeItem('hospitalLogo');
        localStorage.removeItem('doctorId');
        localStorage.removeItem('doctorName');
        localStorage.removeItem('doctorPhoto');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminEmail');
        localStorage.removeItem('adminUid');
        
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    hospitalData,
    doctorData,
    isAdmin,
    userType,
    signInWithGoogle,
    hospitalLogin,
    doctorLogin,
    hospitalRegister,
    doctorRegister,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}