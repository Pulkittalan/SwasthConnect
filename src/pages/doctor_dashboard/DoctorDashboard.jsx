import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import VideoCall from '../../components/videocall/VideoCall';
import Chat from '../../components/Chat/Chat';
import './DoctorDashboard.css';

const DoctorDashboard = () => {
  const { currentUser } = useAuth();
  
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');
  const [doctorData, setDoctorData] = useState(null);
  const [doctorType, setDoctorType] = useState(null);
  const [doctorId, setDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [prescription, setPrescription] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [stats, setStats] = useState({
    totalAppointments: 0,
    completedAppointments: 0,
    pendingAppointments: 0,
    totalPatients: 0,
    averageRating: 0
  });
  
  // Video call and chat states
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [activeCallRoom, setActiveCallRoom] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [selectedPatientForChat, setSelectedPatientForChat] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState({});

  // Fetch doctor data
  useEffect(() => {
    const fetchDoctorData = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        
        const doctorsRef = collection(db, 'doctors');
        const q = query(doctorsRef, where('uid', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const doctorDoc = querySnapshot.docs[0];
          const data = doctorDoc.data();
          setDoctorData(data);
          setDoctorType(data.type || 'independent');
          setDoctorId(doctorDoc.id);
          
          await fetchAppointments(doctorDoc.id, data.type || 'independent');
          await fetchPatients(doctorDoc.id);
          await fetchReviews(doctorDoc.id);
          await calculateStats(doctorDoc.id);
        } else {
          console.log('Doctor not found in doctors collection');
        }
      } catch (error) {
        console.error('Error fetching doctor data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoctorData();
  }, [currentUser]);
  
  const fetchAppointments = async (doctorIdParam, doctorTypeParam) => {
    if (!doctorIdParam || !doctorTypeParam) return;
    
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('doctorId', '==', doctorIdParam),
        where('doctorType', '==', doctorTypeParam)
      );
      const snapshot = await getDocs(q);
      const appointmentsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAppointments(appointmentsList);
      return appointmentsList;
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
  };
  
  const fetchPatients = async (doctorIdParam) => {
    if (!doctorIdParam) return;
    
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef, where('doctorId', '==', doctorIdParam));
      const snapshot = await getDocs(q);
      
      // Get unique patient IDs - check both 'patientId' and 'userId' fields
      const patientIds = [...new Set(
        snapshot.docs.map(doc => {
          const data = doc.data();
          return data.patientId || data.userId; // Support both field names
        }).filter(Boolean)
      )];
      
      const patientsList = [];
      for (const patientId of patientIds) {
        try {
          const patientRef = doc(db, 'users', patientId);
          const patientSnap = await getDoc(patientRef);
          if (patientSnap.exists()) {
            patientsList.push({
              id: patientId,
              ...patientSnap.data()
            });
          } else {
            // If user document doesn't exist, still add patient with basic info
            const appointment = snapshot.docs.find(doc => 
              (doc.data().patientId === patientId || doc.data().userId === patientId)
            )?.data();
            patientsList.push({
              id: patientId,
              displayName: appointment?.patientName || 'Patient',
              email: appointment?.patientEmail || 'N/A'
            });
          }
        } catch (err) {
          console.error('Error fetching patient:', patientId, err);
        }
      }
      setPatients(patientsList);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };
  
  const fetchReviews = async (doctorIdParam) => {
    if (!doctorIdParam) return;
    
    try {
      const reviewsRef = collection(db, 'reviews');
      const q = query(reviewsRef, where('doctorId', '==', doctorIdParam));
      const snapshot = await getDocs(q);
      const reviewsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReviews(reviewsList);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };
  
  const calculateStats = async (doctorIdParam) => {
    if (!doctorIdParam) return;
    
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef, where('doctorId', '==', doctorIdParam));
      const snapshot = await getDocs(q);
      const appointmentsList = snapshot.docs.map(doc => doc.data());
      
      const total = appointmentsList.length;
      const completed = appointmentsList.filter(a => a.status === 'completed').length;
      const pending = appointmentsList.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length;
      const uniquePatients = new Set(
        appointmentsList.map(a => a.patientId || a.userId).filter(Boolean)
      ).size;
      
      let avgRating = 0;
      try {
        const reviewsRef = collection(db, 'reviews');
        const reviewsQ = query(reviewsRef, where('doctorId', '==', doctorIdParam));
        const reviewsSnapshot = await getDocs(reviewsQ);
        const reviewsList = reviewsSnapshot.docs.map(doc => doc.data());
        if (reviewsList.length > 0) {
          avgRating = reviewsList.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsList.length;
        }
      } catch (err) {
        console.error('Error fetching reviews for stats:', err);
      }
      
      setStats({
        totalAppointments: total,
        completedAppointments: completed,
        pendingAppointments: pending,
        totalPatients: uniquePatients,
        averageRating: avgRating
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };
  
  // Get patient ID from appointment (supports both field names)
  const getPatientId = (appointment) => {
    return appointment.patientId || appointment.userId;
  };
  
  // Initialize chat for a patient
  const initChat = async (patientId, patientName) => {
    console.log('initChat called with:', { patientId, patientName, currentUser: currentUser?.uid });
    
    if (!currentUser) {
      console.error('No current user');
      alert('Please login again');
      return;
    }
    
    if (!patientId) {
      console.error('No patientId provided');
      alert('Invalid patient information');
      return;
    }
    
    try {
      const chatId = [currentUser.uid, patientId].sort().join('_');
      console.log('Chat ID:', chatId);
      
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [currentUser.uid, patientId],
          participantNames: {
            [currentUser.uid]: doctorData?.name || 'Doctor',
            [patientId]: patientName || 'Patient'
          },
          participantTypes: {
            [currentUser.uid]: 'doctor',
            [patientId]: 'patient'
          },
          createdAt: new Date(),
          lastMessage: '',
          lastMessageTime: new Date(),
          unreadCount: {
            [currentUser.uid]: 0,
            [patientId]: 0
          }
        });
        console.log('Created new chat document');
      }
      
      setActiveChat(chatId);
      setSelectedPatientForChat({ id: patientId, name: patientName || 'Patient' });
      setShowChat(true);
    } catch (error) {
      console.error('Error initializing chat:', error);
      alert('Failed to start chat. Please try again.');
    }
  };
  
  // Initialize video call
  const initVideoCall = async (patientId, patientName) => {
    console.log('initVideoCall called with:', { patientId, patientName });
    
    if (!currentUser) {
      console.error('No current user');
      alert('Please login again');
      return;
    }
    
    if (!patientId) {
      console.error('No patientId provided');
      alert('Invalid patient information');
      return;
    }
    
    try {
      const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const callRef = doc(db, 'calls', roomId);
      
      await setDoc(callRef, {
        roomId,
        initiator: currentUser.uid,
        initiatorName: doctorData?.name || 'Doctor',
        initiatorType: 'doctor',
        participant: patientId,
        participantName: patientName || 'Patient',
        status: 'waiting',
        createdAt: new Date()
      });
      
      setActiveCallRoom(roomId);
      setShowVideoCall(true);
    } catch (error) {
      console.error('Error initiating video call:', error);
      alert('Failed to start video call. Please try again.');
    }
  };
  
  // Listen for incoming calls
  useEffect(() => {
  if (!currentUser) return;
  
  const callsQuery = query(
    collection(db, 'calls'),
    where('participant', '==', currentUser.uid),
    where('status', '==', 'waiting')
  );
  
  const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const call = change.doc.data();
        // Replace window.confirm with a custom alert or auto-accept for testing
        // For now, auto-accept the call
        console.log(`Incoming call from ${call.initiatorName}`);
        setActiveCallRoom(call.roomId);
        setShowVideoCall(true);
      }
    });
  });
  
  return () => unsubscribe();
}, [currentUser]);
  
  const handleStartConsultation = (appointment) => {
    console.log('Starting consultation with:', appointment);
    setSelectedPatient(appointment);
    setActiveTab('consultation');
  };
  
  const handleSavePrescription = async () => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }
    
    if (!prescription.trim()) {
      alert('Please write a prescription');
      return;
    }
    
    setSavingPrescription(true);
    
    try {
      const prescriptionsRef = collection(db, 'prescriptions');
      await addDoc(prescriptionsRef, {
        doctorId: doctorId,
        patientId: getPatientId(selectedPatient),
        doctorName: doctorData?.name,
        patientName: selectedPatient.patientName,
        prescriptionText: prescription,
        medications: prescription.split('\n').filter(line => line.trim() && !line.toLowerCase().includes('instructions:') && !line.toLowerCase().includes('diagnosis:')),
        diagnosis: selectedPatient.reason || '',
        appointmentId: selectedPatient.id,
        createdAt: new Date(),
        createdBy: doctorId
      });
      
      alert('Prescription saved successfully!');
      setPrescription('');
    } catch (error) {
      console.error('Error saving prescription:', error);
      alert('Failed to save prescription');
    } finally {
      setSavingPrescription(false);
    }
  };
  
  const toggleOnlineStatus = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    try {
      if (doctorId) {
        const doctorRef = doc(db, 'doctors', doctorId);
        await updateDoc(doctorRef, {
          isOnline: newStatus,
          lastSeen: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };
  
  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'scheduled': return 'status-scheduled';
      case 'confirmed': return 'status-confirmed';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-scheduled';
    }
  };
  
  if (loading) {
    return (
      <div className="doctor-dashboard">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginLeft: '15px' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="doctor-dashboard">
      {/* Video Call Modal */}
      {showVideoCall && activeCallRoom && (
        <div className="modal-overlay">
          <div className="modal-content video-call-modal">
            <button 
              className="modal-close"
              onClick={() => {
                setShowVideoCall(false);
                setActiveCallRoom(null);
              }}
            >
              ×
            </button>
            <VideoCall 
              roomId={activeCallRoom}
              currentUser={currentUser}
              userType="doctor"
              userName={doctorData?.name || "Doctor"}
              onClose={() => {
                setShowVideoCall(false);
                setActiveCallRoom(null);
              }}
            />
          </div>
        </div>
      )}
      
      {/* Chat Modal */}
      {showChat && activeChat && selectedPatientForChat && (
        <div className="modal-overlay">
          <div className="modal-content chat-modal">
            <button 
              className="modal-close"
              onClick={() => {
                setShowChat(false);
                setActiveChat(null);
                setSelectedPatientForChat(null);
              }}
            >
              ×
            </button>
            <Chat 
              chatId={activeChat}
              currentUser={currentUser}
              otherUser={selectedPatientForChat}
              userType="doctor"
              onVideoCall={() => {
                setShowChat(false);
                if (selectedPatientForChat) {
                  initVideoCall(selectedPatientForChat.id, selectedPatientForChat.name);
                }
              }}
            />
          </div>
        </div>
      )}
      
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Doctor Dashboard</h1>
          <div className="doctor-info">
            <img 
              src={doctorData?.profilePhoto || "https://cdn-icons-png.flaticon.com/512/3304/3304567.png"} 
              alt="Doctor" 
              className="doctor-avatar"
              onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/512/3304/3304567.png"; }}
            />
            <div>
              <h3>Dr. {doctorData?.name || 'Doctor'}</h3>
              <p>{doctorData?.specialization || 'General Physician'}</p>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button onClick={toggleOnlineStatus} className={`status-toggle-btn ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </header>
      
      <div className="dashboard-container">
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            <button className={`nav-btn ${activeTab === 'appointments' ? 'active' : ''}`} onClick={() => setActiveTab('appointments')}>
              📅 Appointments ({stats.pendingAppointments})
            </button>
            <button className={`nav-btn ${activeTab === 'consultation' ? 'active' : ''}`} onClick={() => setActiveTab('consultation')}>
              📋 Consultation
            </button>
            <button className={`nav-btn ${activeTab === 'prescription' ? 'active' : ''}`} onClick={() => setActiveTab('prescription')}>
              📝 Prescription
            </button>
            <button className={`nav-btn ${activeTab === 'patients' ? 'active' : ''}`} onClick={() => setActiveTab('patients')}>
              👥 My Patients ({stats.totalPatients})
            </button>
            <button className={`nav-btn ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
              ⭐ Reviews ({reviews.length})
            </button>
            <button className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              👤 Profile
            </button>
          </nav>
          
          <div className="quick-stats">
            <h4>Today's Stats</h4>
            <div className="stat-item"><span className="stat-label">Appointments:</span><span className="stat-value">{stats.totalAppointments}</span></div>
            <div className="stat-item"><span className="stat-label">Completed:</span><span className="stat-value">{stats.completedAppointments}</span></div>
            <div className="stat-item"><span className="stat-label">Pending:</span><span className="stat-value">{stats.pendingAppointments}</span></div>
            <div className="stat-item"><span className="stat-label">Total Patients:</span><span className="stat-value">{stats.totalPatients}</span></div>
            <div className="stat-item"><span className="stat-label">Rating:</span><span className="stat-value">⭐ {stats.averageRating.toFixed(1)}</span></div>
          </div>
        </aside>
        
        <main className="dashboard-main">
          {/* Appointments Tab */}
          {activeTab === 'appointments' && (
            <div className="tab-content">
              <h2>Upcoming Appointments</h2>
              <div className="appointments-grid">
                {appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed').map(appointment => {
                  const patientId = getPatientId(appointment);
                  return (
                    <div key={appointment.id} className="appointment-card">
                      <div className="appointment-info">
                        <h4>{appointment.patientName || 'Patient'}</h4>
                        <p className="appointment-time">{appointment.date} at {appointment.time}</p>
                        <p className="appointment-type">{appointment.reason || 'Consultation'}</p>
                        <span className={`status-badge ${getStatusBadgeClass(appointment.status)}`}>{appointment.status}</span>
                      </div>
                      <div className="appointment-actions">
                        <button className="start-consultation-btn" onClick={() => handleStartConsultation(appointment)}>Start Consultation</button>
                        <button className="video-call-btn" onClick={() => initVideoCall(patientId, appointment.patientName)}>📹 Video Call</button>
                        <button className="chat-btn" onClick={() => initChat(patientId, appointment.patientName)}>
                          💬 Chat
                          {unreadMessages[patientId] > 0 && <span className="unread-count">{unreadMessages[patientId]}</span>}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length === 0 && (
                  <p className="empty-state">No upcoming appointments</p>
                )}
              </div>
              
              <h2 style={{ marginTop: '40px' }}>Past Appointments</h2>
              <div className="appointments-grid">
                {appointments.filter(a => a.status === 'completed' || a.status === 'cancelled').map(appointment => {
                  const patientId = getPatientId(appointment);
                  return (
                    <div key={appointment.id} className="appointment-card">
                      <div className="appointment-info">
                        <h4>{appointment.patientName || 'Patient'}</h4>
                        <p className="appointment-time">{appointment.date} at {appointment.time}</p>
                        <span className={`status-badge ${getStatusBadgeClass(appointment.status)}`}>{appointment.status}</span>
                      </div>
                      <div className="appointment-actions">
                        <button className="start-consultation-btn" onClick={() => { setSelectedPatient(appointment); setActiveTab('prescription'); }} style={{ background: '#95a5a6' }}>Write Prescription</button>
                        <button className="chat-btn" onClick={() => initChat(patientId, appointment.patientName)}>
                          💬 Chat
                          {unreadMessages[patientId] > 0 && <span className="unread-count">{unreadMessages[patientId]}</span>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Consultation Tab */}
          {activeTab === 'consultation' && (
            <div className="tab-content consultation-tab">
              <h2>Patient Consultation</h2>
              {selectedPatient ? (
                <div>
                  <div className="consultation-header">
                    <h3>Consultation with {selectedPatient.patientName}</h3>
                    <p>Date: {selectedPatient.date} at {selectedPatient.time}</p>
                  </div>
                  <div className="consultation-info">
                    <h4>Patient Information</h4>
                    <p><strong>Name:</strong> {selectedPatient.patientName}</p>
                    <p><strong>Reason:</strong> {selectedPatient.reason || 'General consultation'}</p>
                  </div>
                  <div className="consultation-actions">
                    <button className="action-btn" onClick={() => initVideoCall(getPatientId(selectedPatient), selectedPatient.patientName)}>📹 Start Video Call</button>
                    <button className="action-btn" onClick={() => initChat(getPatientId(selectedPatient), selectedPatient.patientName)}>💬 Open Chat</button>
                    <button className="action-btn" onClick={() => setActiveTab('prescription')}>📝 Write Prescription</button>
                    <button className="action-btn" onClick={() => setActiveTab('appointments')}>← Back to Appointments</button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <p>Select an appointment to start consultation</p>
                  <button className="action-btn" onClick={() => setActiveTab('appointments')}>View Appointments</button>
                </div>
              )}
            </div>
          )}
          
          {/* Prescription Tab */}
          {activeTab === 'prescription' && (
            <div className="tab-content">
              <h2>Prescription Editor</h2>
              {selectedPatient ? (
                <div className="prescription-editor">
                  <div className="prescription-header">
                    <div><h4>Patient: {selectedPatient.patientName}</h4><p>Date: {new Date().toLocaleDateString()}</p></div>
                    <div className="prescription-actions">
                      <button className="save-btn" onClick={handleSavePrescription} disabled={savingPrescription}>{savingPrescription ? 'Saving...' : 'Save Prescription'}</button>
                      <button className="print-btn" onClick={() => window.print()}>Print</button>
                    </div>
                  </div>
                  <textarea className="prescription-textarea" value={prescription} onChange={(e) => setPrescription(e.target.value)} placeholder="Write prescription here..." rows={15} />
                  <div className="template-buttons">
                    <h4>Quick Templates:</h4>
                    <div className="template-grid">
                      <button className="template-btn" onClick={() => setPrescription(prev => prev + '\n\nFever: Paracetamol 500mg - 1 tablet every 6 hours\nRest and hydration')}>Fever</button>
                      <button className="template-btn" onClick={() => setPrescription(prev => prev + '\n\nCough: Cough Syrup - 10ml 3 times daily\nHoney with warm water')}>Cough</button>
                      <button className="template-btn" onClick={() => setPrescription(prev => prev + '\n\nPain: Ibuprofen 200mg - As needed\nRest the affected area')}>Pain</button>
                      <button className="template-btn" onClick={() => setPrescription(prev => prev + '\n\nAntibiotic: Amoxicillin 250mg - 3 times daily for 7 days\nComplete full course')}>Antibiotic</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state"><p>Select a patient to write prescription</p><button className="action-btn" onClick={() => setActiveTab('appointments')}>Go to Appointments</button></div>
              )}
            </div>
          )}
          
          {/* Patients Tab */}
          {activeTab === 'patients' && (
            <div className="tab-content">
              <h2>My Patients</h2>
              <div className="patients-table">
                <table>
                  <thead><tr><th>Patient Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
                  <tbody>
                    {patients.map(patient => (
                      <tr key={patient.id}>
                        <td>{patient.displayName || patient.name || 'Patient'}</td>
                        <td>{patient.email || 'N/A'}</td>
                        <td>{patient.phone || 'N/A'}</td>
                        <td>
                          <button className="action-small" onClick={() => { const apt = appointments.find(a => getPatientId(a) === patient.id); if (apt) { setSelectedPatient(apt); setActiveTab('prescription'); } else { alert('No appointment found'); } }}>Prescribe</button>
                          <button className="action-small chat-action" onClick={() => initChat(patient.id, patient.displayName || patient.name)}>💬 Chat{unreadMessages[patient.id] > 0 && <span className="unread-count-small">{unreadMessages[patient.id]}</span>}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {patients.length === 0 && <p className="empty-state">No patients yet</p>}
              </div>
            </div>
          )}
          
          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="tab-content">
              <h2>Patient Reviews</h2>
              {reviews.length > 0 ? reviews.map(review => (
                <div key={review.id} className="review-card">
                  <div className="review-header"><strong>{review.patientName}</strong><span className="review-rating">{'⭐'.repeat(Math.floor(review.rating || 0))} ({(review.rating || 0).toFixed(1)})</span></div>
                  <p className="review-comment">{review.comment}</p>
                  <small className="review-date">{review.createdAt?.toDate?.()?.toLocaleDateString() || 'Recent'}</small>
                </div>
              )) : <div className="empty-state"><p>No reviews yet</p></div>}
            </div>
          )}
          
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="tab-content">
              <h2>Doctor Profile</h2>
              <div className="profile-view">
                <div className="profile-header">
                  <img src={doctorData?.profilePhoto || "https://cdn-icons-png.flaticon.com/512/3304/3304567.png"} alt="Profile" className="profile-avatar" />
                  <div><h3>Dr. {doctorData?.name || 'Doctor'}</h3><p>{doctorData?.specialization || 'General Physician'}</p></div>
                </div>
                <div className="profile-details">
                  <p><strong>Email:</strong> {doctorData?.email || currentUser?.email}</p>
                  <p><strong>Phone:</strong> {doctorData?.phone || 'Not set'}</p>
                  <p><strong>Qualification:</strong> {doctorData?.qualification || 'MBBS'}</p>
                  <p><strong>Experience:</strong> {doctorData?.experience || doctorData?.experience_years || 0} years</p>
                  <p><strong>Consultation Fee:</strong> ₹{doctorData?.consultationFee || doctorData?.consultation_fee || 500}</p>
                  <p><strong>About:</strong> {doctorData?.about || doctorData?.bio || 'No description'}</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DoctorDashboard;