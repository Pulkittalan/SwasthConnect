  import React, { useState, useEffect } from 'react';
  import { useAuth } from '../../contexts/AuthContext';
  import { db, storage } from '../../firebase/firebase';
  import { collection, query, where, getDocs, doc, updateDoc, getDoc, addDoc, orderBy } from 'firebase/firestore';
  import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
  import { useNavigate } from 'react-router-dom';
  import './UserDashboard.css';
  import SHA256 from "crypto-js/sha256";
  import CryptoJS from "crypto-js";
import { getContract } from "../../blockchain/medicalContract";
  

  const UserDashboard = () => {
    const { currentUser, userData, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [userPreferences, setUserPreferences] = useState(null);
    const [medicalRecords, setMedicalRecords] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [recordType, setRecordType] = useState('prescription');
    const [recordDescription, setRecordDescription] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');
    const [uploadError, setUploadError] = useState('');
    const [hospitals, setHospitals] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [appointmentReason, setAppointmentReason] = useState('');
    const [doctors, setDoctors] = useState([]);
    const [bookingSuccess, setBookingSuccess] = useState('');
    const [bookingError, setBookingError] = useState('');
    
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
      displayName: '',
      phone: '',
      address: '',
      bloodGroup: '',
      emergencyContact: '',
      dateOfBirth: '',
      allergies: '',
      chronicConditions: '',
      medications: ''
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

          // Fetch medical records
          const medicalQuery = query(
            collection(db, 'medicalRecords'),
            where('userId', '==', currentUser.uid),
            orderBy('uploadedAt', 'desc')
          );
          const medicalSnapshot = await getDocs(medicalQuery);
          const medicalData = medicalSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMedicalRecords(medicalData);

          // Fetch appointments
          const appointmentsQuery = query(
            collection(db, 'appointments'),
            where('userId', '==', currentUser.uid),
            orderBy('date', 'desc')
          );
          const appointmentsSnapshot = await getDocs(appointmentsQuery);
          const appointmentsData = appointmentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setAppointments(appointmentsData);

          // Fetch hospitals for appointment booking
          const hospitalsSnapshot = await getDocs(collection(db, 'hospitals'));
          const hospitalsData = hospitalsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setHospitals(hospitalsData);

          // Initialize form data
          if (userData) {
            setFormData({
              displayName: userData.displayName || '',
              phone: userData.phone || '',
              address: userData.address || '',
              bloodGroup: userData.bloodGroup || '',
              emergencyContact: userData.emergencyContact || '',
              dateOfBirth: userData.dateOfBirth || '',
              allergies: userData.allergies || '',
              chronicConditions: userData.chronicConditions || '',
              medications: userData.medications || ''
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

    // Fetch doctors when hospital is selected
    useEffect(() => {
      const fetchDoctors = async () => {
        if (!selectedHospital) return;
        
        try {
          const doctorsRef = collection(db, 'hospitals', selectedHospital, 'doctors');
          const doctorsSnapshot = await getDocs(doctorsRef);
          const doctorsData = doctorsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDoctors(doctorsData);
        } catch (error) {
          console.error("Error fetching doctors:", error);
        }
      };

      fetchDoctors();
    }, [selectedHospital]);

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

    const handleFileSelect = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setUploadError('File size too large. Max 10MB allowed.');
          return;
        }
        setSelectedFile(file);
        setUploadError('');
      }
    };

    const handleUploadRecord = async (e) => {
      e.preventDefault();

      if (!selectedFile) {
        setUploadError("Please select a file to upload");
        return;
      }

      setUploading(true);
      setUploadError("");
      setUploadSuccess("");

      try {

        const recordId = crypto.randomUUID();
        // Generate file hash BEFORE upload
        const fileHash = await generateFileHash(selectedFile);
        console.log("Generated File Hash:", fileHash);

        console.log("patientId:", currentUser.uid);
        console.log("recordId:", recordId);
        console.log("hash:", fileHash);
        console.log("recordType:", recordType);
        console.log("fileName:", selectedFile.name);

        // Upload to Firebase Storage
        const timestamp = Date.now();
        const fileName = `${timestamp}_${selectedFile.name}`;

        const storageRef = ref(
          storage,
          `medicalRecords/${currentUser.uid}/${recordType}/${fileName}`,
        );

        await uploadBytes(storageRef, selectedFile);

        const fileUrl = await getDownloadURL(storageRef);

        console.log("File URL:", fileUrl);

        const blockchainTx = await storeHashOnBlockchain(
          currentUser.uid,
          recordId,
          fileHash,
          recordType,
          selectedFile.name,
        );

        // Save metadata in Firestore
        const recordData = {
          userId: currentUser.uid,
          recordId: recordId,
          type: recordType,
          fileName: selectedFile.name,
          fileUrl: fileUrl,
          description: recordDescription,
          uploadedAt: new Date().toISOString(),
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          blockchainHash: fileHash,
          blockchainTx: blockchainTx,
        };

        const docRef = await addDoc(
          collection(db, "medicalRecords"),
          recordData,
        );

        setMedicalRecords((prev) => [
          {
            id: docRef.id,
            ...recordData,
          },
          ...prev,
        ]);

        setUploadSuccess(
          "Record uploaded securely with blockchain verification!",
        );

        setSelectedFile(null);
        setRecordDescription("");
        document.getElementById("fileInput").value = "";
      } catch (error) {
        console.error("Error uploading record:", error);
        setUploadError("Failed to upload record. Please try again.");
      } finally {
        setUploading(false);
      }
    };

    const handleBookAppointment = async (e) => {
      e.preventDefault();

      if (
        !selectedHospital ||
        !selectedDoctor ||
        !appointmentDate ||
        !appointmentTime
      ) {
        setBookingError("Please fill in all required fields");
        return;
      }

      setBookingError("");
      setBookingSuccess("");

      try {
        const appointmentData = {
          userId: currentUser.uid,
          userName: userData?.displayName || "User",
          userEmail: currentUser.email,
          userPhone: userData?.phone || "",
          hospitalId: selectedHospital,
          hospitalName:
            hospitals.find((h) => h.id === selectedHospital)?.name || "",
          doctorId: selectedDoctor,
          doctorName: doctors.find((d) => d.id === selectedDoctor)?.name || "",
          date: appointmentDate,
          time: appointmentTime,
          reason: appointmentReason,
          status: "scheduled",
          createdAt: new Date().toISOString(),
        };

        const docRef = await addDoc(
          collection(db, "appointments"),
          appointmentData,
        );

        setAppointments((prev) => [
          {
            id: docRef.id,
            ...appointmentData,
          },
          ...prev,
        ]);

        setBookingSuccess("Appointment booked successfully!");

        // Reset form
        setSelectedHospital("");
        setSelectedDoctor("");
        setAppointmentDate("");
        setAppointmentTime("");
        setAppointmentReason("");

        setTimeout(() => setBookingSuccess(""), 3000);
      } catch (error) {
        console.error("Error booking appointment:", error);
        setBookingError("Failed to book appointment. Please try again.");
      }
    };

    const getRecordTypeIcon = (type) => {
      switch(type) {
        case 'prescription': return '📋';
        case 'lab-report': return '🔬';
        case 'scan': return '🖥️';
        case 'xray': return '📸';
        case 'mri': return '🧠';
        default: return '📄';
      }
    };

    const formatFileSize = (bytes) => {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    const storeHashOnBlockchain = async (
      patientId,
      recordId,
      hash,
      recordType,
      fileName,
    ) => {
      try {
        const contract = await getContract();

        if (!contract) return null;

        const tx = await contract.addRecord(
          patientId,
          recordId,
          hash,
          recordType,
          fileName,
          {
            gasLimit: 500000,
          },
        );

        console.log("Calling contract with:", {
          patientId,
          recordId,
          hash,
          recordType,
          fileName,
        });
        console.log("Transaction sent:", tx.hash);

        await tx.wait();

        console.log("Blockchain TX confirmed:", tx.hash);

        return tx.hash;
      } catch (error) {
        console.error("Blockchain error:", error);
        return null;
      }
    };

    const generateFileHash = async (file) => {
      const buffer = await file.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(buffer);
      const hash = SHA256(wordArray).toString();
      return hash;
    };

    if (loading) {
      return (
        <div className="user-dashboard">
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100vh",
            }}
          >
            <div className="loading-spinner"></div>
            <p style={{ marginLeft: "15px" }}>Loading your dashboard...</p>
          </div>
        </div>
      );
    }

    const navItems = [
      { id: 'overview', label: 'Dashboard Overview', icon: '📊' },
      { id: 'profile', label: 'Health Profile', icon: '👤' },
      { id: 'appointments', label: 'Appointment Booking', icon: '📅' },
      { id: 'upload', label: 'Upload Medical Records', icon: '📤' },
      { id: 'records', label: 'View Medical Records', icon: '📁' },
      { id: 'prescriptions', label: 'Prescriptions', icon: '📋' },
      { id: 'lab-reports', label: 'Lab Reports', icon: '🔬' },
      { id: 'scans', label: 'Scans (X-ray, MRI)', icon: '🖥️' },
      { id: 'settings', label: 'Settings', icon: '⚙️' }
    ];

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
          {/* Sidebar Navigation */}
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
              <h3>Main Menu</h3>
              <ul>
                {navItems.map((item) => (
                  <li
                    key={item.id}
                    className={activeTab === item.id ? "active" : ""}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <span style={{ marginRight: '10px' }}>{item.icon}</span>
                    {item.label}
                    {item.id === 'appointments' && appointments.length > 0 && (
                      <span className="nav-badge">{appointments.length}</span>
                    )}
                    {item.id === 'records' && medicalRecords.length > 0 && (
                      <span className="nav-badge">{medicalRecords.length}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="sidebar-section">
              <h3>Quick Stats</h3>
              <div style={{ fontSize: '14px' }}>
                <p>📅 Appointments: {appointments.length}</p>
                <p>📁 Records: {medicalRecords.length}</p>
                <p>🩺 Health Score: {userData?.healthScore || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="dashboard-content">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="tab-content">
                <h2>Dashboard Overview</h2>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">📅</div>
                    <div className="stat-details">
                      <h3>Appointments</h3>
                      <p className="stat-number">{appointments.length}</p>
                      <p className="stat-label">Upcoming: {appointments.filter(a => a.status === 'scheduled').length}</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">📁</div>
                    <div className="stat-details">
                      <h3>Medical Records</h3>
                      <p className="stat-number">{medicalRecords.length}</p>
                      <p className="stat-label">Last uploaded: {medicalRecords[0]?.uploadedAt?.split('T')[0] || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">❤️</div>
                    <div className="stat-details">
                      <h3>Health Status</h3>
                      <p className="stat-number">{userData?.bloodGroup || 'N/A'}</p>
                      <p className="stat-label">Blood Group</p>
                    </div>
                  </div>
                </div>

                <div className="recent-activity">
                  <h3>Recent Activity</h3>
                  {appointments.slice(0, 3).map(apt => (
                    <div key={apt.id} className="activity-item">
                      <span className="activity-icon">📅</span>
                      <div className="activity-details">
                        <p><strong>{apt.doctorName}</strong> at {apt.hospitalName}</p>
                        <p className="activity-time">{apt.date} at {apt.time}</p>
                      </div>
                      <span className={`status-badge status-${apt.status}`}>{apt.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Health Profile Tab */}
            {activeTab === 'profile' && (
              <div className="tab-content">
                <h2>Health Profile</h2>
                {!editMode ? (
                  <div className="profile-view">
                    <div className="profile-header">
                      <img
                        src={currentUser?.photoURL || "/images/default-avatar.png"}
                        alt="Profile"
                        className="profile-avatar"
                      />
                      <div>
                        <h3>{userData?.displayName || 'Not set'}</h3>
                        <p>{userData?.email}</p>
                      </div>
                      <button className="edit-btn" onClick={() => setEditMode(true)}>Edit Profile</button>
                    </div>

                    <div className="profile-details-grid">
                      <div className="detail-item">
                        <label>Phone</label>
                        <p>{userData?.phone || 'Not set'}</p>
                      </div>
                      <div className="detail-item">
                        <label>Date of Birth</label>
                        <p>{userData?.dateOfBirth || 'Not set'}</p>
                      </div>
                      <div className="detail-item">
                        <label>Blood Group</label>
                        <p className="blood-group">{userData?.bloodGroup || 'Not set'}</p>
                      </div>
                      <div className="detail-item">
                        <label>Emergency Contact</label>
                        <p>{userData?.emergencyContact || 'Not set'}</p>
                      </div>
                      <div className="detail-item full-width">
                        <label>Address</label>
                        <p>{userData?.address || 'Not set'}</p>
                      </div>
                      <div className="detail-item full-width">
                        <label>Allergies</label>
                        <p>{userData?.allergies || 'None reported'}</p>
                      </div>
                      <div className="detail-item full-width">
                        <label>Chronic Conditions</label>
                        <p>{userData?.chronicConditions || 'None reported'}</p>
                      </div>
                      <div className="detail-item full-width">
                        <label>Current Medications</label>
                        <p>{userData?.medications || 'None reported'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleProfileUpdate} className="profile-edit-form">
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          type="text"
                          name="displayName"
                          value={formData.displayName}
                          onChange={handleInputChange}
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div className="form-group">
                        <label>Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div className="form-group">
                        <label>Date of Birth</label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          value={formData.dateOfBirth}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label>Blood Group</label>
                        <select name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange}>
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Emergency Contact</label>
                        <input
                          type="tel"
                          name="emergencyContact"
                          value={formData.emergencyContact}
                          onChange={handleInputChange}
                          placeholder="Emergency contact number"
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Address</label>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="Enter your address"
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Allergies</label>
                        <textarea
                          name="allergies"
                          value={formData.allergies}
                          onChange={handleInputChange}
                          placeholder="List any allergies (comma separated)"
                          rows="2"
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Chronic Conditions</label>
                        <textarea
                          name="chronicConditions"
                          value={formData.chronicConditions}
                          onChange={handleInputChange}
                          placeholder="List any chronic conditions"
                          rows="2"
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Current Medications</label>
                        <textarea
                          name="medications"
                          value={formData.medications}
                          onChange={handleInputChange}
                          placeholder="List current medications"
                          rows="2"
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="cancel-btn" onClick={() => setEditMode(false)}>Cancel</button>
                      <button type="submit" className="save-btn">Save Changes</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Appointment Booking Tab */}
            {activeTab === 'appointments' && (
              <div className="tab-content">
                <h2>Book Appointment</h2>
                
                {bookingSuccess && (
                  <div className="success-message">{bookingSuccess}</div>
                )}
                {bookingError && (
                  <div className="error-message">{bookingError}</div>
                )}

                <div className="booking-form">
                  <form onSubmit={handleBookAppointment}>
                    <div className="form-group">
                      <label>Select Hospital *</label>
                      <select 
                        value={selectedHospital} 
                        onChange={(e) => setSelectedHospital(e.target.value)}
                        required
                      >
                        <option value="">Choose a hospital</option>
                        {hospitals.map(hospital => (
                          <option key={hospital.id} value={hospital.id}>
                            {hospital.name} - {hospital.city}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Select Doctor *</label>
                      <select 
                        value={selectedDoctor} 
                        onChange={(e) => setSelectedDoctor(e.target.value)}
                        required
                        disabled={!selectedHospital}
                      >
                        <option value="">Choose a doctor</option>
                        {doctors.map(doctor => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.name} - {doctor.specialization}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Date *</label>
                        <input 
                          type="date" 
                          value={appointmentDate}
                          onChange={(e) => setAppointmentDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Time *</label>
                        <input 
                          type="time" 
                          value={appointmentTime}
                          onChange={(e) => setAppointmentTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Reason for Visit</label>
                      <textarea 
                        value={appointmentReason}
                        onChange={(e) => setAppointmentReason(e.target.value)}
                        placeholder="Briefly describe your symptoms or reason for appointment"
                        rows="3"
                      />
                    </div>

                    <button type="submit" className="book-btn">Book Appointment</button>
                  </form>
                </div>

                <div className="appointments-list">
                  <h3>Your Appointments</h3>
                  {appointments.length > 0 ? (
                    appointments.map(apt => (
                      <div key={apt.id} className="appointment-card">
                        <div className="appointment-header">
                          <span className="appointment-date">{apt.date}</span>
                          <span className="appointment-time">{apt.time}</span>
                          <span className={`status-badge status-${apt.status}`}>{apt.status}</span>
                        </div>
                        <div className="appointment-details">
                          <p><strong>Doctor:</strong> {apt.doctorName}</p>
                          <p><strong>Hospital:</strong> {apt.hospitalName}</p>
                          {apt.reason && <p><strong>Reason:</strong> {apt.reason}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="no-data">No appointments booked yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Upload Medical Records Tab */}
            {activeTab === 'upload' && (
              <div className="tab-content">
                <h2>Upload Medical Records</h2>
                
                {uploadSuccess && (
                  <div className="success-message">{uploadSuccess}</div>
                )}
                {uploadError && (
                  <div className="error-message">{uploadError}</div>
                )}

                <form onSubmit={handleUploadRecord} className="upload-form">
                  <div className="form-group">
                    <label>Record Type *</label>
                    <select value={recordType} onChange={(e) => setRecordType(e.target.value)}>
                      <option value="prescription">Prescription</option>
                      <option value="lab-report">Lab Report</option>
                      <option value="scan">Scan (X-ray, MRI, CT)</option>
                      <option value="xray">X-ray</option>
                      <option value="mri">MRI</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      value={recordDescription}
                      onChange={(e) => setRecordDescription(e.target.value)}
                      placeholder="e.g., Blood Test Report - March 2026"
                    />
                  </div>

                  <div className="form-group">
                    <label>Select File * (Max 10MB)</label>
                    <input
                      id="fileInput"
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      className="file-input"
                    />
                    {selectedFile && (
                      <div className="file-info">
                        Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    className="upload-btn"
                    disabled={uploading || !selectedFile}
                  >
                    {uploading ? 'Uploading...' : 'Upload Record'}
                  </button>
                </form>
              </div>
            )}

            {/* View Medical Records Tab */}
            {activeTab === 'records' && (
              <div className="tab-content">
                <h2>All Medical Records</h2>
                
                {medicalRecords.length > 0 ? (
                  <div className="records-grid">
                    {medicalRecords.map(record => (
                      <div key={record.id} className="record-card">
                        <div className="record-icon">
                          {getRecordTypeIcon(record.type)}
                        </div>
                        <div className="record-details">
                          <h4>{record.type.charAt(0).toUpperCase() + record.type.slice(1).replace('-', ' ')}</h4>
                          <p className="record-description">{record.description || 'No description'}</p>
                          <p className="record-date">Uploaded: {new Date(record.uploadedAt).toLocaleDateString()}</p>
                          <p className="record-size">Size: {formatFileSize(record.fileSize)}</p>
                          <a 
                            href={record.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="view-link"
                          >
                            View Document →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No medical records found.</p>
                    <button 
                      className="upload-btn"
                      onClick={() => setActiveTab('upload')}
                    >
                      Upload Your First Record
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Prescriptions Tab */}
            {activeTab === 'prescriptions' && (
              <div className="tab-content">
                <h2>Prescriptions</h2>
                {medicalRecords.filter(r => r.type === 'prescription').length > 0 ? (
                  <div className="records-grid">
                    {medicalRecords.filter(r => r.type === 'prescription').map(record => (
                      <div key={record.id} className="record-card prescription">
                        <div className="record-icon">📋</div>
                        <div className="record-details">
                          <h4>Prescription</h4>
                          <p className="record-description">{record.description || 'Prescription document'}</p>
                          <p className="record-date">Uploaded: {new Date(record.uploadedAt).toLocaleDateString()}</p>
                          <a 
                            href={record.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="view-link"
                          >
                            View Prescription →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No prescriptions uploaded yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Lab Reports Tab */}
            {activeTab === 'lab-reports' && (
              <div className="tab-content">
                <h2>Lab Reports</h2>
                {medicalRecords.filter(r => r.type === 'lab-report').length > 0 ? (
                  <div className="records-grid">
                    {medicalRecords.filter(r => r.type === 'lab-report').map(record => (
                      <div key={record.id} className="record-card lab-report">
                        <div className="record-icon">🔬</div>
                        <div className="record-details">
                          <h4>Lab Report</h4>
                          <p className="record-description">{record.description || 'Lab report document'}</p>
                          <p className="record-date">Uploaded: {new Date(record.uploadedAt).toLocaleDateString()}</p>
                          <a 
                            href={record.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="view-link"
                          >
                            View Report →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No lab reports uploaded yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Scans Tab */}
            {activeTab === 'scans' && (
              <div className="tab-content">
                <h2>Scans (X-ray, MRI, CT)</h2>
                {medicalRecords.filter(r => ['scan', 'xray', 'mri'].includes(r.type)).length > 0 ? (
                  <div className="records-grid">
                    {medicalRecords.filter(r => ['scan', 'xray', 'mri'].includes(r.type)).map(record => (
                      <div key={record.id} className="record-card scan">
                        <div className="record-icon">
                          {record.type === 'xray' ? '📸' : record.type === 'mri' ? '🧠' : '🖥️'}
                        </div>
                        <div className="record-details">
                          <h4>{record.type === 'xray' ? 'X-ray' : record.type === 'mri' ? 'MRI' : 'Scan'}</h4>
                          <p className="record-description">{record.description || 'Scan document'}</p>
                          <p className="record-date">Uploaded: {new Date(record.uploadedAt).toLocaleDateString()}</p>
                          <a 
                            href={record.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="view-link"
                          >
                            View Scan →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No scans uploaded yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="tab-content">
                <h2>Settings</h2>
                <div className="settings-section">
                  <h3>Notifications</h3>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" /> Email notifications for appointments
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" /> SMS reminders
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" /> Newsletter and health tips
                    </label>
                  </div>
                </div>

                <div className="settings-section">
                  <h3>Privacy</h3>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" /> Make profile public to hospitals
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input type="checkbox" /> Share medical records with doctors
                    </label>
                  </div>
                </div>

                <div className="settings-section">
                  <h3>Account</h3>
                  <button className="danger-btn">Delete Account</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  export default UserDashboard;