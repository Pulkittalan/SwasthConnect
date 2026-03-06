import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import './HospitalDashboard.css';

const HospitalDashboard = () => {
  const { hospitalId } = useParams();
  const navigate = useNavigate();
  const [hospitalData, setHospitalData] = useState(null);
  const [bedData, setBedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');
  const [logoError, setLogoError] = useState(false);
  const [floatingLogoError, setFloatingLogoError] = useState(false);
  const [loadingLogoError, setLoadingLogoError] = useState(false);
  
  // State for different sections
  const [activeSection, setActiveSection] = useState('dashboard');
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingSection, setLoadingSection] = useState(false);
  
  // Form states
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  
  // New patient form data
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    gender: '',
    contact: '',
    address: '',
    bloodGroup: '',
    emergencyContact: '',
    medicalHistory: '',
    admissionDate: new Date().toISOString().split('T')[0],
    status: 'admitted',
    bedType: '',
    doctorAssigned: '',
    doctorId: '',
    patientId: '',
  });

  // New doctor form data
  const [newDoctor, setNewDoctor] = useState({
    name: '',
    specialization: '',
    qualification: '',
    experience: '',
    contact: '',
    email: '',
    availability: 'available',
    consultationFee: '',
    department: '',
    joiningDate: new Date().toISOString().split('T')[0],
    address: '',
    doctorId: '',
  });

  // New appointment form data
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientId: '',
    doctorName: '',
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    type: 'consultation',
    status: 'scheduled',
    notes: ''
  });

  // Logo URLs - Change these to your actual logo paths
  const logoUrl = './logo.png'; // Place logo.png in public folder
  const fallbackLogoText = 'SS'; // Swasthya Setu initials

  useEffect(() => {
    const fetchHospitalData = async () => {
      try {
        const docRef = doc(db, 'hospitals', hospitalId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setHospitalData(data);
          setBedData(data.bedData || {});
          
          // Fetch additional data based on hospital ID
          await fetchPatients(hospitalId);
          await fetchDoctors(hospitalId);
          await fetchAppointments(hospitalId);
        } else {
          console.error('Hospital not found');
          setFormError('Hospital not found');
        }
      } catch (error) {
        console.error('Error fetching hospital data:', error);
        setFormError('Error loading hospital data');
      } finally {
        setLoading(false);
      }
    };

    if (hospitalId) {
      fetchHospitalData();
    }
  }, [hospitalId]);

  const fetchPatients = async (hospitalId) => {
    try {
      const patientsRef = collection(db, 'hospitals', hospitalId, 'patients');
      const patientsSnap = await getDocs(patientsRef);
      const patientsList = patientsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPatients(patientsList);
    } catch (error) {
      console.error('Error fetching patients:', error);
      // For demo, set mock data if Firebase fails
      setPatients(getMockPatients());
    }
  };

  const fetchDoctors = async (hospitalId) => {
    try {
      const doctorsRef = collection(db, 'hospitals', hospitalId, 'doctors');
      const doctorsSnap = await getDocs(doctorsRef);
      const doctorsList = doctorsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDoctors(doctorsList);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      // For demo, set mock data if Firebase fails
      setDoctors(getMockDoctors());
    }
  };

  const fetchAppointments = async (hospitalId) => {
    try {
      const appointmentsRef = collection(db, 'hospitals', hospitalId, 'appointments');
      const appointmentsSnap = await getDocs(appointmentsRef);
      const appointmentsList = appointmentsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAppointments(appointmentsList);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      // For demo, set mock data if Firebase fails
      setAppointments(getMockAppointments());
    }
  };

  // Mock data functions
  const getMockPatients = () => [
    {
      id: 'P001',
      name: 'Rahul Sharma',
      age: 45,
      gender: 'Male',
      bloodGroup: 'O+',
      contact: '+91 98765 43210',
      admissionDate: '2026-03-01',
      bedType: 'ICU',
      doctorAssigned: 'Dr. Priya Singh',
      doctorId: 'D001',
      status: 'admitted',
      address: 'Delhi',
      emergencyContact: '+91 98765 43211',
      patientId: 'P001'
    },
    {
      id: 'P002',
      name: 'Anita Desai',
      age: 32,
      gender: 'Female',
      bloodGroup: 'A+',
      contact: '+91 98765 43211',
      admissionDate: '2026-03-02',
      bedType: 'General Ward',
      doctorAssigned: 'Dr. Rajesh Kumar',
      doctorId: 'D002',
      status: 'admitted',
      address: 'Noida',
      emergencyContact: '+91 98765 43212',
      patientId: 'P002'
    }
  ];

  const getMockDoctors = () => [
    {
      id: 'D001',
      name: 'Dr. Priya Singh',
      specialization: 'Cardiologist',
      qualification: 'MD, DM Cardiology',
      experience: 12,
      contact: '+91 98765 43220',
      email: 'priya.singh@hospital.com',
      availability: 'available',
      consultationFee: 800,
      patientsCount: 45,
      rating: 4.8,
      address: 'Greater Noida',
      department: 'Cardiology',
      doctorId: 'D001',
      joiningDate: '2024-01-15'
    },
    {
      id: 'D002',
      name: 'Dr. Rajesh Kumar',
      specialization: 'Neurologist',
      qualification: 'MD, DM Neurology',
      experience: 15,
      contact: '+91 98765 43221',
      email: 'rajesh.kumar@hospital.com',
      availability: 'busy',
      consultationFee: 1000,
      patientsCount: 38,
      rating: 4.9,
      address: 'Noida',
      department: 'Neurology',
      doctorId: 'D002',
      joiningDate: '2023-06-20'
    }
  ];

  const getMockAppointments = () => [
    {
      id: 'A001',
      patientName: 'Rahul Sharma',
      patientId: 'P001',
      doctorName: 'Dr. Priya Singh',
      doctorId: 'D001',
      date: '2026-03-05',
      time: '10:00 AM',
      type: 'Follow-up',
      status: 'scheduled'
    },
    {
      id: 'A002',
      patientName: 'Anita Desai',
      patientId: 'P002',
      doctorName: 'Dr. Rajesh Kumar',
      doctorId: 'D002',
      date: '2026-03-05',
      time: '11:30 AM',
      type: 'Consultation',
      status: 'confirmed'
    }
  ];

  const handleLogoClick = () => {
    navigate('/');
  };

  const generateEncryptedBedUrl = () => {
    if (!hospitalData) return '#';
    
    const currentHospitalId = hospitalId || hospitalData.id || hospitalData.hospitalId;
    
    if (!currentHospitalId) {
      console.error('No hospital ID available');
      return '#';
    }
    
    const timestamp = Date.now();
    const dataToEncrypt = JSON.stringify({
      hospitalId: currentHospitalId,
      hospitalName: hospitalData.name,
      timestamp,
      bedData: bedData
    });
    
    const encrypted = btoa(encodeURIComponent(dataToEncrypt));
    
    // For HashRouter, we need to include the hash
    return `#/bed-management?token=${encrypted}&h=${currentHospitalId}&t=${timestamp}`;
  };

  const calculateBedStats = () => {
    let total = 0;
    let available = 0;
    
    Object.values(bedData).forEach(category => {
      total += category.totalBeds || 0;
      available += category.availableBeds || 0;
    });
    
    return { total, available, occupied: total - available };
  };

  const getUtilizationColor = (total, occupied) => {
    const utilization = total > 0 ? (occupied / total) * 100 : 0;
    if (utilization >= 80) return 'utilization-high';
    if (utilization >= 50) return 'utilization-medium';
    return 'utilization-low';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'icu': '🫀',
      'general': '🛌',
      'pediatric': '👶',
      'maternity': '🤰',
      'emergency': '🚨',
      'surgical': '🔪',
      'psychiatric': '🧠',
      'isolation': '🦠',
      'recovery': '💤',
      'ccu': '❤️',
      'cardiac': '💓',
      'orthopedic': '🦴',
      'neurology': '🧠',
      'oncology': '🎗️',
      'burn': '🔥'
    };
    
    return icons[category.toLowerCase()] || '🛏️';
  };

  const getStatusLabel = (available) => {
    if (available > 10) return { label: 'High', color: '#10b981' };
    if (available > 5) return { label: 'Moderate', color: '#f59e0b' };
    if (available > 0) return { label: 'Low', color: '#ef4444' };
    return { label: 'Full', color: '#dc2626' };
  };

  // Generate unique ID for patient/doctor
  const generateId = (prefix) => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  };

  // Handle Add Patient to Firebase
  const handleAddPatient = async () => {
    // Validate form
    if (!newPatient.name || !newPatient.age || !newPatient.gender || !newPatient.contact) {
      setFormError('Please fill in all required fields');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      // Generate patient ID if not provided
      const patientId = newPatient.patientId || generateId('P');
      
      // Prepare patient data matching your Firebase structure
      const patientData = {
        patientId: patientId,
        name: newPatient.name,
        age: parseInt(newPatient.age) || 0,
        gender: newPatient.gender,
        contact: newPatient.contact,
        address: newPatient.address || '',
        bloodGroup: newPatient.bloodGroup || '',
        emergencyContact: newPatient.emergencyContact || '',
        medicalHistory: newPatient.medicalHistory || '',
        admissionDate: newPatient.admissionDate || new Date().toISOString().split('T')[0],
        status: newPatient.status || 'admitted',
        bedType: newPatient.bedType || '',
        doctorAssigned: newPatient.doctorAssigned || '',
        doctorId: newPatient.doctorId || '',
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        hospitalId: hospitalId,
        // Additional fields
        city: hospitalData?.city || '',
        state: hospitalData?.state || '',
      };

      // Add to Firestore under hospitals/{hospitalId}/patients
      const patientsRef = collection(db, 'hospitals', hospitalId, 'patients');
      const docRef = await addDoc(patientsRef, patientData);

      console.log('Patient added with ID:', docRef.id);

      // Update local state
      const newPatientWithId = {
        id: docRef.id,
        ...patientData,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      setPatients(prev => [...prev, newPatientWithId]);
      
      // Show success message
      setFormSuccess('Patient added successfully!');
      
      // Reset form
      setNewPatient({
        name: '',
        age: '',
        gender: '',
        contact: '',
        address: '',
        bloodGroup: '',
        emergencyContact: '',
        medicalHistory: '',
        admissionDate: new Date().toISOString().split('T')[0],
        status: 'admitted',
        bedType: '',
        doctorAssigned: '',
        doctorId: '',
        patientId: '',
      });

      // Close form after 2 seconds
      setTimeout(() => {
        setShowPatientForm(false);
        setFormSuccess('');
      }, 2000);

    } catch (error) {
      console.error('Error adding patient:', error);
      setFormError('Failed to add patient: ' + error.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Add Doctor to Firebase
  const handleAddDoctor = async () => {
    // Validate form
    if (!newDoctor.name || !newDoctor.specialization || !newDoctor.contact) {
      setFormError('Please fill in all required fields');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      // Generate doctor ID if not provided
      const doctorId = newDoctor.doctorId || generateId('D');
      
      // Prepare doctor data matching your Firebase structure
      const doctorData = {
        doctorId: doctorId,
        name: newDoctor.name,
        specialization: newDoctor.specialization,
        qualification: newDoctor.qualification || '',
        experience: parseInt(newDoctor.experience) || 0,
        contact: newDoctor.contact,
        email: newDoctor.email || '',
        availability: newDoctor.availability || 'available',
        consultationFee: parseFloat(newDoctor.consultationFee) || 0,
        department: newDoctor.department || '',
        joiningDate: newDoctor.joiningDate || new Date().toISOString().split('T')[0],
        address: newDoctor.address || '',
        patientsCount: 0,
        rating: 4.5,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        hospitalId: hospitalId,
        // Additional fields matching your structure
        city: hospitalData?.city || '',
        state: hospitalData?.state || '',
        status: 'active'
      };

      // Add to Firestore under hospitals/{hospitalId}/doctors
      const doctorsRef = collection(db, 'hospitals', hospitalId, 'doctors');
      const docRef = await addDoc(doctorsRef, doctorData);

      console.log('Doctor added with ID:', docRef.id);

      // Update local state
      const newDoctorWithId = {
        id: docRef.id,
        ...doctorData,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      setDoctors(prev => [...prev, newDoctorWithId]);
      
      // Show success message
      setFormSuccess('Doctor added successfully!');
      
      // Reset form
      setNewDoctor({
        name: '',
        specialization: '',
        qualification: '',
        experience: '',
        contact: '',
        email: '',
        availability: 'available',
        consultationFee: '',
        department: '',
        joiningDate: new Date().toISOString().split('T')[0],
        address: '',
        doctorId: '',
      });

      // Close form after 2 seconds
      setTimeout(() => {
        setShowDoctorForm(false);
        setFormSuccess('');
      }, 2000);

    } catch (error) {
      console.error('Error adding doctor:', error);
      setFormError('Failed to add doctor: ' + error.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleAddAppointment = async () => {
    // Validate form
    if (!newAppointment.patientName || !newAppointment.doctorName || !newAppointment.date || !newAppointment.time) {
      setFormError('Please fill in all required fields');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      // Generate appointment ID
      const appointmentId = generateId('A');
      
      // Prepare appointment data
      const appointmentData = {
        appointmentId: appointmentId,
        patientName: newAppointment.patientName,
        patientId: newAppointment.patientId || '',
        doctorName: newAppointment.doctorName,
        doctorId: newAppointment.doctorId || '',
        date: newAppointment.date,
        time: newAppointment.time,
        type: newAppointment.type || 'consultation',
        status: newAppointment.status || 'scheduled',
        notes: newAppointment.notes || '',
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        hospitalId: hospitalId
      };

      // Add to Firestore under hospitals/{hospitalId}/appointments
      const appointmentsRef = collection(db, 'hospitals', hospitalId, 'appointments');
      const docRef = await addDoc(appointmentsRef, appointmentData);

      console.log('Appointment added with ID:', docRef.id);

      // Update local state
      const newAppointmentWithId = {
        id: docRef.id,
        ...appointmentData,
        createdAt: new Date().toISOString()
      };

      setAppointments(prev => [...prev, newAppointmentWithId]);
      
      setFormSuccess('Appointment scheduled successfully!');
      
      setNewAppointment({
        patientName: '',
        patientId: '',
        doctorName: '',
        doctorId: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        type: 'consultation',
        status: 'scheduled',
        notes: ''
      });

      setTimeout(() => {
        setShowAppointmentForm(false);
        setFormSuccess('');
      }, 2000);

    } catch (error) {
      console.error('Error adding appointment:', error);
      setFormError('Failed to schedule appointment: ' + error.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handlePatientInputChange = (e) => {
    const { name, value } = e.target;
    setNewPatient(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Auto-fill doctorId when doctor is selected
    if (name === 'doctorAssigned') {
      const selectedDoctor = doctors.find(d => d.name === value);
      if (selectedDoctor) {
        setNewPatient(prev => ({
          ...prev,
          doctorId: selectedDoctor.doctorId || selectedDoctor.id
        }));
      }
    }
  };

  const handleDoctorInputChange = (e) => {
    const { name, value } = e.target;
    setNewDoctor(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAppointmentInputChange = (e) => {
    const { name, value } = e.target;
    setNewAppointment(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Auto-fill IDs when patient or doctor is selected
    if (name === 'patientName') {
      const selectedPatient = patients.find(p => p.name === value);
      if (selectedPatient) {
        setNewAppointment(prev => ({
          ...prev,
          patientId: selectedPatient.patientId || selectedPatient.id
        }));
      }
    }
    
    if (name === 'doctorName') {
      const selectedDoctor = doctors.find(d => d.name === value);
      if (selectedDoctor) {
        setNewAppointment(prev => ({
          ...prev,
          doctorId: selectedDoctor.doctorId || selectedDoctor.id
        }));
      }
    }
  };

  const { total, available, occupied } = calculateBedStats();

  // Logo Component for reuse
  const LogoComponent = ({ isFloating = false, isLarge = false, onError = null }) => {
    const width = isLarge ? '80px' : (isFloating ? '80px' : '60px');
    const height = isLarge ? '80px' : (isFloating ? '80px' : '60px');
    const hasError = isFloating ? floatingLogoError : (isLarge ? loadingLogoError : logoError);
    const errorHandler = isFloating ? setFloatingLogoError : (isLarge ? setLoadingLogoError : setLogoError);

    const handleClick = () => {
      handleLogoClick();
    };

    const handleImageError = (e) => {
      errorHandler(true);
      e.target.style.display = 'none';
      if (onError) onError();
    };

    return (
      <div 
        className={isFloating ? 'floating-logo' : (isLarge ? 'loading-logo-image' : 'logo-image')}
        onClick={handleClick}
        style={{ 
          width, 
          height,
          cursor: 'pointer'
        }}
      >
        {hasError ? (
          <div 
            className="logo-fallback"
            style={{ width: '100%', height: '100%' }}
          >
            {fallbackLogoText}
          </div>
        ) : (
          <img 
            src={logoUrl}
            alt="Swasthya Setu Logo"
            style={{ 
              width: '100%', 
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover'
            }}
            onError={handleImageError}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          />
        )}
      </div>
    );
  };

  // Navigation items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'patients', label: 'Patients', icon: '👥', badge: patients.length },
    { id: 'doctors', label: 'Doctors', icon: '👨‍⚕️', badge: doctors.length },
    { id: 'appointments', label: 'Appointments', icon: '📅', badge: appointments.length },
    { id: 'beds', label: 'Bed Management', icon: '🛏️' },
    { id: 'pharmacy', label: 'Pharmacy', icon: '💊' },
    { id: 'lab', label: 'Lab Reports', icon: '🔬' },
    { id: 'billing', label: 'Billing', icon: '💰' },
    { id: 'staff', label: 'Staff', icon: '👨‍💼' },
    { id: 'reports', label: 'Reports', icon: '📈' }
  ];

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-logo">
          <LogoComponent isLarge={true} />
          <div style={{
            fontSize: '2.5em',
            background: 'linear-gradient(135deg, #0d9488, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: '800',
            letterSpacing: '-1px',
            textAlign: 'center',
            marginTop: '10px'
          }}>
            SwasthConnect
          </div>
          <p style={{ color: '#64748b', marginTop: '5px', textAlign: 'center' }}>Connecting Healthcare...</p>
        </div>
        <div className="loading-spinner"></div>
        <p style={{ color: '#64748b', fontSize: '1.1em', marginTop: '20px' }}>Loading hospital dashboard...</p>
      </div>
    );
  }

  return (
    <div className="hospital-dashboard">
      {/* Floating Background Elements */}
      <div className="floating-elements">
        <div className="floating-element">⚕️</div>
        <div className="floating-element">🩺</div>
        <div className="floating-element">❤️</div>
        <div className="floating-element">🛏️</div>
        <div className="floating-element">💊</div>
      </div>

      <div className="dashboard-with-sidebar">
        {/* Vertical Navbar */}
        <div className="dashboard-sidebar">
          <div className="sidebar-header" style={{ textAlign: 'center', marginBottom: '20px' }}>
            <LogoComponent />
            <h3 style={{ margin: '10px 0 5px', color: '#0d9488' }}>SwasthConnect</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>{hospitalData?.name}</p>
          </div>
          
          <nav className="sidebar-nav">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </button>
            ))}
          </nav>
          
          <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: '20px' }}>
            <button className="nav-item" onClick={() => navigate('/settings')}>
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Settings</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/logout')}>
              <span className="nav-icon">🚪</span>
              <span className="nav-label">Logout</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="dashboard-main-content">
          {/* Dashboard Header */}
          <header className="dashboard-header">
            <div className="header-content">
              <div className="header-logo" onClick={handleLogoClick}>
                <LogoComponent />
                <div className="logo-text">
                  <h1>SwasthConnect</h1>
                  <span>Healthcare Bridge System</span>
                </div>
              </div>

              <h1 style={{ marginTop: "10px" }}>
                🏥 {hospitalData?.name || "Hospital Dashboard"}
              </h1>
              <p>📍 {hospitalData?.address || "No address available"}</p>
              <p>📞 {hospitalData?.contact || "No contact available"}</p>

              <div className="hospital-badge">
                <span style={{ fontSize: "1.2em" }}>🏥</span>
                <span>Hospital ID: {hospitalId}</span>
              </div>
            </div>
          </header>

          {/* Dynamic Content Based on Active Section */}
          <div className="section-content">
            {/* Dashboard Section */}
            {activeSection === 'dashboard' && (
              <div>
                {/* Statistics Cards */}
                <div className="stats-cards">
                  <div className="stat-card">
                    <div className="stat-card-icon">🛏️</div>
                    <h3>Total Beds</h3>
                    <p>{total}</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">✅</div>
                    <h3>Available Beds</h3>
                    <p>{available}</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">⏳</div>
                    <h3>Occupied Beds</h3>
                    <p>{occupied}</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">📊</div>
                    <h3>Utilization Rate</h3>
                    <p>{total > 0 ? Math.round((occupied / total) * 100) : 0}%</p>
                    <div className="utilization-progress">
                      <div
                        className={`utilization-fill ${getUtilizationColor(total, occupied)}`}
                        style={{
                          width: `${total > 0 ? (occupied / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Section */}
                <div className="action-section">
                  <button
                    className="edit-beds-btn"
                    onClick={() => {
                      const url = generateEncryptedBedUrl();
                      if (url.startsWith("#")) {
                        window.open(
                          window.location.origin + window.location.pathname + url,
                          "_blank",
                        );
                      } else {
                        window.open(url, "_blank");
                      }
                    }}
                  >
                    <span style={{ fontSize: "1.2em" }}>✏️</span>
                    <span>Edit Beds Management</span>
                  </button>

                  <div className="view-toggle">
                    <button
                      className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                      onClick={() => setViewMode("table")}
                    >
                      <span>📋</span>
                      <span>Table View</span>
                    </button>
                    <button
                      className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
                      onClick={() => setViewMode("cards")}
                    >
                      <span>🃏</span>
                      <span>Cards View</span>
                    </button>
                  </div>
                </div>

                {/* Hospital Details & Bed Categories */}
                <div className="hospital-details-section">
                  {/* Hospital Info Card */}
                  <div className="hospital-info-card">
                    <h2>🏥 Hospital Details</h2>
                    <div className="info-grid">
                      <div className="info-item">
                        <strong>Hospital ID</strong>
                        <span
                          style={{
                            fontSize: "1.1em",
                            fontWeight: "600",
                            color: "#0d9488",
                          }}
                        >
                          {hospitalId}
                        </span>
                      </div>
                      <div className="info-item">
                        <strong>Email Address</strong>
                        <span>{hospitalData?.email || "N/A"}</span>
                      </div>
                      <div className="info-item">
                        <strong>Emergency Contact</strong>
                        <span style={{ color: "#ef4444", fontWeight: "600" }}>
                          {hospitalData?.emergency_phone || hospitalData?.contact || "N/A"}
                        </span>
                      </div>
                      <div className="info-item">
                        <strong>Status</strong>
                        <span
                          style={{
                            color: "#10b981",
                            fontWeight: "600",
                            background: "#d1fae5",
                            padding: "4px 12px",
                            borderRadius: "12px",
                            fontSize: "0.9em",
                          }}
                        >
                          🟢 {hospitalData?.status || "Operational"}
                        </span>
                      </div>
                      <div className="info-item">
                        <strong>City</strong>
                        <span>{hospitalData?.city || "N/A"}</span>
                      </div>
                      <div className="info-item">
                        <strong>State</strong>
                        <span>{hospitalData?.state || "N/A"}</span>
                      </div>
                      <div className="info-item">
                        <strong>Pincode</strong>
                        <span>{hospitalData?.pincode || "N/A"}</span>
                      </div>
                      <div className="info-item">
                        <strong>Type</strong>
                        <span>{hospitalData?.type || "N/A"}</span>
                      </div>
                      <div className="info-item full-width">
                        <strong>Facilities</strong>
                        <div className="facilities-grid">
                          {hospitalData?.facilities?.map((facility, index) => (
                            <span key={index} className="facility-tag">
                              {facility}
                            </span>
                          )) || <span>No facilities listed</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bed Categories Card */}
                  <div className="bed-summary-card">
                    <div className="card-header">
                      <h2>
                        <span>🛏️</span>
                        <span>Bed Categories</span>
                      </h2>
                      <div className="category-count">
                        {Object.keys(bedData).length} Categories
                      </div>
                    </div>

                    {Object.keys(bedData).length > 0 ? (
                      viewMode === "table" ? (
                        <div className="table-container">
                          <table className="bed-categories-table">
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th>Total</th>
                                <th>Available</th>
                                <th>Occupied</th>
                                <th>Utilization</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(bedData).map(
                                ([category, data], index) => {
                                  const totalBeds = data.totalBeds || 0;
                                  const availableBeds = data.availableBeds || 0;
                                  const occupiedBeds = totalBeds - availableBeds;
                                  const utilization =
                                    totalBeds > 0
                                      ? (occupiedBeds / totalBeds) * 100
                                      : 0;
                                  const status = getStatusLabel(availableBeds);

                                  return (
                                    <tr key={category}>
                                      <td>
                                        <span
                                          className="bed-category-icon"
                                          style={{ "--delay": index }}
                                        >
                                          {getCategoryIcon(category)}
                                        </span>
                                        <span>{category}</span>
                                      </td>
                                      <td>
                                        <span className="status-badge status-total">
                                          {totalBeds}
                                        </span>
                                      </td>
                                      <td>
                                        <span className="status-badge status-available">
                                          {availableBeds}
                                        </span>
                                      </td>
                                      <td>
                                        <span className="status-badge status-occupied">
                                          {occupiedBeds}
                                        </span>
                                      </td>
                                      <td>
                                        <div
                                          style={{
                                            fontWeight: "600",
                                            color: "#1e293b",
                                          }}
                                        >
                                          {Math.round(utilization)}%
                                        </div>
                                        <div className="utilization-progress">
                                          <div
                                            className={`utilization-fill ${getUtilizationColor(totalBeds, occupiedBeds)}`}
                                            style={{ width: `${utilization}%` }}
                                          />
                                        </div>
                                      </td>
                                      <td>
                                        <span
                                          className="status-badge"
                                          style={{
                                            background: `${status.color}15`,
                                            color: status.color,
                                            border: `1px solid ${status.color}30`,
                                          }}
                                        >
                                          {status.label}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                },
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bed-cards-view">
                          {Object.entries(bedData).map(([category, data], index) => {
                            const totalBeds = data.totalBeds || 0;
                            const availableBeds = data.availableBeds || 0;
                            const occupiedBeds = totalBeds - availableBeds;
                            const utilization =
                              totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
                            const status = getStatusLabel(availableBeds);

                            return (
                              <div
                                key={category}
                                className="bed-category-card"
                                style={{ animationDelay: `${index * 0.1}s` }}
                              >
                                <div className="bed-category-header">
                                  <h4>
                                    <span
                                      className="bed-category-icon"
                                      style={{ "--delay": index }}
                                    >
                                      {getCategoryIcon(category)}
                                    </span>
                                    {category}
                                  </h4>
                                  <span
                                    style={{
                                      fontSize: "0.85em",
                                      padding: "6px 15px",
                                      borderRadius: "15px",
                                      background: `${status.color}15`,
                                      color: status.color,
                                      fontWeight: "600",
                                      border: `1px solid ${status.color}30`,
                                    }}
                                  >
                                    {status.label} Availability
                                  </span>
                                </div>

                                <div className="bed-stats-grid">
                                  <div className="stat-item">
                                    <div className="label">Total</div>
                                    <div className="value" style={{ color: "#1e40af" }}>
                                      {totalBeds}
                                    </div>
                                  </div>
                                  <div className="stat-item">
                                    <div className="label">Available</div>
                                    <div className="value" style={{ color: "#10b981" }}>
                                      {availableBeds}
                                    </div>
                                  </div>
                                  <div className="stat-item">
                                    <div className="label">Occupied</div>
                                    <div className="value" style={{ color: "#ef4444" }}>
                                      {occupiedBeds}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    marginTop: "20px",
                                    paddingTop: "15px",
                                    borderTop: "1px solid #e2e8f0",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.9em",
                                        color: "#64748b",
                                        fontWeight: "500",
                                      }}
                                    >
                                      Utilization:
                                    </span>
                                    <span
                                      style={{ fontWeight: "700", color: "#1e293b" }}
                                    >
                                      {Math.round(utilization)}%
                                    </span>
                                  </div>
                                  <div className="utilization-progress">
                                    <div
                                      className={`utilization-fill ${getUtilizationColor(totalBeds, occupiedBeds)}`}
                                      style={{ width: `${utilization}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="empty-state">
                        <div className="empty-state-icon">🛏️</div>
                        <h3>No Bed Data Available</h3>
                        <p>
                          Start by adding bed categories and their availability to
                          manage hospital resources effectively.
                        </p>
                        <button
                          className="edit-beds-btn"
                          onClick={() =>
                            window.open(generateEncryptedBedUrl(), "_blank")
                          }
                          style={{ padding: "15px 40px", fontSize: "16px" }}
                        >
                          <span>➕</span>
                          <span>Add Bed Categories</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Patients Section */}
            {activeSection === 'patients' && (
              <div>
                <div className="section-header">
                  <h2>
                    <span>👥</span> Patient Management
                  </h2>
                  <div className="section-actions">
                    <button 
                      className="edit-beds-btn"
                      onClick={() => {
                        setShowPatientForm(!showPatientForm);
                        setFormError('');
                        setFormSuccess('');
                      }}
                    >
                      <span>➕</span>
                      <span>{showPatientForm ? 'Cancel' : 'Add New Patient'}</span>
                    </button>
                  </div>
                </div>

                {showPatientForm && (
                  <div className="patient-form-container">
                    <h3 style={{ marginBottom: '20px', color: '#0d9488' }}>Add New Patient</h3>
                    
                    {formError && (
                      <div style={{ 
                        background: '#fee2e2', 
                        color: '#991b1b', 
                        padding: '12px', 
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        {formError}
                      </div>
                    )}
                    
                    {formSuccess && (
                      <div style={{ 
                        background: '#d1fae5', 
                        color: '#065f46', 
                        padding: '12px', 
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        {formSuccess}
                      </div>
                    )}
                    
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Patient Name *</label>
                        <input 
                          type="text" 
                          name="name"
                          value={newPatient.name}
                          onChange={handlePatientInputChange}
                          placeholder="Enter patient name"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Age *</label>
                        <input 
                          type="number" 
                          name="age"
                          value={newPatient.age}
                          onChange={handlePatientInputChange}
                          placeholder="Enter age"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Gender *</label>
                        <select 
                          name="gender"
                          value={newPatient.gender}
                          onChange={handlePatientInputChange}
                          required
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Blood Group</label>
                        <select 
                          name="bloodGroup"
                          value={newPatient.bloodGroup}
                          onChange={handlePatientInputChange}
                        >
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
                        <label>Contact Number *</label>
                        <input 
                          type="text" 
                          name="contact"
                          value={newPatient.contact}
                          onChange={handlePatientInputChange}
                          placeholder="Enter contact number"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Emergency Contact</label>
                        <input 
                          type="text" 
                          name="emergencyContact"
                          value={newPatient.emergencyContact}
                          onChange={handlePatientInputChange}
                          placeholder="Enter emergency contact"
                        />
                      </div>
                      <div className="form-group">
                        <label>Address</label>
                        <input 
                          type="text" 
                          name="address"
                          value={newPatient.address}
                          onChange={handlePatientInputChange}
                          placeholder="Enter address"
                        />
                      </div>
                      <div className="form-group">
                        <label>Bed Type</label>
                        <select 
                          name="bedType"
                          value={newPatient.bedType}
                          onChange={handlePatientInputChange}
                        >
                          <option value="">Select Bed Type</option>
                          {Object.keys(bedData).map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Assign Doctor</label>
                        <select 
                          name="doctorAssigned"
                          value={newPatient.doctorAssigned}
                          onChange={handlePatientInputChange}
                        >
                          <option value="">Select Doctor</option>
                          {doctors.map(doctor => (
                            <option key={doctor.id} value={doctor.name}>{doctor.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Admission Date</label>
                        <input 
                          type="date" 
                          name="admissionDate"
                          value={newPatient.admissionDate}
                          onChange={handlePatientInputChange}
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Medical History</label>
                        <textarea 
                          name="medicalHistory"
                          value={newPatient.medicalHistory}
                          onChange={handlePatientInputChange}
                          placeholder="Enter medical history, allergies, current medications..."
                          rows="3"
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="cancel-btn" onClick={() => setShowPatientForm(false)}>Cancel</button>
                      <button 
                        className="submit-btn" 
                        onClick={handleAddPatient}
                        disabled={formSubmitting}
                      >
                        {formSubmitting ? 'Adding...' : 'Add Patient'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="patients-grid">
                  {patients.map((patient, index) => (
                    <div key={patient.id} className="patient-card">
                      <div className="patient-header">
                        <div className="patient-avatar">
                          {patient.name?.charAt(0) || 'P'}
                        </div>
                        <div className="patient-info">
                          <h3>{patient.name}</h3>
                          <p>
                            <span>🆔 {patient.patientId || patient.id}</span> | 
                            <span> {patient.age} yrs | {patient.gender}</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="patient-details">
                        <div className="patient-detail-item">
                          <span className="label">Blood Group</span>
                          <span className="value" style={{ color: '#ef4444', fontWeight: 'bold' }}>{patient.bloodGroup}</span>
                        </div>
                        <div className="patient-detail-item">
                          <span className="label">Contact</span>
                          <span className="value">{patient.contact}</span>
                        </div>
                        <div className="patient-detail-item">
                          <span className="label">Admission</span>
                          <span className="value">{patient.admissionDate}</span>
                        </div>
                        <div className="patient-detail-item">
                          <span className="label">Bed Type</span>
                          <span className="value" style={{ fontWeight: '600' }}>{patient.bedType}</span>
                        </div>
                        <div className="patient-detail-item full-width">
                          <span className="label">Doctor</span>
                          <span className="value" style={{ color: '#0d9488' }}>{patient.doctorAssigned}</span>
                        </div>
                      </div>
                      
                      <div className="patient-actions">
                        <button className="patient-action-btn view-btn">
                          <span>👁️</span> View
                        </button>
                        <button className="patient-action-btn edit-btn">
                          <span>✏️</span> Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Doctors Section */}
            {activeSection === 'doctors' && (
              <div>
                <div className="section-header">
                  <h2>
                    <span>👨‍⚕️</span> Doctor Management
                  </h2>
                  <div className="section-actions">
                    <button 
                      className="edit-beds-btn"
                      onClick={() => {
                        setShowDoctorForm(!showDoctorForm);
                        setFormError('');
                        setFormSuccess('');
                      }}
                    >
                      <span>➕</span>
                      <span>{showDoctorForm ? 'Cancel' : 'Add New Doctor'}</span>
                    </button>
                  </div>
                </div>

                {showDoctorForm && (
                  <div className="doctor-form-container">
                    <h3 style={{ marginBottom: '20px', color: '#0d9488' }}>Add New Doctor</h3>
                    
                    {formError && (
                      <div style={{ 
                        background: '#fee2e2', 
                        color: '#991b1b', 
                        padding: '12px', 
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        {formError}
                      </div>
                    )}
                    
                    {formSuccess && (
                      <div style={{ 
                        background: '#d1fae5', 
                        color: '#065f46', 
                        padding: '12px', 
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        {formSuccess}
                      </div>
                    )}
                    
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Doctor Name *</label>
                        <input 
                          type="text" 
                          name="name"
                          value={newDoctor.name}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter doctor name"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Specialization *</label>
                        <input 
                          type="text" 
                          name="specialization"
                          value={newDoctor.specialization}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter specialization"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Qualification</label>
                        <input 
                          type="text" 
                          name="qualification"
                          value={newDoctor.qualification}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter qualification"
                        />
                      </div>
                      <div className="form-group">
                        <label>Experience (years)</label>
                        <input 
                          type="number" 
                          name="experience"
                          value={newDoctor.experience}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter experience"
                        />
                      </div>
                      <div className="form-group">
                        <label>Contact Number *</label>
                        <input 
                          type="text" 
                          name="contact"
                          value={newDoctor.contact}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter contact number"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input 
                          type="email" 
                          name="email"
                          value={newDoctor.email}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter email"
                        />
                      </div>
                      <div className="form-group">
                        <label>Address</label>
                        <input 
                          type="text" 
                          name="address"
                          value={newDoctor.address}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter address"
                        />
                      </div>
                      <div className="form-group">
                        <label>Department</label>
                        <input 
                          type="text" 
                          name="department"
                          value={newDoctor.department}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter department"
                        />
                      </div>
                      <div className="form-group">
                        <label>Consultation Fee (₹)</label>
                        <input 
                          type="number" 
                          name="consultationFee"
                          value={newDoctor.consultationFee}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter consultation fee"
                        />
                      </div>
                      <div className="form-group">
                        <label>Availability</label>
                        <select 
                          name="availability"
                          value={newDoctor.availability}
                          onChange={handleDoctorInputChange}
                        >
                          <option value="available">Available</option>
                          <option value="busy">Busy</option>
                          <option value="on-leave">On Leave</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Joining Date</label>
                        <input 
                          type="date" 
                          name="joiningDate"
                          value={newDoctor.joiningDate}
                          onChange={handleDoctorInputChange}
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="cancel-btn" onClick={() => setShowDoctorForm(false)}>Cancel</button>
                      <button 
                        className="submit-btn" 
                        onClick={handleAddDoctor}
                        disabled={formSubmitting}
                      >
                        {formSubmitting ? 'Adding...' : 'Add Doctor'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="doctors-grid">
                  {doctors.map((doctor, index) => (
                    <div key={doctor.id} className="doctor-card">
                      <div className="doctor-avatar">
                        {doctor.name?.split(' ')[1]?.charAt(0) || doctor.name?.charAt(0) || 'D'}
                      </div>
                      <h3>{doctor.name}</h3>
                      <div className="doctor-specialty">{doctor.specialization}</div>
                      
                      <div className="doctor-stats">
                        <div className="doctor-stat">
                          <div className="number">{doctor.experience}</div>
                          <div className="label">Years Exp</div>
                        </div>
                        <div className="doctor-stat">
                          <div className="number">{doctor.patientsCount || 0}</div>
                          <div className="label">Patients</div>
                        </div>
                        <div className="doctor-stat">
                          <div className="number">{doctor.rating || '4.5'}</div>
                          <div className="label">Rating</div>
                        </div>
                      </div>
                      
                      <div className="doctor-contact">
                        <div className="doctor-contact-item">
                          <span>📞</span> {doctor.contact}
                        </div>
                        <div className="doctor-contact-item">
                          <span>✉️</span> {doctor.email}
                        </div>
                        <div className="doctor-contact-item">
                          <span>💰</span> ₹{doctor.consultationFee}/-
                        </div>
                      </div>
                      
                      <div className={`doctor-availability availability-${doctor.availability}`}>
                        {doctor.availability === 'available' && '🟢 Available'}
                        {doctor.availability === 'busy' && '🟡 Busy'}
                        {doctor.availability === 'on-leave' && '🔴 On Leave'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appointments Section */}
            {activeSection === 'appointments' && (
              <div>
                <div className="section-header">
                  <h2>
                    <span>📅</span> Appointment Management
                  </h2>
                  <div className="section-actions">
                    <button 
                      className="edit-beds-btn"
                      onClick={() => {
                        setShowAppointmentForm(!showAppointmentForm);
                        setFormError('');
                        setFormSuccess('');
                      }}
                    >
                      <span>➕</span>
                      <span>{showAppointmentForm ? 'Cancel' : 'New Appointment'}</span>
                    </button>
                  </div>
                </div>

                {showAppointmentForm && (
                  <div className="appointment-form-container">
                    <h3 style={{ marginBottom: '20px', color: '#0d9488' }}>Schedule New Appointment</h3>
                    
                    {formError && (
                      <div style={{ 
                        background: '#fee2e2', 
                        color: '#991b1b', 
                        padding: '12px', 
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        {formError}
                      </div>
                    )}
                    
                    {formSuccess && (
                      <div style={{ 
                        background: '#d1fae5', 
                        color: '#065f46', 
                        padding: '12px', 
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        {formSuccess}
                      </div>
                    )}
                    
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Patient Name *</label>
                        <select 
                          name="patientName"
                          value={newAppointment.patientName}
                          onChange={handleAppointmentInputChange}
                          required
                        >
                          <option value="">Select Patient</option>
                          {patients.map(patient => (
                            <option key={patient.id} value={patient.name}>{patient.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Doctor *</label>
                        <select 
                          name="doctorName"
                          value={newAppointment.doctorName}
                          onChange={handleAppointmentInputChange}
                          required
                        >
                          <option value="">Select Doctor</option>
                          {doctors.map(doctor => (
                            <option key={doctor.id} value={doctor.name}>{doctor.name} - {doctor.specialization}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Appointment Date *</label>
                        <input 
                          type="date" 
                          name="date"
                          value={newAppointment.date}
                          onChange={handleAppointmentInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Appointment Time *</label>
                        <input 
                          type="time" 
                          name="time"
                          value={newAppointment.time}
                          onChange={handleAppointmentInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Appointment Type</label>
                        <select 
                          name="type"
                          value={newAppointment.type}
                          onChange={handleAppointmentInputChange}
                        >
                          <option value="consultation">Consultation</option>
                          <option value="follow-up">Follow-up</option>
                          <option value="surgery">Surgery</option>
                          <option value="checkup">Regular Checkup</option>
                          <option value="emergency">Emergency</option>
                        </select>
                      </div>
                      <div className="form-group full-width">
                        <label>Notes</label>
                        <textarea 
                          name="notes"
                          value={newAppointment.notes}
                          onChange={handleAppointmentInputChange}
                          placeholder="Enter any special notes or requirements..."
                          rows="3"
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="cancel-btn" onClick={() => setShowAppointmentForm(false)}>Cancel</button>
                      <button 
                        className="submit-btn" 
                        onClick={handleAddAppointment}
                        disabled={formSubmitting}
                      >
                        {formSubmitting ? 'Scheduling...' : 'Schedule Appointment'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="appointments-container">
                  <div className="appointments-filters">
                    <button className="filter-btn active">All</button>
                    <button className="filter-btn">Today</button>
                    <button className="filter-btn">Upcoming</button>
                    <button className="filter-btn">Completed</button>
                  </div>

                  <table className="appointments-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map(appointment => (
                        <tr key={appointment.id}>
                          <td>
                            <strong>{appointment.patientName}</strong>
                            <br />
                            <small style={{ color: '#64748b' }}>ID: {appointment.patientId}</small>
                          </td>
                          <td>
                            <strong>{appointment.doctorName}</strong>
                          </td>
                          <td>
                            {appointment.date} <br />
                            <span style={{ fontWeight: '600', color: '#0d9488' }}>{appointment.time}</span>
                          </td>
                          <td>
                            <span style={{ 
                              padding: '4px 8px', 
                              background: '#f0f9ff', 
                              borderRadius: '12px',
                              fontSize: '0.85rem'
                            }}>
                              {appointment.type}
                            </span>
                          </td>
                          <td>
                            <span className={`appointment-status status-${appointment.status}`}>
                              {appointment.status}
                            </span>
                          </td>
                          <td>
                            <button className="view-btn" style={{ padding: '6px 12px', marginRight: '5px' }}>👁️</button>
                            <button className="edit-btn" style={{ padding: '6px 12px' }}>✏️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Other sections (placeholder) */}
            {['beds', 'pharmacy', 'lab', 'billing', 'staff', 'reports'].includes(activeSection) && (
              <div className="empty-state" style={{ padding: '60px 20px' }}>
                <div className="empty-state-icon" style={{ fontSize: '4rem' }}>
                  {activeSection === 'beds' && '🛏️'}
                  {activeSection === 'pharmacy' && '💊'}
                  {activeSection === 'lab' && '🔬'}
                  {activeSection === 'billing' && '💰'}
                  {activeSection === 'staff' && '👨‍💼'}
                  {activeSection === 'reports' && '📈'}
                </div>
                <h3>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Management</h3>
                <p>This section is under development. Check back soon for updates!</p>
                <button 
                  className="edit-beds-btn" 
                  onClick={() => setActiveSection('dashboard')}
                  style={{ marginTop: '20px' }}
                >
                  <span>🏠</span>
                  <span>Back to Dashboard</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Logo */}
      <LogoComponent isFloating={true} />
    </div>
  );
};

export default HospitalDashboard;