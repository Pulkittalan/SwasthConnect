// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  deleteDoc,
  orderBy,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [pendingHospitals, setPendingHospitals] = useState([]);
  const [approvedDoctors, setApprovedDoctors] = useState([]);
  const [approvedHospitals, setApprovedHospitals] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [allHospitals, setAllHospitals] = useState([]);
  const [stats, setStats] = useState({
    totalDoctors: 0,
    totalHospitals: 0,
    pendingDoctors: 0,
    pendingHospitals: 0,
    approvedDoctors: 0,
    approvedHospitals: 0,
    rejectedDoctors: 0,
    rejectedHospitals: 0,
    hospitalDoctors: 0,
    independentDoctors: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctorType, setSelectedDoctorType] = useState('all'); // all, hospital, independent
  const [selectedHospitalStatus, setSelectedHospitalStatus] = useState('all'); // all, pending, approved, rejected
  const [selectedDoctorStatus, setSelectedDoctorStatus] = useState('all'); // all, pending, approved, rejected
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemType, setSelectedItemType] = useState(null);
  const navigate = useNavigate();

  // Handle logo click to go to home
  const handleLogoClick = () => {
    navigate('/');
  };

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
          navigate('/admin-login');
          return;
        }

        // Check if user is admin
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        
        if (!adminDoc.exists()) {
          const adminByEmail = query(
            collection(db, 'admins'),
            where('email', '==', currentUser.email)
          );
          const emailSnap = await getDocs(adminByEmail);
          
          if (emailSnap.empty) {
            alert('❌ Access denied. Admin only.');
            await signOut(auth);
            navigate('/login');
            return;
          }
        }

        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          name: 'Admin'
        });
        fetchAllData();
      } catch (error) {
        console.error('Admin check error:', error);
        navigate('/admin-login');
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [navigate]);

  // Fetch all data
  const fetchAllData = async () => {
    try {
      // Fetch ALL doctors from unified collection
      const doctorsQuery = query(
        collection(db, 'doctors'),
        orderBy('createdAt', 'desc')
      );
      const doctorsSnap = await getDocs(doctorsQuery);
      const allDoctorsData = doctorsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllDoctors(allDoctorsData);
      
      // Separate doctors by status and type
      const pendingDocs = allDoctorsData.filter(d => d.status === 'pending');
      const approvedDocs = allDoctorsData.filter(d => d.status === 'approved');
      const rejectedDocs = allDoctorsData.filter(d => d.status === 'rejected');
      const hospitalDocs = allDoctorsData.filter(d => d.doctorType === 'hospital');
      const independentDocs = allDoctorsData.filter(d => d.doctorType === 'independent');
      
      setPendingDoctors(pendingDocs);
      setApprovedDoctors(approvedDocs);
      
      // Fetch ALL hospitals
      const hospitalsQuery = query(
        collection(db, 'hospitals'),
        orderBy('createdAt', 'desc')
      );
      const hospitalsSnap = await getDocs(hospitalsQuery);
      const allHospitalsData = hospitalsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllHospitals(allHospitalsData);
      
      const pendingHospitalsData = allHospitalsData.filter(h => h.status === 'pending');
      const approvedHospitalsData = allHospitalsData.filter(h => h.status === 'approved');
      
      setPendingHospitals(pendingHospitalsData);
      setApprovedHospitals(approvedHospitalsData);
      
      // Update stats
      setStats({
        totalDoctors: allDoctorsData.length,
        totalHospitals: allHospitalsData.length,
        pendingDoctors: pendingDocs.length,
        pendingHospitals: pendingHospitalsData.length,
        approvedDoctors: approvedDocs.length,
        approvedHospitals: approvedHospitalsData.length,
        rejectedDoctors: rejectedDocs.length,
        rejectedHospitals: allHospitalsData.filter(h => h.status === 'rejected').length,
        hospitalDoctors: hospitalDocs.length,
        independentDoctors: independentDocs.length
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error loading data: ' + error.message);
    }
  };

  // Approve Doctor
  const approveDoctor = async (doctorId, doctorData) => {
    if (!window.confirm(`Approve doctor ${doctorData.name}?`)) return;

    try {
      const doctorRef = doc(db, 'doctors', doctorId);
      await updateDoc(doctorRef, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: user?.email || 'admin',
        updatedAt: new Date().toISOString()
      });

      alert(`✅ Doctor ${doctorData.name} approved successfully!`);
      fetchAllData();
    } catch (error) {
      console.error('Error approving doctor:', error);
      alert('Error: ' + error.message);
    }
  };

  // Reject Doctor
  const rejectDoctor = async (doctorId, doctorData) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const doctorRef = doc(db, 'doctors', doctorId);
      await updateDoc(doctorRef, {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
        rejectedBy: user?.email || 'admin',
        updatedAt: new Date().toISOString()
      });

      alert(`❌ Doctor ${doctorData.name} rejected. Reason: ${reason}`);
      fetchAllData();
    } catch (error) {
      console.error('Error rejecting doctor:', error);
      alert('Error: ' + error.message);
    }
  };

  // Approve Hospital
  const approveHospital = async (hospitalId, hospitalData) => {
    if (!window.confirm(`Approve hospital ${hospitalData.name}?`)) return;

    try {
      const hospitalRef = doc(db, 'hospitals', hospitalId);
      await updateDoc(hospitalRef, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: user?.email || 'admin',
        updatedAt: new Date().toISOString()
      });

      alert(`✅ Hospital ${hospitalData.name} approved successfully!`);
      fetchAllData();
    } catch (error) {
      console.error('Error approving hospital:', error);
      alert('Error: ' + error.message);
    }
  };

  // Reject Hospital
  const rejectHospital = async (hospitalId, hospitalData) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const hospitalRef = doc(db, 'hospitals', hospitalId);
      await updateDoc(hospitalRef, {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
        rejectedBy: user?.email || 'admin',
        updatedAt: new Date().toISOString()
      });

      alert(`❌ Hospital ${hospitalData.name} rejected. Reason: ${reason}`);
      fetchAllData();
    } catch (error) {
      console.error('Error rejecting hospital:', error);
      alert('Error: ' + error.message);
    }
  };

  // Delete Doctor
  const deleteDoctor = async (doctorId, doctorName) => {
    if (!window.confirm(`⚠️ Permanently delete doctor ${doctorName}? This action cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, 'doctors', doctorId));
      alert(`🗑️ Doctor ${doctorName} has been deleted permanently.`);
      fetchAllData();
    } catch (error) {
      console.error('Error deleting doctor:', error);
      alert('Error: ' + error.message);
    }
  };

  // Delete Hospital
  const deleteHospital = async (hospitalId, hospitalName) => {
    if (!window.confirm(`⚠️ Permanently delete hospital ${hospitalName}? This will also delete all associated data (beds, patients, doctors). This action cannot be undone.`)) return;

    try {
      // Note: Consider deleting subcollections as well if needed
      await deleteDoc(doc(db, 'hospitals', hospitalId));
      alert(`🗑️ Hospital ${hospitalName} has been deleted permanently.`);
      fetchAllData();
    } catch (error) {
      console.error('Error deleting hospital:', error);
      alert('Error: ' + error.message);
    }
  };

  // View Details Modal
  const viewDetails = (item, type) => {
    setSelectedItem(item);
    setSelectedItemType(type);
    setShowDetailsModal(true);
  };

  // Filter doctors based on search, status, and type
  const getFilteredDoctors = () => {
    let filtered = allDoctors;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(doctor =>
        doctor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.doctorId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filter by status
    if (selectedDoctorStatus !== 'all') {
      filtered = filtered.filter(doctor => doctor.status === selectedDoctorStatus);
    }
    
    // Filter by doctor type
    if (selectedDoctorType !== 'all') {
      filtered = filtered.filter(doctor => doctor.doctorType === selectedDoctorType);
    }
    
    return filtered;
  };

  // Filter hospitals based on search and status
  const getFilteredHospitals = () => {
    let filtered = allHospitals;
    
    if (searchTerm) {
      filtered = filtered.filter(hospital =>
        hospital.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.hospital_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.city?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedHospitalStatus !== 'all') {
      filtered = filtered.filter(hospital => hospital.status === selectedHospitalStatus);
    }
    
    return filtered;
  };

  // Get filtered pending approvals
  const getFilteredPending = () => {
    let filteredDoctors = pendingDoctors;
    let filteredHospitals = pendingHospitals;
    
    if (searchTerm) {
      filteredDoctors = filteredDoctors.filter(doctor =>
        doctor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.doctorId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      filteredHospitals = filteredHospitals.filter(hospital =>
        hospital.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.hospital_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return { filteredDoctors, filteredHospitals };
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('adminToken');
      navigate('/admin-login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Verifying admin access...</p>
      </div>
    );
  }

  const { filteredDoctors: pendingFilteredDoctors, filteredHospitals: pendingFilteredHospitals } = getFilteredPending();
  const filteredDoctors = getFilteredDoctors();
  const filteredHospitals = getFilteredHospitals();

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-header">
          <div 
            onClick={handleLogoClick}
            style={{ 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '15px'
            }}
            title="Go to Home"
          >
            <img 
              src="/images/logo.png" 
              alt="SwasthConnect Logo"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                marginBottom: '10px',
                border: '2px solid white'
              }}
              onError={(e) => {
                e.target.src = '/images/default-logo.png';
              }}
            />
            <h2 style={{ margin: 0, fontSize: '24px', color: 'white' }}>
              Swasth<span style={{ color: '#4CAF50' }}>Connect</span>
            </h2>
          </div>
          
          <div className="admin-info">
            <p><strong>{user?.name}</strong></p>
            <p>{user?.email}</p>
          </div>
        </div>

        <div className="admin-stats">
          <div className="stat-card">
            <h3>📊 System Stats</h3>
            <p>Total Doctors: {stats.totalDoctors}</p>
            <p>Total Hospitals: {stats.totalHospitals}</p>
            <p>🟡 Pending: {stats.pendingDoctors + stats.pendingHospitals}</p>
            <p>🟢 Approved: {stats.approvedDoctors + stats.approvedHospitals}</p>
            <p>🔴 Rejected: {stats.rejectedDoctors + stats.rejectedHospitals}</p>
            <hr />
            <p>🏥 Hospital Doctors: {stats.hospitalDoctors}</p>
            <p>🏪 Independent Docs: {stats.independentDoctors}</p>
          </div>
        </div>

        <nav className="admin-nav">
          <button 
            className={`nav-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('pending');
              setSearchTerm('');
            }}
          >
            ⏳ Pending Approvals ({stats.pendingDoctors + stats.pendingHospitals})
          </button>
          <button 
            className={`nav-btn ${activeTab === 'doctors' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('doctors');
              setSelectedDoctorStatus('all');
              setSelectedDoctorType('all');
            }}
          >
            👨‍⚕️ All Doctors ({stats.totalDoctors})
          </button>
          <button 
            className={`nav-btn ${activeTab === 'hospitals' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('hospitals');
              setSelectedHospitalStatus('all');
            }}
          >
            🏥 All Hospitals ({stats.totalHospitals})
          </button>
          <button 
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
          </button>
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          🔓 Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        {/* Search Bar */}
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by name, email, ID, specialization, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={fetchAllData} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>

        {/* Pending Approvals Tab */}
        {activeTab === 'pending' && (
          <div className="tab-content">
            <h3>⏳ Pending Approvals ({pendingDoctors.length + pendingHospitals.length})</h3>
            
            {/* Pending Doctors */}
            {pendingFilteredDoctors.length > 0 && (
              <div className="section">
                <h4>👨‍⚕️ Pending Doctors ({pendingFilteredDoctors.length})</h4>
                <div className="cards-container">
                  {pendingFilteredDoctors.map(doctor => (
                    <div key={doctor.id} className="card">
                      <div className="card-header">
                        <h4>{doctor.name}</h4>
                        <span className="badge pending">
                          {doctor.doctorType === 'hospital' ? '🏥 Hospital Doctor' : '🏪 Independent'}
                        </span>
                      </div>
                      <div className="card-body">
                        <p><strong>ID:</strong> {doctor.doctorId}</p>
                        <p><strong>Email:</strong> {doctor.email}</p>
                        <p><strong>Phone:</strong> {doctor.phone}</p>
                        <p><strong>Specialization:</strong> {doctor.specialization}</p>
                        <p><strong>Qualification:</strong> {doctor.qualification}</p>
                        <p><strong>Experience:</strong> {doctor.experience_years || doctor.totalExperienceYears} years</p>
                        {doctor.doctorType === 'hospital' && (
                          <>
                            <p><strong>🏥 Hospital:</strong> {doctor.hospitalName}</p>
                            <p><strong>Department:</strong> {doctor.department}</p>
                          </>
                        )}
                        {doctor.doctorType === 'independent' && (
                          <>
                            <p><strong>🏪 Clinic:</strong> {doctor.clinicName}</p>
                            <p><strong>📍 Location:</strong> {doctor.clinicCity}, {doctor.clinicState}</p>
                          </>
                        )}
                        <p><strong>📅 Applied:</strong> {new Date(doctor.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="card-actions">
                        <button 
                          className="btn-approve"
                          onClick={() => approveDoctor(doctor.id, doctor)}
                        >
                          ✅ Approve
                        </button>
                        <button 
                          className="btn-reject"
                          onClick={() => rejectDoctor(doctor.id, doctor)}
                        >
                          ❌ Reject
                        </button>
                        <button 
                          className="btn-view"
                          onClick={() => viewDetails(doctor, 'doctor')}
                        >
                          👁️ View Details
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => deleteDoctor(doctor.id, doctor.name)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Hospitals */}
            {pendingFilteredHospitals.length > 0 && (
              <div className="section">
                <h4>🏥 Pending Hospitals ({pendingFilteredHospitals.length})</h4>
                <div className="cards-container">
                  {pendingFilteredHospitals.map(hospital => (
                    <div key={hospital.id} className="card">
                      <div className="card-header">
                        <h4>{hospital.name}</h4>
                        <span className="badge pending">Pending</span>
                      </div>
                      <div className="card-body">
                        <p><strong>ID:</strong> {hospital.hospital_id}</p>
                        <p><strong>Email:</strong> {hospital.email}</p>
                        <p><strong>Phone:</strong> {hospital.phone}</p>
                        <p><strong>Type:</strong> {hospital.type}</p>
                        <p><strong>Address:</strong> {hospital.address}, {hospital.city}, {hospital.state}</p>
                        <p><strong>Admin:</strong> {hospital.admin_name} ({hospital.admin_mobile})</p>
                        <p><strong>Beds:</strong> Total: {hospital.total_beds || 0} | ICU: {hospital.icu_beds || 0}</p>
                        <p><strong>Facilities:</strong> {hospital.facilities?.join(', ') || 'None'}</p>
                        <p><strong>📅 Applied:</strong> {new Date(hospital.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="card-actions">
                        <button 
                          className="btn-approve"
                          onClick={() => approveHospital(hospital.id, hospital)}
                        >
                          ✅ Approve
                        </button>
                        <button 
                          className="btn-reject"
                          onClick={() => rejectHospital(hospital.id, hospital)}
                        >
                          ❌ Reject
                        </button>
                        <button 
                          className="btn-view"
                          onClick={() => viewDetails(hospital, 'hospital')}
                        >
                          👁️ View Details
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => deleteHospital(hospital.id, hospital.name)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingFilteredDoctors.length === 0 && pendingFilteredHospitals.length === 0 && (
              <div className="no-data">
                <p>✨ No pending approvals at this time.</p>
                <p>All systems are up to date!</p>
              </div>
            )}
          </div>
        )}

        {/* All Doctors Tab */}
        {activeTab === 'doctors' && (
          <div className="tab-content">
            <h3>👨‍⚕️ All Doctors ({stats.totalDoctors})</h3>
            
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${selectedDoctorStatus === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedDoctorStatus('all')}
              >
                All ({stats.totalDoctors})
              </button>
              <button 
                className={`filter-btn ${selectedDoctorStatus === 'approved' ? 'active' : ''}`}
                onClick={() => setSelectedDoctorStatus('approved')}
              >
                Approved ({stats.approvedDoctors})
              </button>
              <button 
                className={`filter-btn ${selectedDoctorStatus === 'pending' ? 'active' : ''}`}
                onClick={() => setSelectedDoctorStatus('pending')}
              >
                Pending ({stats.pendingDoctors})
              </button>
              <button 
                className={`filter-btn ${selectedDoctorStatus === 'rejected' ? 'active' : ''}`}
                onClick={() => setSelectedDoctorStatus('rejected')}
              >
                Rejected ({stats.rejectedDoctors})
              </button>
            </div>

            <div className="filter-buttons">
              <button 
                className={`filter-btn ${selectedDoctorType === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedDoctorType('all')}
              >
                All Types
              </button>
              <button 
                className={`filter-btn ${selectedDoctorType === 'hospital' ? 'active' : ''}`}
                onClick={() => setSelectedDoctorType('hospital')}
              >
                🏥 Hospital Doctors ({stats.hospitalDoctors})
              </button>
              <button 
                className={`filter-btn ${selectedDoctorType === 'independent' ? 'active' : ''}`}
                onClick={() => setSelectedDoctorType('independent')}
              >
                🏪 Independent Doctors ({stats.independentDoctors})
              </button>
            </div>

            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Specialization</th>
                    <th>Email</th>
                    <th>Hospital/Clinic</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map(doctor => (
                    <tr key={doctor.id}>
                      <td>{doctor.doctorId}</td>
                      <td><strong>{doctor.name}</strong></td>
                      <td>
                        <span style={{ fontSize: '12px' }}>
                          {doctor.doctorType === 'hospital' ? '🏥 Hospital' : '🏪 Independent'}
                        </span>
                      </td>
                      <td>{doctor.specialization}</td>
                      <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doctor.email}
                      </td>
                      <td>
                        {doctor.doctorType === 'hospital' 
                          ? doctor.hospitalName 
                          : doctor.clinicName}
                      </td>
                      <td>
                        <span className={`status-badge ${doctor.status}`}>
                          {doctor.status}
                        </span>
                      </td>
                      <td>{new Date(doctor.createdAt).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <button 
                          className="btn-view"
                          onClick={() => viewDetails(doctor, 'doctor')}
                        >
                          👁️ View
                        </button>
                        {doctor.status === 'pending' && (
                          <>
                            <button 
                              className="btn-approve"
                              onClick={() => approveDoctor(doctor.id, doctor)}
                            >
                              ✅
                            </button>
                            <button 
                              className="btn-reject"
                              onClick={() => rejectDoctor(doctor.id, doctor)}
                            >
                              ❌
                            </button>
                          </>
                        )}
                        <button 
                          className="btn-delete"
                          onClick={() => deleteDoctor(doctor.id, doctor.name)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Hospitals Tab */}
        {activeTab === 'hospitals' && (
          <div className="tab-content">
            <h3>🏥 All Hospitals ({stats.totalHospitals})</h3>
            
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${selectedHospitalStatus === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedHospitalStatus('all')}
              >
                All ({stats.totalHospitals})
              </button>
              <button 
                className={`filter-btn ${selectedHospitalStatus === 'approved' ? 'active' : ''}`}
                onClick={() => setSelectedHospitalStatus('approved')}
              >
                Approved ({stats.approvedHospitals})
              </button>
              <button 
                className={`filter-btn ${selectedHospitalStatus === 'pending' ? 'active' : ''}`}
                onClick={() => setSelectedHospitalStatus('pending')}
              >
                Pending ({stats.pendingHospitals})
              </button>
              <button 
                className={`filter-btn ${selectedHospitalStatus === 'rejected' ? 'active' : ''}`}
                onClick={() => setSelectedHospitalStatus('rejected')}
              >
                Rejected ({stats.rejectedHospitals})
              </button>
            </div>

            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>City</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHospitals.map(hospital => (
                    <tr key={hospital.id}>
                      <td>{hospital.hospital_id}</td>
                      <td><strong>{hospital.name}</strong></td>
                      <td>{hospital.type}</td>
                      <td>{hospital.city}</td>
                      <td>{hospital.email}</td>
                      <td>{hospital.phone}</td>
                      <td>
                        <span className={`status-badge ${hospital.status}`}>
                          {hospital.status}
                        </span>
                      </td>
                      <td>{new Date(hospital.createdAt).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <button 
                          className="btn-view"
                          onClick={() => viewDetails(hospital, 'hospital')}
                        >
                          👁️ View
                        </button>
                        {hospital.status === 'pending' && (
                          <>
                            <button 
                              className="btn-approve"
                              onClick={() => approveHospital(hospital.id, hospital)}
                            >
                              ✅
                            </button>
                            <button 
                              className="btn-reject"
                              onClick={() => rejectHospital(hospital.id, hospital)}
                            >
                              ❌
                            </button>
                          </>
                        )}
                        {hospital.status === 'approved' && (
                          <button 
                            className="btn-reject"
                            onClick={() => rejectHospital(hospital.id, hospital)}
                          >
                            🔄 Revoke
                          </button>
                        )}
                        <button 
                          className="btn-delete"
                          onClick={() => deleteHospital(hospital.id, hospital.name)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            <h3>⚙️ Admin Settings</h3>
            
            <div className="settings-section">
              <h4>System Settings</h4>
              <div className="setting-item">
                <label>
                  <input type="checkbox" defaultChecked />
                  Email notifications for new registrations
                </label>
              </div>
              <div className="setting-item">
                <label>
                  <input type="checkbox" defaultChecked />
                  Require admin approval for all registrations
                </label>
              </div>
              <div className="setting-item">
                <label>
                  <input type="checkbox" defaultChecked />
                  Auto-approve independent doctors (requires manual review)
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h4>Create New Admin</h4>
              <div className="form-group">
                <input type="email" placeholder="Admin email" className="form-input" />
                <input type="text" placeholder="Admin name" className="form-input" />
                <button className="btn-add-admin">➕ Add Admin</button>
              </div>
            </div>

            <div className="settings-section">
              <h4>System Information</h4>
              <div className="info-grid">
                <div className="info-item">
                  <strong>Total Users:</strong> {stats.totalDoctors + stats.totalHospitals}
                </div>
                <div className="info-item">
                  <strong>Doctors:</strong> {stats.totalDoctors} ({stats.hospitalDoctors} hospital, {stats.independentDoctors} independent)
                </div>
                <div className="info-item">
                  <strong>Hospitals:</strong> {stats.totalHospitals}
                </div>
                <div className="info-item">
                  <strong>Pending:</strong> {stats.pendingDoctors + stats.pendingHospitals}
                </div>
                <div className="info-item">
                  <strong>Approval Rate:</strong> {((stats.approvedDoctors + stats.approvedHospitals) / (stats.totalDoctors + stats.totalHospitals) * 100).toFixed(1)}%
                </div>
                <div className="info-item">
                  <strong>Firebase Project:</strong> SwasthConnect
                </div>
                <div className="info-item">
                  <strong>Last Updated:</strong> {new Date().toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedItemType === 'doctor' ? '👨‍⚕️ Doctor Details' : '🏥 Hospital Details'}
              </h3>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {selectedItemType === 'doctor' ? (
                <div className="details-grid">
                  <div><strong>Doctor ID:</strong> {selectedItem.doctorId}</div>
                  <div><strong>Name:</strong> {selectedItem.name}</div>
                  <div><strong>Email:</strong> {selectedItem.email}</div>
                  <div><strong>Phone:</strong> {selectedItem.phone}</div>
                  <div><strong>Gender:</strong> {selectedItem.gender || 'N/A'}</div>
                  <div><strong>Date of Birth:</strong> {selectedItem.dob || 'N/A'}</div>
                  <div><strong>Specialization:</strong> {selectedItem.specialization}</div>
                  <div><strong>Qualification:</strong> {selectedItem.qualification}</div>
                  <div><strong>Registration No:</strong> {selectedItem.registration_no}</div>
                  <div><strong>Experience:</strong> {selectedItem.experience_years || selectedItem.totalExperienceYears} years</div>
                  <div><strong>Consultation Fee:</strong> ₹{selectedItem.consultation_fee}</div>
                  <div><strong>Online Fee:</strong> ₹{selectedItem.online_fee || 0}</div>
                  <div><strong>OPD Days:</strong> {selectedItem.opd_days?.join(', ')}</div>
                  <div><strong>OPD Time:</strong> {selectedItem.opd_time}</div>
                  <div><strong>Doctor Type:</strong> {selectedItem.doctorType === 'hospital' ? '🏥 Hospital Doctor' : '🏪 Independent Doctor'}</div>
                  {selectedItem.doctorType === 'hospital' && (
                    <>
                      <div><strong>Hospital:</strong> {selectedItem.hospitalName}</div>
                      <div><strong>Hospital ID:</strong> {selectedItem.hospitalId}</div>
                      <div><strong>Department:</strong> {selectedItem.department}</div>
                    </>
                  )}
                  {selectedItem.doctorType === 'independent' && (
                    <>
                      <div><strong>Clinic Name:</strong> {selectedItem.clinicName}</div>
                      <div><strong>Clinic Address:</strong> {selectedItem.clinicAddress}</div>
                      <div><strong>City:</strong> {selectedItem.clinicCity}</div>
                      <div><strong>State:</strong> {selectedItem.clinicState}</div>
                      <div><strong>Pincode:</strong> {selectedItem.clinicPincode}</div>
                    </>
                  )}
                  <div><strong>Status:</strong> {selectedItem.status}</div>
                  <div><strong>Registered:</strong> {new Date(selectedItem.createdAt).toLocaleString()}</div>
                  {selectedItem.approvedAt && <div><strong>Approved:</strong> {new Date(selectedItem.approvedAt).toLocaleString()}</div>}
                  {selectedItem.rejectionReason && <div><strong>Rejection Reason:</strong> {selectedItem.rejectionReason}</div>}
                </div>
              ) : (
                <div className="details-grid">
                  <div><strong>Hospital ID:</strong> {selectedItem.hospital_id}</div>
                  <div><strong>Name:</strong> {selectedItem.name}</div>
                  <div><strong>Email:</strong> {selectedItem.email}</div>
                  <div><strong>Phone:</strong> {selectedItem.phone}</div>
                  <div><strong>Emergency Phone:</strong> {selectedItem.emergency_phone || 'N/A'}</div>
                  <div><strong>Type:</strong> {selectedItem.type}</div>
                  <div><strong>Registration Number:</strong> {selectedItem.registration_number}</div>
                  <div><strong>GST Number:</strong> {selectedItem.gst_number || 'N/A'}</div>
                  <div><strong>Year Established:</strong> {selectedItem.year_established}</div>
                  <div><strong>Address:</strong> {selectedItem.address}</div>
                  <div><strong>City:</strong> {selectedItem.city}</div>
                  <div><strong>State:</strong> {selectedItem.state}</div>
                  <div><strong>Pincode:</strong> {selectedItem.pincode}</div>
                  <div><strong>Admin Name:</strong> {selectedItem.admin_name}</div>
                  <div><strong>Admin Mobile:</strong> {selectedItem.admin_mobile}</div>
                  <div><strong>Total Beds:</strong> {selectedItem.total_beds || 0}</div>
                  <div><strong>ICU Beds:</strong> {selectedItem.icu_beds || 0}</div>
                  <div><strong>General Beds:</strong> {selectedItem.general_beds || 0}</div>
                  <div><strong>Private Rooms:</strong> {selectedItem.private_rooms || 0}</div>
                  <div><strong>Facilities:</strong> {selectedItem.facilities?.join(', ') || 'None'}</div>
                  <div><strong>Status:</strong> {selectedItem.status}</div>
                  <div><strong>Registered:</strong> {new Date(selectedItem.createdAt).toLocaleString()}</div>
                  {selectedItem.approvedAt && <div><strong>Approved:</strong> {new Date(selectedItem.approvedAt).toLocaleString()}</div>}
                  {selectedItem.rejectionReason && <div><strong>Rejection Reason:</strong> {selectedItem.rejectionReason}</div>}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-close" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;