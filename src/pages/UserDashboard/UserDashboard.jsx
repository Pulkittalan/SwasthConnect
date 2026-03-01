import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; 

import './UserDashboard.css';

const UserDashboard = () => {
  const { currentUser, userData, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [userPreferences, setUserPreferences] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    address: '',
    bloodGroup: '',
    emergencyContact: '',
    dateOfBirth: ''
  });

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        if (!currentUser) return;
        
        // Fetch user preferences
        const prefRef = doc(db, 'userPreferences', currentUser.uid);
        const prefDoc = await getDoc(prefRef);
        if (prefDoc.exists()) {
          setUserPreferences(prefDoc.data());
        }

        // Fetch medical history
        const medicalQuery = query(
          collection(db, 'medicalRecords'),
          where('userId', '==', currentUser.uid)
        );
        const medicalSnapshot = await getDocs(medicalQuery);
        const medicalData = medicalSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMedicalHistory(medicalData);

        // Fetch appointments
        const appointmentsQuery = query(
          collection(db, 'appointments'),
          where('userId', '==', currentUser.uid)
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const appointmentsData = appointmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAppointments(appointmentsData);

        // Initialize form data
        if (userData) {
          setFormData({
            displayName: userData.displayName || '',
            phone: userData.phone || '',
            address: userData.address || '',
            bloodGroup: userData.bloodGroup || '',
            emergencyContact: userData.emergencyContact || '',
            dateOfBirth: userData.dateOfBirth || ''
          });
        }

      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser && userData) {
      fetchUserData();
    }
  }, [currentUser, userData]);

  const handleLogoClick = () => {
    navigate('/');
    document.body.classList.remove('dashboard-mode');
  };

  const handleLogout = async () => {
    try {
      await logout();
      document.body.classList.remove('dashboard-mode');
      navigate('/');
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        ...formData,
        profileComplete: true,
        updatedAt: new Date().toISOString()
      });
      setEditMode(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error("Error updating profile:", error);
      alert('Failed to update profile');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>Loading your dashboard...</div>
        </div>
      
    );
  }

  return (
    
      <div className="user-dashboard">
        {/* Dashboard Header */}
        <div className="dashboard-header">
          <div className="header-content">
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                onClick={handleLogoClick}
                style={{ cursor: "pointer", position: "relative" }}
                title="Go to Home"
              >
                <img
                  src="/images/logo.png"
                  alt="SwasthyaSetu Logo"
                  className="dashboard-logo"
                  onError={(e) => {
                    e.target.src = '/images/default-logo.png';
                  }}
                  style={{ width: '60px', height: '60px', borderRadius: '8px' }}
                />
              </div>

              <div className="user-info-header">
                <img
                  src={currentUser?.photoURL || "/images/default-avatar.png"}
                  alt="Profile"
                  className="dashboard-avatar"
                  onError={(e) => {
                    e.target.src = '/images/default-avatar.png';
                  }}
                  style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid white' }}
                />
                <div>
                  <h1>Welcome, {userData?.displayName || "User"}!</h1>
                  <p>{userData?.email}</p>
                </div>
              </div>
            </div>

            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>

        <div className="dashboard-container">
          {/* Sidebar */}
          <div className="dashboard-sidebar">
            <div className="sidebar-section" style={{ textAlign: "center", padding: "15px" }}>
              <img
                src="/images/logo.png"
                alt="Logo"
                style={{ width: "80px", height: "80px", borderRadius: "8px", border: "2px solid #4074e6" }}
                onError={(e) => {
                  e.target.src = '/images/default-logo.png';
                }}
              />
              <h3 style={{ color: "#4074e6", margin: 0 }}>SwasthyaSetu</h3>
              <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>Your Health Partner</p>
            </div>

            <div className="sidebar-section">
              <h3>Menu</h3>
              <ul>
                {['overview', 'profile', 'appointments', 'medical', 'settings'].map((tab) => (
                  <li
                    key={tab}
                    className={activeTab === tab ? "active" : ""}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Main Content */}
          <div className="dashboard-content">
            {activeTab === 'overview' && (
              <div className="tab-content">
                <h2>Dashboard Overview</h2>
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
                  <p>Welcome to your dashboard!</p>
                  <p>Appointments: {appointments.length}</p>
                  <p>Medical Records: {medicalHistory.length}</p>
                </div>
              </div>
            )}
            
            {activeTab === 'profile' && (
              <div className="tab-content">
                <h2>My Profile</h2>
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
                  <p><strong>Email:</strong> {userData?.email}</p>
                  <p><strong>Name:</strong> {userData?.displayName || 'Not set'}</p>
                  <p><strong>Phone:</strong> {userData?.phone || 'Not set'}</p>
                </div>
              </div>
            )}
            
            {/* Add other tabs as needed */}
          </div>
        </div>
      </div>
    
  );
};

export default UserDashboard;