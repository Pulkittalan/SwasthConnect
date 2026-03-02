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
  getDoc
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
  const [stats, setStats] = useState({
    totalDoctors: 0,
    totalHospitals: 0,
    pendingDoctors: 0,
    pendingHospitals: 0,
    approvedDoctors: 0,
    approvedHospitals: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
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

        // Check if user is admin (you can store admin emails/UIDs in Firestore)
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        
        if (!adminDoc.exists()) {
          // Alternative: Check by email
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
      // Fetch pending doctors
      const pendingDoctorsQuery = query(
        collection(db, 'doctors'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const pendingDoctorsSnap = await getDocs(pendingDoctorsQuery);
      const pendingDocs = pendingDoctorsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingDoctors(pendingDocs);

      // Fetch pending hospitals
      const pendingHospitalsQuery = query(
        collection(db, 'hospitals'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const pendingHospitalsSnap = await getDocs(pendingHospitalsQuery);
      const pendingHospitalsData = pendingHospitalsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingHospitals(pendingHospitalsData);

      // Fetch approved doctors
      const approvedDoctorsQuery = query(
        collection(db, 'doctors'),
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc')
      );
      const approvedDoctorsSnap = await getDocs(approvedDoctorsQuery);
      const approvedDocs = approvedDoctorsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setApprovedDoctors(approvedDocs);

      // Fetch approved hospitals
      const approvedHospitalsQuery = query(
        collection(db, 'hospitals'),
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc')
      );
      const approvedHospitalsSnap = await getDocs(approvedHospitalsQuery);
      const approvedHospitalsData = approvedHospitalsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setApprovedHospitals(approvedHospitalsData);

      // Update stats
      setStats({
        totalDoctors: pendingDocs.length + approvedDocs.length,
        totalHospitals: pendingHospitalsData.length + approvedHospitalsData.length,
        pendingDoctors: pendingDocs.length,
        pendingHospitals: pendingHospitalsData.length,
        approvedDoctors: approvedDocs.length,
        approvedHospitals: approvedHospitalsData.length
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
        approvedBy: user.email
      });

      alert(`✅ Doctor ${doctorData.name} approved!`);
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
        rejectedBy: user.email
      });

      alert(`❌ Doctor ${doctorData.name} rejected.`);
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
        approvedBy: user.email
      });

      alert(`✅ Hospital ${hospitalData.name} approved!`);
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
        rejectedBy: user.email
      });

      alert(`❌ Hospital ${hospitalData.name} rejected.`);
      fetchAllData();
    } catch (error) {
      console.error('Error rejecting hospital:', error);
      alert('Error: ' + error.message);
    }
  };

  // Delete Doctor (Only for admins)
  const deleteDoctor = async (doctorId, doctorName) => {
    if (!window.confirm(`Permanently delete doctor ${doctorName}? This cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, 'doctors', doctorId));
      alert(`🗑️ Doctor ${doctorName} deleted.`);
      fetchAllData();
    } catch (error) {
      console.error('Error deleting doctor:', error);
      alert('Error: ' + error.message);
    }
  };

  // Delete Hospital
  const deleteHospital = async (hospitalId, hospitalName) => {
    if (!window.confirm(`Permanently delete hospital ${hospitalName}? This cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, 'hospitals', hospitalId));
      alert(`🗑️ Hospital ${hospitalName} deleted.`);
      fetchAllData();
    } catch (error) {
      console.error('Error deleting hospital:', error);
      alert('Error: ' + error.message);
    }
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

  // Filter data based on search
  const filteredPendingDoctors = pendingDoctors.filter(doctor =>
    doctor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.doctor_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPendingHospitals = pendingHospitals.filter(hospital =>
    hospital.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.hospital_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredApprovedDoctors = approvedDoctors.filter(doctor =>
    doctor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.doctor_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredApprovedHospitals = approvedHospitals.filter(hospital =>
    hospital.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.hospital_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Verifying admin access...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-header">
          {/* Logo and Brand - Clickable */}
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
            <h3>📊 Stats</h3>
            <p>Doctors: {stats.totalDoctors}</p>
            <p>Hospitals: {stats.totalHospitals}</p>
            <p>Pending: {stats.pendingDoctors + stats.pendingHospitals}</p>
            <p>Approved: {stats.approvedDoctors + stats.approvedHospitals}</p>
          </div>
        </div>

        <nav className="admin-nav">
          <button 
            className={`nav-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            ⏳ Pending Approvals
          </button>
          <button 
            className={`nav-btn ${activeTab === 'doctors' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctors')}
          >
            👨‍⚕️ All Doctors
          </button>
          <button 
            className={`nav-btn ${activeTab === 'hospitals' ? 'active' : ''}`}
            onClick={() => setActiveTab('hospitals')}
          >
            🏥 All Hospitals
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
            placeholder="Search by name, email, or ID..."
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
            <h3>⏳ Pending Approvals</h3>
            
            {/* Pending Doctors */}
            <div className="section">
              <h4>👨‍⚕️ Pending Doctors ({pendingDoctors.length})</h4>
              {filteredPendingDoctors.length === 0 ? (
                <p className="no-data">No pending doctors found.</p>
              ) : (
                <div className="cards-container">
                  {filteredPendingDoctors.map(doctor => (
                    <div key={doctor.id} className="card">
                      <div className="card-header">
                        <h4>{doctor.name}</h4>
                        <span className="badge pending">Pending</span>
                      </div>
                      <div className="card-body">
                        <p><strong>ID:</strong> {doctor.doctor_id}</p>
                        <p><strong>Email:</strong> {doctor.email}</p>
                        <p><strong>Specialization:</strong> {doctor.specialization}</p>
                        <p><strong>Registration No:</strong> {doctor.registration_no}</p>
                        <p><strong>Applied:</strong> {new Date(doctor.createdAt).toLocaleDateString()}</p>
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
                          className="btn-delete"
                          onClick={() => deleteDoctor(doctor.id, doctor.name)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Hospitals */}
            <div className="section">
              <h4>🏥 Pending Hospitals ({pendingHospitals.length})</h4>
              {filteredPendingHospitals.length === 0 ? (
                <p className="no-data">No pending hospitals found.</p>
              ) : (
                <div className="cards-container">
                  {filteredPendingHospitals.map(hospital => (
                    <div key={hospital.id} className="card">
                      <div className="card-header">
                        <h4>{hospital.name}</h4>
                        <span className="badge pending">Pending</span>
                      </div>
                      <div className="card-body">
                        <p><strong>ID:</strong> {hospital.hospital_id}</p>
                        <p><strong>Email:</strong> {hospital.email}</p>
                        <p><strong>Type:</strong> {hospital.type}</p>
                        <p><strong>Address:</strong> {hospital.address}, {hospital.city}</p>
                        <p><strong>Admin:</strong> {hospital.admin_name}</p>
                        <p><strong>Applied:</strong> {new Date(hospital.createdAt).toLocaleDateString()}</p>
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
                          className="btn-delete"
                          onClick={() => deleteHospital(hospital.id, hospital.name)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* All Doctors Tab */}
        {activeTab === 'doctors' && (
          <div className="tab-content">
            <h3>👨‍⚕️ All Doctors ({stats.totalDoctors})</h3>
            
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${activeTab === 'doctors' ? 'active' : ''}`}
                onClick={() => setActiveTab('doctors')}
              >
                All ({stats.totalDoctors})
              </button>
              <button className="filter-btn">
                Approved ({stats.approvedDoctors})
              </button>
              <button className="filter-btn">
                Pending ({stats.pendingDoctors})
              </button>
            </div>

            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Specialization</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovedDoctors.map(doctor => (
                    <tr key={doctor.id}>
                      <td>{doctor.doctor_id}</td>
                      <td>{doctor.name}</td>
                      <td>{doctor.email}</td>
                      <td>{doctor.specialization}</td>
                      <td>
                        <span className={`status-badge ${doctor.status}`}>
                          {doctor.status}
                        </span>
                      </td>
                      <td>{new Date(doctor.createdAt).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <button 
                          className="btn-view"
                          onClick={() => alert(`View details for ${doctor.name}`)}
                        >
                          👁️ View
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => deleteDoctor(doctor.id, doctor.name)}
                        >
                          🗑️ Delete
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
            
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>City</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovedHospitals.map(hospital => (
                    <tr key={hospital.id}>
                      <td>{hospital.hospital_id}</td>
                      <td>{hospital.name}</td>
                      <td>{hospital.email}</td>
                      <td>{hospital.type}</td>
                      <td>{hospital.city}</td>
                      <td>
                        <span className={`status-badge ${hospital.status}`}>
                          {hospital.status}
                        </span>
                      </td>
                      <td>{new Date(hospital.createdAt).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <button 
                          className="btn-view"
                          onClick={() => alert(`View details for ${hospital.name}`)}
                        >
                          👁️ View
                        </button>
                        {hospital.status === 'approved' ? (
                          <button 
                            className="btn-reject"
                            onClick={() => rejectHospital(hospital.id, hospital)}
                          >
                            ❌ Revoke
                          </button>
                        ) : (
                          <button 
                            className="btn-approve"
                            onClick={() => approveHospital(hospital.id, hospital)}
                          >
                            ✅ Approve
                          </button>
                        )}
                        <button 
                          className="btn-delete"
                          onClick={() => deleteHospital(hospital.id, hospital.name)}
                        >
                          🗑️ Delete
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
    </div>
  );
};

export default AdminDashboard;