import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase/firebase';
import { 
  doc, getDoc, collection, query, where, getDocs, 
  updateDoc, addDoc, deleteDoc, setDoc, Timestamp 
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import bcrypt from 'bcryptjs';
import './HospitalDoctorDashboard.css';

const HospitalDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [hospitalData, setHospitalData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [showEditDoctorModal, setShowEditDoctorModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [activeTab, setActiveTab] = useState('doctors');
  const [stats, setStats] = useState({
    totalDoctors: 0,
    activeDoctors: 0,
    totalAppointments: 0,
    totalPatients: 0,
    totalRevenue: 0
  });
  const [newDoctor, setNewDoctor] = useState({
    doctorId: '',
    name: '',
    email: '',
    phone: '',
    gender: '',
    dob: '',
    specialization: '',
    department: '',
    qualification: 'MBBS',
    registration_no: '',
    experience_years: '',
    consultation_fee: '',
    online_fee: '',
    opd_days: ['Monday', 'Wednesday', 'Friday'],
    opd_time: '09:00-17:00',
    bio: '',
    photo_url: '',
    password: '',
    confirmPassword: ''
  });

  const daysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const specializationOptions = [
    "Cardiology", "Neurology", "Orthopedics", "Pediatrics", "General Surgery",
    "Gynecology", "ENT", "Dermatology", "Psychiatry", "Radiology",
    "Anesthesiology", "Ophthalmology", "Urology", "Nephrology", "Oncology"
  ];
  const qualificationOptions = ["MBBS", "MD", "MS", "DNB", "MCh", "DM", "BDS", "MDS"];

  // Fetch hospital data
  useEffect(() => {
    const fetchHospitalData = async () => {
      if (!currentUser) return;
      
      try {
        const hospitalId = localStorage.getItem('hospitalId');
        if (!hospitalId) {
          navigate('/login');
          return;
        }

        const hospitalRef = doc(db, 'hospitals', hospitalId);
        const hospitalSnap = await getDoc(hospitalRef);
        
        if (hospitalSnap.exists()) {
          setHospitalData(hospitalSnap.data());
          await fetchDoctors(hospitalId);
          await fetchStats(hospitalId);
        }
      } catch (error) {
        console.error('Error fetching hospital data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHospitalData();
  }, [currentUser, navigate]);

  // Fetch doctors for this hospital
  const fetchDoctors = async (hospitalId) => {
    try {
      const doctorsRef = collection(db, 'doctors');
      const q = query(
        doctorsRef, 
        where('hospitalId', '==', hospitalId),
        where('doctorType', '==', 'hospital')
      );
      const querySnapshot = await getDocs(q);
      const doctorsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDoctors(doctorsList);
      return doctorsList;
    } catch (error) {
      console.error('Error fetching doctors:', error);
      return [];
    }
  };

  // Fetch hospital stats
  const fetchStats = async (hospitalId) => {
    try {
      const doctorsList = await fetchDoctors(hospitalId);
      const totalDoctors = doctorsList.length;
      const activeDoctors = doctorsList.filter(d => d.isActive === true).length;
      
      // Fetch appointments for all doctors
      let totalAppointments = 0;
      let totalPatients = new Set();
      let totalRevenue = 0;
      
      for (const doctor of doctorsList) {
        const appointmentsRef = collection(db, 'appointments');
        const q = query(appointmentsRef, where('doctorId', '==', doctor.doctorId));
        const snapshot = await getDocs(q);
        const appointments = snapshot.docs.map(doc => doc.data());
        totalAppointments += appointments.length;
        appointments.forEach(apt => {
          if (apt.patientId) totalPatients.add(apt.patientId);
          if (apt.status === 'completed') {
            totalRevenue += (doctor.consultation_fee || 0);
          }
        });
      }
      
      setStats({
        totalDoctors,
        activeDoctors,
        totalAppointments,
        totalPatients: totalPatients.size,
        totalRevenue
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Generate a unique doctor ID
  const generateDoctorId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DOC${timestamp}${random}`;
  };

  // Hash password
  const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  };

  // Add new doctor
  const handleAddDoctor = async (e) => {
    e.preventDefault();
    
    if (newDoctor.password !== newDoctor.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    
    if (newDoctor.password.length < 6) {
      alert('Password must be at least 6 characters long!');
      return;
    }

    setLoading(true);
    
    try {
      const doctorId = newDoctor.doctorId || generateDoctorId();
      
      const doctorRef = doc(db, 'doctors', doctorId);
      const doctorSnap = await getDoc(doctorRef);
      
      if (doctorSnap.exists()) {
        alert('Doctor ID already exists! Please use a different ID.');
        setLoading(false);
        return;
      }

      const hashedPassword = await hashPassword(newDoctor.password);
      
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newDoctor.email,
        newDoctor.password
      );
      
      const doctorData = {
        doctorId: doctorId,
        uid: userCredential.user.uid,
        name: newDoctor.name,
        email: newDoctor.email,
        phone: newDoctor.phone,
        gender: newDoctor.gender,
        dob: newDoctor.dob,
        specialization: newDoctor.specialization,
        qualification: newDoctor.qualification,
        registration_no: newDoctor.registration_no,
        experience_years: parseInt(newDoctor.experience_years) || 0,
        department: newDoctor.department,
        hospitalId: hospitalData.hospital_id,
        hospitalName: hospitalData.name,
        doctorType: "hospital",
        consultation_fee: parseInt(newDoctor.consultation_fee) || 0,
        online_fee: parseInt(newDoctor.online_fee) || 0,
        opd_days: newDoctor.opd_days,
        opd_time: newDoctor.opd_time,
        bio: newDoctor.bio || "",
        photo_url: newDoctor.photo_url || "",
        status: "approved",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser?.email || hospitalData.email,
        lastLogin: null,
        passwordHash: hashedPassword,
        passwordLastChanged: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'doctors', doctorId), doctorData);
      
      alert(`✅ Doctor ${newDoctor.name} added successfully!\n\nDoctor ID: ${doctorId}\nPassword: ${newDoctor.password}\n\nPlease save these credentials and share with the doctor.`);
      
      resetDoctorForm();
      setShowAddDoctorModal(false);
      await fetchDoctors(hospitalData.hospital_id);
      await fetchStats(hospitalData.hospital_id);
      
    } catch (error) {
      console.error('Error adding doctor:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Update existing doctor
  const handleUpdateDoctor = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const updateData = {
        name: selectedDoctor.name,
        email: selectedDoctor.email,
        phone: selectedDoctor.phone,
        specialization: selectedDoctor.specialization,
        department: selectedDoctor.department,
        qualification: selectedDoctor.qualification,
        registration_no: selectedDoctor.registration_no,
        experience_years: parseInt(selectedDoctor.experience_years) || 0,
        consultation_fee: parseInt(selectedDoctor.consultation_fee) || 0,
        online_fee: parseInt(selectedDoctor.online_fee) || 0,
        opd_days: selectedDoctor.opd_days,
        opd_time: selectedDoctor.opd_time,
        bio: selectedDoctor.bio || "",
        updatedAt: new Date().toISOString()
      };
      
      if (selectedDoctor.newPassword) {
        if (selectedDoctor.newPassword !== selectedDoctor.confirmNewPassword) {
          alert('New passwords do not match!');
          setLoading(false);
          return;
        }
        
        if (selectedDoctor.newPassword.length < 6) {
          alert('Password must be at least 6 characters long!');
          setLoading(false);
          return;
        }
        
        const hashedPassword = await hashPassword(selectedDoctor.newPassword);
        updateData.passwordHash = hashedPassword;
        updateData.passwordLastChanged = new Date().toISOString();
      }
      
      const doctorRef = doc(db, 'doctors', selectedDoctor.doctorId);
      await updateDoc(doctorRef, updateData);
      
      alert(`✅ Doctor ${selectedDoctor.name} updated successfully!`);
      setShowEditDoctorModal(false);
      setSelectedDoctor(null);
      await fetchDoctors(hospitalData.hospital_id);
      
    } catch (error) {
      console.error('Error updating doctor:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete doctor
  const handleDeleteDoctor = async (doctor) => {
    if (!window.confirm(`Are you sure you want to delete Dr. ${doctor.name}? This action cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'doctors', doctor.doctorId));
      alert(`✅ Doctor ${doctor.name} deleted successfully!`);
      await fetchDoctors(hospitalData.hospital_id);
      await fetchStats(hospitalData.hospital_id);
    } catch (error) {
      console.error('Error deleting doctor:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset doctor form
  const resetDoctorForm = () => {
    setNewDoctor({
      doctorId: generateDoctorId(),
      name: '',
      email: '',
      phone: '',
      gender: '',
      dob: '',
      specialization: '',
      department: '',
      qualification: 'MBBS',
      registration_no: '',
      experience_years: '',
      consultation_fee: '',
      online_fee: '',
      opd_days: ['Monday', 'Wednesday', 'Friday'],
      opd_time: '09:00-17:00',
      bio: '',
      photo_url: '',
      password: '',
      confirmPassword: ''
    });
  };

  // Toggle OPD days
  const toggleOpdDay = (day, isEditing = false) => {
    if (isEditing && selectedDoctor) {
      const updatedDays = selectedDoctor.opd_days.includes(day)
        ? selectedDoctor.opd_days.filter(d => d !== day)
        : [...selectedDoctor.opd_days, day];
      setSelectedDoctor({ ...selectedDoctor, opd_days: updatedDays });
    } else if (!isEditing) {
      const updatedDays = newDoctor.opd_days.includes(day)
        ? newDoctor.opd_days.filter(d => d !== day)
        : [...newDoctor.opd_days, day];
      setNewDoctor({ ...newDoctor, opd_days: updatedDays });
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userType');
      localStorage.removeItem('hospitalId');
      localStorage.removeItem('hospitalName');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading && !hospitalData) {
    return (
      <div className="hospital-doctor-dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hospital-doctor-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>🏥 {hospitalData?.name}</h1>
          <div className="hospital-info">
            <span>📧 {hospitalData?.email}</span>
            <span>📞 {hospitalData?.phone}</span>
          </div>
        </div>
        <div className="header-right">
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      {/* Dashboard Container */}
      <div className="dashboard-container">
        {/* Sidebar */}
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            <button 
              className={`nav-btn ${activeTab === 'doctors' ? 'active' : ''}`} 
              onClick={() => setActiveTab('doctors')}
            >
              👨‍⚕️ Doctors ({stats.totalDoctors})
            </button>
            <button 
              className={`nav-btn ${activeTab === 'stats' ? 'active' : ''}`} 
              onClick={() => setActiveTab('stats')}
            >
              📊 Statistics
            </button>
            <button 
              className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`} 
              onClick={() => setActiveTab('profile')}
            >
              🏥 Hospital Profile
            </button>
          </nav>
          
          <div className="quick-stats">
            <h4>Quick Stats</h4>
            <div className="stat-item">
              <span className="stat-label">Total Doctors:</span>
              <span className="stat-value">{stats.totalDoctors}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Active Doctors:</span>
              <span className="stat-value">{stats.activeDoctors}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Appointments:</span>
              <span className="stat-value">{stats.totalAppointments}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Patients:</span>
              <span className="stat-value">{stats.totalPatients}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Revenue:</span>
              <span className="stat-value">₹{stats.totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
          {/* Doctors Tab */}
          {activeTab === 'doctors' && (
            <div className="tab-content">
              <div className="content-header">
                <h2>👨‍⚕️ Hospital Doctors</h2>
                <button 
                  className="add-doctor-btn"
                  onClick={() => {
                    resetDoctorForm();
                    setShowAddDoctorModal(true);
                  }}
                >
                  + Add New Doctor
                </button>
              </div>

              {/* Doctors Grid */}
              <div className="doctors-grid">
                {doctors.map(doctor => (
                  <div key={doctor.doctorId} className="doctor-card">
                    <div className="doctor-card-header">
                      <img 
                        src={doctor.photo_url || "https://cdn-icons-png.flaticon.com/512/3304/3304567.png"} 
                        alt={doctor.name}
                        className="doctor-avatar"
                        onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/512/3304/3304567.png"; }}
                      />
                      <div className="doctor-basic-info">
                        <h3>Dr. {doctor.name}</h3>
                        <p className="doctor-id">ID: {doctor.doctorId}</p>
                        <p className="doctor-specialty">{doctor.specialization}</p>
                      </div>
                    </div>
                    
                    <div className="doctor-details">
                      <p><strong>📧 Email:</strong> {doctor.email}</p>
                      <p><strong>📞 Phone:</strong> {doctor.phone}</p>
                      <p><strong>🏥 Department:</strong> {doctor.department}</p>
                      <p><strong>📅 Experience:</strong> {doctor.experience_years} years</p>
                      <p><strong>💰 Fees:</strong> ₹{doctor.consultation_fee} / ₹{doctor.online_fee}</p>
                      <p><strong>📋 OPD:</strong> {doctor.opd_days?.join(', ')} ({doctor.opd_time})</p>
                      <p><strong>✅ Status:</strong> <span className="status-badge approved">Approved</span></p>
                    </div>
                    
                    <div className="doctor-actions">
                      <button 
                        className="edit-btn"
                        onClick={() => {
                          setSelectedDoctor({ ...doctor, newPassword: '', confirmNewPassword: '' });
                          setShowEditDoctorModal(true);
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteDoctor(doctor)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {doctors.length === 0 && (
                <div className="no-doctors">
                  <p>No doctors added yet. Click "Add New Doctor" to get started.</p>
                </div>
              )}
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <div className="tab-content">
              <h2>📊 Hospital Statistics</h2>
              <div className="doctors-grid">
                <div className="doctor-card">
                  <div className="doctor-card-header" style={{ background: 'linear-gradient(135deg, #11998e, #38ef7d)' }}>
                    <h3 style={{ margin: 0 }}>👨‍⚕️ Doctors</h3>
                  </div>
                  <div className="doctor-details">
                    <p><strong>Total Doctors:</strong> {stats.totalDoctors}</p>
                    <p><strong>Active Doctors:</strong> {stats.activeDoctors}</p>
                    <p><strong>Departments:</strong> {new Set(doctors.map(d => d.department)).size}</p>
                    <p><strong>Specializations:</strong> {new Set(doctors.map(d => d.specialization)).size}</p>
                  </div>
                </div>
                
                <div className="doctor-card">
                  <div className="doctor-card-header" style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)' }}>
                    <h3 style={{ margin: 0 }}>📅 Appointments</h3>
                  </div>
                  <div className="doctor-details">
                    <p><strong>Total Appointments:</strong> {stats.totalAppointments}</p>
                    <p><strong>Total Patients:</strong> {stats.totalPatients}</p>
                    <p><strong>Avg per Doctor:</strong> {(stats.totalAppointments / stats.totalDoctors || 0).toFixed(1)}</p>
                  </div>
                </div>
                
                <div className="doctor-card">
                  <div className="doctor-card-header" style={{ background: 'linear-gradient(135deg, #fa709a, #fee140)' }}>
                    <h3 style={{ margin: 0 }}>💰 Revenue</h3>
                  </div>
                  <div className="doctor-details">
                    <p><strong>Total Revenue:</strong> ₹{stats.totalRevenue.toLocaleString()}</p>
                    <p><strong>Avg per Doctor:</strong> ₹{(stats.totalRevenue / stats.totalDoctors || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="tab-content">
              <h2>🏥 Hospital Profile</h2>
              <div className="doctors-grid">
                <div className="doctor-card">
                  <div className="doctor-card-header">
                    <div className="doctor-basic-info">
                      <h3>{hospitalData?.name}</h3>
                      <p className="doctor-id">ID: {hospitalData?.hospital_id}</p>
                    </div>
                  </div>
                  <div className="doctor-details">
                    <p><strong>📧 Email:</strong> {hospitalData?.email}</p>
                    <p><strong>📞 Phone:</strong> {hospitalData?.phone}</p>
                    <p><strong>📍 Address:</strong> {hospitalData?.address}</p>
                    <p><strong>🏙️ City:</strong> {hospitalData?.city}</p>
                    <p><strong>📮 Pincode:</strong> {hospitalData?.pincode}</p>
                    <p><strong>📅 Established:</strong> {hospitalData?.establishedYear || 'N/A'}</p>
                    <p><strong>⭐ Rating:</strong> {hospitalData?.rating || 'N/A'}</p>
                    <p><strong>📝 Description:</strong> {hospitalData?.description || 'No description available'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Doctor Modal */}
      {showAddDoctorModal && (
        <div className="modal-overlay" onClick={() => setShowAddDoctorModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add New Doctor</h2>
              <button className="close-btn" onClick={() => setShowAddDoctorModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleAddDoctor} className="doctor-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Doctor ID *</label>
                  <input
                    type="text"
                    value={newDoctor.doctorId}
                    onChange={(e) => setNewDoctor({...newDoctor, doctorId: e.target.value})}
                    placeholder="Auto-generated or enter manually"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={newDoctor.name}
                    onChange={(e) => setNewDoctor({...newDoctor, name: e.target.value})}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={newDoctor.email}
                    onChange={(e) => setNewDoctor({...newDoctor, email: e.target.value})}
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="tel"
                    value={newDoctor.phone}
                    onChange={(e) => setNewDoctor({...newDoctor, phone: e.target.value})}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    value={newDoctor.gender}
                    onChange={(e) => setNewDoctor({...newDoctor, gender: e.target.value})}
                    className="form-input"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={newDoctor.dob}
                    onChange={(e) => setNewDoctor({...newDoctor, dob: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Specialization *</label>
                  <select
                    value={newDoctor.specialization}
                    onChange={(e) => setNewDoctor({...newDoctor, specialization: e.target.value})}
                    required
                    className="form-input"
                  >
                    <option value="">Select Specialization</option>
                    {specializationOptions.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <input
                    type="text"
                    value={newDoctor.department}
                    onChange={(e) => setNewDoctor({...newDoctor, department: e.target.value})}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Qualification</label>
                  <select
                    value={newDoctor.qualification}
                    onChange={(e) => setNewDoctor({...newDoctor, qualification: e.target.value})}
                    className="form-input"
                  >
                    {qualificationOptions.map(qual => (
                      <option key={qual} value={qual}>{qual}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Registration Number</label>
                  <input
                    type="text"
                    value={newDoctor.registration_no}
                    onChange={(e) => setNewDoctor({...newDoctor, registration_no: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Experience (Years)</label>
                  <input
                    type="number"
                    value={newDoctor.experience_years}
                    onChange={(e) => setNewDoctor({...newDoctor, experience_years: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Consultation Fee (₹)</label>
                  <input
                    type="number"
                    value={newDoctor.consultation_fee}
                    onChange={(e) => setNewDoctor({...newDoctor, consultation_fee: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Online Fee (₹)</label>
                  <input
                    type="number"
                    value={newDoctor.online_fee}
                    onChange={(e) => setNewDoctor({...newDoctor, online_fee: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>OPD Time</label>
                  <input
                    type="text"
                    value={newDoctor.opd_time}
                    onChange={(e) => setNewDoctor({...newDoctor, opd_time: e.target.value})}
                    placeholder="e.g., 09:00-17:00"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>OPD Days</label>
                <div className="days-checkbox-group">
                  {daysList.map(day => (
                    <label key={day} className="day-checkbox">
                      <input
                        type="checkbox"
                        checked={newDoctor.opd_days.includes(day)}
                        onChange={() => toggleOpdDay(day, false)}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Bio / About</label>
                <textarea
                  value={newDoctor.bio}
                  onChange={(e) => setNewDoctor({...newDoctor, bio: e.target.value})}
                  rows="3"
                  className="form-textarea"
                  placeholder="Brief description about the doctor..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={newDoctor.password}
                    onChange={(e) => setNewDoctor({...newDoctor, password: e.target.value})}
                    required
                    className="form-input"
                  />
                  <small>Minimum 6 characters</small>
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input
                    type="password"
                    value={newDoctor.confirmPassword}
                    onChange={(e) => setNewDoctor({...newDoctor, confirmPassword: e.target.value})}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowAddDoctorModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? 'Adding...' : '➕ Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Doctor Modal */}
      {showEditDoctorModal && selectedDoctor && (
        <div className="modal-overlay" onClick={() => setShowEditDoctorModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Edit Doctor</h2>
              <button className="close-btn" onClick={() => setShowEditDoctorModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleUpdateDoctor} className="doctor-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Doctor ID</label>
                  <input type="text" value={selectedDoctor.doctorId} disabled className="form-input" />
                </div>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={selectedDoctor.name}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, name: e.target.value})}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={selectedDoctor.email}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, email: e.target.value})}
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="tel"
                    value={selectedDoctor.phone}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, phone: e.target.value})}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Specialization *</label>
                  <select
                    value={selectedDoctor.specialization}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, specialization: e.target.value})}
                    required
                    className="form-input"
                  >
                    <option value="">Select Specialization</option>
                    {specializationOptions.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <input
                    type="text"
                    value={selectedDoctor.department}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, department: e.target.value})}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Experience (Years)</label>
                  <input
                    type="number"
                    value={selectedDoctor.experience_years}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, experience_years: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Consultation Fee (₹)</label>
                  <input
                    type="number"
                    value={selectedDoctor.consultation_fee}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, consultation_fee: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Online Fee (₹)</label>
                  <input
                    type="number"
                    value={selectedDoctor.online_fee}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, online_fee: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>OPD Time</label>
                  <input
                    type="text"
                    value={selectedDoctor.opd_time}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, opd_time: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>OPD Days</label>
                <div className="days-checkbox-group">
                  {daysList.map(day => (
                    <label key={day} className="day-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedDoctor.opd_days?.includes(day)}
                        onChange={() => toggleOpdDay(day, true)}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Bio / About</label>
                <textarea
                  value={selectedDoctor.bio}
                  onChange={(e) => setSelectedDoctor({...selectedDoctor, bio: e.target.value})}
                  rows="3"
                  className="form-textarea"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>New Password (optional)</label>
                  <input
                    type="password"
                    value={selectedDoctor.newPassword || ''}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, newPassword: e.target.value})}
                    className="form-input"
                  />
                  <small>Leave blank to keep current password</small>
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={selectedDoctor.confirmNewPassword || ''}
                    onChange={(e) => setSelectedDoctor({...selectedDoctor, confirmNewPassword: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowEditDoctorModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? 'Updating...' : '💾 Update Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalDashboard;