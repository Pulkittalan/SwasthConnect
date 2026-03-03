// src/pages/login/Login.jsx
import React, { useState } from 'react';
import { auth, db } from '../../firebase/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import './Login.css';

import videoBg from './2.mp4';


const Login = () => {
  const [activeForm, setActiveForm] = useState(null);
  const [formData, setFormData] = useState({
    // Login fields
    doctorId: '',
    doctorPassword: '',
    hospitalId: '',
    hospitalPassword: '',
    
    // Doctor Registration
    newDoctorId: '',
    newDoctorPassword: '',
    newDoctorEmail: '',
    doctorName: '',
    doctorGender: '',
    doctorDob: '',
    doctorRegistrationNo: '',
    doctorSpecialization: '',
    doctorQualification: 'MBBS',
    doctorExperience: '',
    doctorDepartment: '',
    doctorOPDDays: ['Monday', 'Wednesday', 'Friday'],
    doctorOPDTime: '09:00-17:00',
    doctorConsultationFee: '',
    doctorOnlineFee: '',
    doctorPhone: '',
    doctorPhoto: null,
    
    // Hospital Registration
    newHospitalId: '',
    newHospitalPassword: '',
    newHospitalEmail: '',
    hospitalName: '',
    hospitalType: 'clinic',
    hospitalRegNumber: '',
    hospitalGST: '',
    hospitalYear: new Date().getFullYear(),
    hospitalLogo: null,
    hospitalAddress: '',
    hospitalCity: '',
    hospitalState: '',
    hospitalPincode: '',
    hospitalMapLocation: '',
    hospitalEmail: '',
    hospitalPhone: '',
    hospitalEmergencyPhone: '',
    adminName: '',
    adminMobile: '',
    facilities: [],
    totalBeds: '',
    icuBeds: '',
    generalBeds: '',
    privateRooms: '',
    bankAccount: '',
    upiId: '',
    razorpayId: ''
  });
  
  const [showDoctorPassword, setShowDoctorPassword] = useState(false);
  const [showHospitalPassword, setShowHospitalPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const facilitiesList = [
    'ICU', 'Ventilator', 'Emergency', 'Blood Bank', 
    'Pharmacy', 'Lab', 'Ambulance', 'OPD', 'IPD'
  ];
  
  const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const qualificationOptions = ['MBBS', 'MD', 'MS', 'DNB', 'MCh', 'DM', 'BDS', 'MDS'];
  const specializationOptions = ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'General Surgery', 'Gynecology', 'ENT', 'Dermatology'];

  const navigate = useNavigate(); // Added navigate hook

  // Handle form switching
  const showForm = (type) => {
    setActiveForm(type);
    setError('');
  };

  // Handle input changes
  const handleChange = (e) => {
    const { id, value, type, checked, files } = e.target;
    
    if (type === 'checkbox') {
      if (id.startsWith('facility-')) {
        const facility = id.replace('facility-', '');
        setFormData(prev => ({
          ...prev,
          facilities: checked 
            ? [...prev.facilities, facility]
            : prev.facilities.filter(f => f !== facility)
        }));
      } else if (id.startsWith('day-')) {
        const day = id.replace('day-', '');
        setFormData(prev => ({
          ...prev,
          doctorOPDDays: checked 
            ? [...prev.doctorOPDDays, day]
            : prev.doctorOPDDays.filter(d => d !== day)
        }));
      }
    } else if (type === 'file') {
      setFormData(prev => ({
        ...prev,
        [id]: files[0]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [id]: value
      }));
    }
  };

  // Handle select changes
  const handleSelectChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Doctor Registration
  const handleDoctorRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.newDoctorEmail,
        formData.newDoctorPassword
      );
      
      // 2. Prepare doctor data
      const doctorData = {
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
        photo_url: '', // Will be updated after file upload
        uid: userCredential.user.uid,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      // 3. Save doctor data to Firestore
      await setDoc(doc(db, 'doctors', formData.newDoctorId), doctorData);
      
      alert('✅ Doctor registered successfully! Awaiting verification.');
      showForm('doctor-login');
      
      // Clear form
      setFormData(prev => ({
        ...prev,
        newDoctorId: '',
        newDoctorPassword: '',
        newDoctorEmail: '',
        doctorName: '',
        doctorGender: 'male',
        doctorDob: '',
        doctorRegistrationNo: '',
        doctorSpecialization: '',
        doctorQualification: 'MBBS',
        doctorExperience: '',
        doctorDepartment: '',
        doctorOPDDays: ['Monday', 'Wednesday', 'Friday'],
        doctorOPDTime: '09:00-17:00',
        doctorConsultationFee: '',
        doctorOnlineFee: '',
        doctorPhone: '',
        doctorPhoto: null
      }));
      
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message);
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Hospital Registration
  const handleHospitalRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.newHospitalEmail,
        formData.newHospitalPassword
      );
      
      const hospitalData = {
        hospital_id: formData.newHospitalId,
        email: formData.newHospitalEmail,
        name: formData.hospitalName,
        type: formData.hospitalType,
        registration_number: formData.hospitalRegNumber,
        gst_number: formData.hospitalGST,
        year_established: formData.hospitalYear,
        logo_url: '',
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
      
      await setDoc(doc(db, 'hospitals', formData.newHospitalId), hospitalData);
      
      alert('✅ Hospital registered successfully! Awaiting verification.');
      showForm('hospital-login');
      
      // Clear form
      setFormData(prev => ({
        ...prev,
        newHospitalId: '',
        newHospitalPassword: '',
        newHospitalEmail: '',
        hospitalName: '',
        hospitalType: 'clinic',
        hospitalRegNumber: '',
        hospitalGST: '',
        hospitalYear: new Date().getFullYear(),
        hospitalLogo: null,
        hospitalAddress: '',
        hospitalCity: '',
        hospitalState: '',
        hospitalPincode: '',
        hospitalMapLocation: '',
        hospitalEmail: '',
        hospitalPhone: '',
        hospitalEmergencyPhone: '',
        adminName: '',
        adminMobile: '',
        facilities: [],
        totalBeds: '',
        icuBeds: '',
        generalBeds: '',
        privateRooms: '',
        bankAccount: '',
        upiId: '',
        razorpayId: ''
      }));
      
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message);
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Doctor Login
  const handleDoctorLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const docRef = doc(db, 'doctors', formData.doctorId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('❌ Doctor not found');
      }
      
      const doctorData = docSnap.data();
      
      if (doctorData.status !== 'approved') {
        throw new Error('❌ Account pending verification. Please contact administrator.');
      }
      
      await signInWithEmailAndPassword(
        auth,
        doctorData.email,
        formData.doctorPassword
      );
      
      localStorage.setItem('userType', 'doctor');
      localStorage.setItem('doctorId', formData.doctorId);
      localStorage.setItem('doctorName', doctorData.name);
      
      alert('✅ Doctor login successful!');
      window.location.href = '/doctor-dashboard';
      
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Hospital Login
  const handleHospitalLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const docRef = doc(db, 'hospitals', formData.hospitalId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('❌ Hospital not found');
      }
      
      const hospitalData = docSnap.data();
      
      if (hospitalData.status !== 'approved') {
        throw new Error('❌ Account pending verification. Please contact administrator.');
      }
      
      await signInWithEmailAndPassword(
        auth,
        hospitalData.email,
        formData.hospitalPassword
      );
      
      localStorage.setItem('userType', 'hospital');
      localStorage.setItem('hospitalId', formData.hospitalId);
      localStorage.setItem('hospitalName', hospitalData.name);
      
      alert('✅ Hospital login successful!');
      navigate(`/dashboard/${formData.hospitalId}`);
      
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin Login Button Handler
  const handleAdminLogin = () => {
    navigate('/admin-login');
  };

  return (
    <div className="login-page">
      {/* Video Background */}
      <div className="background-video">
        <video autoPlay loop muted className="video-background">
          <source src={videoBg} type="video/mp4" />
        </video>
      </div>

      {/* Login Container */}
      <div className="login-container"> 
        <div className="image-container">
          <Link to="/">
            <img src="/images/logo.png" alt="Dashboard" />
          </Link>
          <h2>Welcome to SwasthConnect</h2>
        </div>
        
        <div className="login-box">
          <h1>Login</h1>
          
          {/* Error Message */}
          {error && (
            <div className="error-message" style={{color: 'red', textAlign: 'center', marginBottom: '10px'}}>
              {error}
            </div>
          )}
          
          {/* Login Options */}
          <div className="login-options">
            <button 
              className="login-option-btn" 
              onClick={() => showForm('doctor-login')}
              disabled={loading}
            >
              👨‍⚕️ Doctor
            </button>
            <button 
              className="login-option-btn" 
              onClick={() => showForm('hospital-login')}
              disabled={loading}
            >
              🏥 Hospital
            </button>
            
            {/* ADMIN LOGIN BUTTON - Added Here */}
            <button 
              className="login-option-btn admin-btn" 
              onClick={handleAdminLogin}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #9c27b0, #673ab7)',
                color: 'white',
                marginTop: '10px',
                border: '2px solid rgba(255, 255, 255, 0.5)'
              }}
            >
              👑 Admin Login
            </button>
          </div>

          {/* Doctor Login Form */}
          {activeForm === 'doctor-login' && (
            <form className="login-form active" onSubmit={handleDoctorLogin}>
              <input
                type="text"
                placeholder="Enter Doctor ID"
                id="doctorId"
                value={formData.doctorId}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Enter Password"
                id="doctorPassword"
                value={formData.doctorPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Logging in...' : '👨‍⚕️ Login as Doctor'}
              </button>
              <p className="registration-link" onClick={() => showForm('doctor-registration')}>
                Don't have an account? Register as Doctor
              </p>
            </form>
          )}

          {/* Hospital Login Form */}
          {activeForm === 'hospital-login' && (
            <form className="login-form active" onSubmit={handleHospitalLogin}>
              <input
                type="text"
                placeholder="Enter Hospital ID"
                id="hospitalId"
                value={formData.hospitalId}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Enter Password"
                id="hospitalPassword"
                value={formData.hospitalPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Logging in...' : '🏥 Login as Hospital'}
              </button>
              <p className="registration-link" onClick={() => showForm('hospital-registration')}>
                Don't have an account? Register as Hospital
              </p>
            </form>
          )}

          {/* Doctor Registration Form */}
          {activeForm === 'doctor-registration' && (
            <form className="registration-form active" onSubmit={handleDoctorRegister}>
              <h3 style={{textAlign: 'center', marginBottom: '20px', color: '#333'}}>👨‍⚕️ Doctor Registration</h3>
              
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="text"
                  placeholder="Doctor ID *"
                  id="newDoctorId"
                  value={formData.newDoctorId}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <div className="password-container">
                  <input
                    type={showDoctorPassword ? "text" : "password"}
                    placeholder="Password *"
                    id="newDoctorPassword"
                    value={formData.newDoctorPassword}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                  <span 
                    className="eye-icon" 
                    onClick={() => setShowDoctorPassword(!showDoctorPassword)}
                  >
                    {showDoctorPassword ? '👁️' : '🙈'}
                  </span>
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="text"
                  placeholder="Full Name *"
                  id="doctorName"
                  value={formData.doctorName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <select
                  id="doctorGender"
                  value={formData.doctorGender}
                  onChange={handleSelectChange}
                  disabled={loading}
                  style={{padding: '10px', borderRadius: '8px', border: '1px solid #ccc'}}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="date"
                  placeholder="Date of Birth"
                  id="doctorDob"
                  value={formData.doctorDob}
                  onChange={handleChange}
                  disabled={loading}
                />
                <input
                  type="email"
                  placeholder="Email *"
                  id="newDoctorEmail"
                  value={formData.newDoctorEmail}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <input
                type="text"
                placeholder="Registration No (MCI/NMC) *"
                id="doctorRegistrationNo"
                value={formData.doctorRegistrationNo}
                onChange={handleChange}
                required
                disabled={loading}
                style={{marginBottom: '10px'}}
              />

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <select
                  id="doctorSpecialization"
                  value={formData.doctorSpecialization}
                  onChange={handleSelectChange}
                  disabled={loading}
                  style={{padding: '10px', borderRadius: '8px', border: '1px solid #ccc'}}
                >
                  <option value="">Select Specialization</option>
                  {specializationOptions.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
                <select
                  id="doctorQualification"
                  value={formData.doctorQualification}
                  onChange={handleSelectChange}
                  disabled={loading}
                  style={{padding: '10px', borderRadius: '8px', border: '1px solid #ccc'}}
                >
                  {qualificationOptions.map(qual => (
                    <option key={qual} value={qual}>{qual}</option>
                  ))}
                </select>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="number"
                  placeholder="Years of Experience"
                  id="doctorExperience"
                  value={formData.doctorExperience}
                  onChange={handleChange}
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Phone *"
                  id="doctorPhone"
                  value={formData.doctorPhone}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <input
                type="text"
                placeholder="Department"
                id="doctorDepartment"
                value={formData.doctorDepartment}
                onChange={handleChange}
                disabled={loading}
                style={{marginBottom: '10px'}}
              />

              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontSize: '14px'}}>OPD Days:</label>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px'}}>
                  {daysList.map(day => (
                    <label key={day} style={{display: 'flex', alignItems: 'center', fontSize: '12px'}}>
                      <input
                        type="checkbox"
                        id={`day-${day}`}
                        checked={formData.doctorOPDDays.includes(day)}
                        onChange={handleChange}
                        disabled={loading}
                        style={{marginRight: '3px'}}
                      />
                      {day.substring(0, 3)}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="text"
                  placeholder="OPD Time (e.g., 09:00-17:00)"
                  id="doctorOPDTime"
                  value={formData.doctorOPDTime}
                  onChange={handleChange}
                  disabled={loading}
                />
                <input
                  type="number"
                  placeholder="Consultation Fee"
                  id="doctorConsultationFee"
                  value={formData.doctorConsultationFee}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <input
                type="number"
                placeholder="Online Consultation Fee"
                id="doctorOnlineFee"
                value={formData.doctorOnlineFee}
                onChange={handleChange}
                disabled={loading}
                style={{marginBottom: '15px'}}
              />

              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontSize: '14px'}}>Upload Photo:</label>
                <input
                  type="file"
                  id="doctorPhoto"
                  accept="image/*"
                  onChange={handleChange}
                  disabled={loading}
                  style={{width: '100%', padding: '5px'}}
                />
              </div>

              <button type="submit" className="register-btn" disabled={loading}>
                {loading ? 'Registering...' : '👨‍⚕️ Register as Doctor'}
              </button>
              <p className="back-link" onClick={() => showForm('doctor-login')}>
                Back to Doctor Login
              </p>
            </form>
          )}

          {/* Hospital Registration Form */}
          {activeForm === 'hospital-registration' && (
            <form className="registration-form active" onSubmit={handleHospitalRegister}>
              <h3 style={{textAlign: 'center', marginBottom: '20px', color: '#333'}}>🏥 Hospital Registration</h3>
              
              <div style={{marginBottom: '15px'}}>
                <input
                  type="text"
                  placeholder="Hospital Name *"
                  id="hospitalName"
                  value={formData.hospitalName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  style={{marginBottom: '10px'}}
                />
                
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                  <input
                    type="text"
                    placeholder="Hospital ID *"
                    id="newHospitalId"
                    value={formData.newHospitalId}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                  <div className="password-container">
                    <input
                      type={showHospitalPassword ? "text" : "password"}
                      placeholder="Password *"
                      id="newHospitalPassword"
                      value={formData.newHospitalPassword}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                    <span 
                      className="eye-icon" 
                      onClick={() => setShowHospitalPassword(!showHospitalPassword)}
                    >
                      {showHospitalPassword ? '👁️' : '🙈'}
                    </span>
                  </div>
                </div>

                <select
                  id="hospitalType"
                  value={formData.hospitalType}
                  onChange={handleSelectChange}
                  disabled={loading}
                  style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '10px'}}
                >
                  <option value="clinic">Clinic</option>
                  <option value="nursing_home">Nursing Home</option>
                  <option value="multi_specialty">Multi-specialty Hospital</option>
                  <option value="super_specialty">Super Specialty Hospital</option>
                </select>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="text"
                  placeholder="Registration Number *"
                  id="hospitalRegNumber"
                  value={formData.hospitalRegNumber}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="GST Number (Optional)"
                  id="hospitalGST"
                  value={formData.hospitalGST}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="number"
                  placeholder="Year Established"
                  id="hospitalYear"
                  value={formData.hospitalYear}
                  onChange={handleChange}
                  disabled={loading}
                />
                <input
                  type="email"
                  placeholder="Official Email *"
                  id="newHospitalEmail"
                  value={formData.newHospitalEmail}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <input
                type="text"
                placeholder="Address *"
                id="hospitalAddress"
                value={formData.hospitalAddress}
                onChange={handleChange}
                required
                disabled={loading}
                style={{marginBottom: '10px'}}
              />

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="text"
                  placeholder="City *"
                  id="hospitalCity"
                  value={formData.hospitalCity}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="State *"
                  id="hospitalState"
                  value={formData.hospitalState}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Pincode *"
                  id="hospitalPincode"
                  value={formData.hospitalPincode}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="text"
                  placeholder="Hospital Phone *"
                  id="hospitalPhone"
                  value={formData.hospitalPhone}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Emergency Phone"
                  id="hospitalEmergencyPhone"
                  value={formData.hospitalEmergencyPhone}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="text"
                  placeholder="Admin Name *"
                  id="adminName"
                  value={formData.adminName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Admin Mobile *"
                  id="adminMobile"
                  value={formData.adminMobile}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontSize: '14px'}}>Facilities:</label>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px'}}>
                  {facilitiesList.map(facility => (
                    <label key={facility} style={{display: 'flex', alignItems: 'center', fontSize: '12px'}}>
                      <input
                        type="checkbox"
                        id={`facility-${facility}`}
                        checked={formData.facilities.includes(facility)}
                        onChange={handleChange}
                        disabled={loading}
                        style={{marginRight: '3px'}}
                      />
                      {facility}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontSize: '14px'}}>Bed Capacity:</label>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px'}}>
                  <input
                    type="number"
                    placeholder="Total Beds"
                    id="totalBeds"
                    value={formData.totalBeds}
                    onChange={handleChange}
                    disabled={loading}
                    style={{fontSize: '12px', padding: '8px'}}
                  />
                  <input
                    type="number"
                    placeholder="ICU Beds"
                    id="icuBeds"
                    value={formData.icuBeds}
                    onChange={handleChange}
                    disabled={loading}
                    style={{fontSize: '12px', padding: '8px'}}
                  />
                  <input
                    type="number"
                    placeholder="General Beds"
                    id="generalBeds"
                    value={formData.generalBeds}
                    onChange={handleChange}
                    disabled={loading}
                    style={{fontSize: '12px', padding: '8px'}}
                  />
                  <input
                    type="number"
                    placeholder="Private Rooms"
                    id="privateRooms"
                    value={formData.privateRooms}
                    onChange={handleChange}
                    disabled={loading}
                    style={{fontSize: '12px', padding: '8px'}}
                  />
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                <input
                  type="text"
                  placeholder="Bank Account / UPI"
                  id="bankAccount"
                  value={formData.bankAccount}
                  onChange={handleChange}
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Razorpay Account ID"
                  id="razorpayId"
                  value={formData.razorpayId}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontSize: '14px'}}>Upload Hospital Logo:</label>
                <input
                  type="file"
                  id="hospitalLogo"
                  accept="image/*"
                  onChange={handleChange}
                  disabled={loading}
                  style={{width: '100%', padding: '5px'}}
                />
              </div>

              <button type="submit" className="register-btn" disabled={loading}>
                {loading ? 'Registering...' : '🏥 Register as Hospital'}
              </button>
              <p className="back-link" onClick={() => showForm('hospital-login')}>
                Back to Hospital Login
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;