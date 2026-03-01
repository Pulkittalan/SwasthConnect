import React, { useState, useEffect } from 'react';
import './DoctorDashboard.css';

const DoctorDashboard = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');
  const [prescription, setPrescription] = useState('');
  const [appointments, setAppointments] = useState([
    { id: 1, patient: 'John Doe', time: '10:00 AM', date: '2024-01-15', type: 'Video Consultation' },
    { id: 2, patient: 'Jane Smith', time: '11:30 AM', date: '2024-01-15', type: 'In-person' },
    { id: 3, patient: 'Robert Johnson', time: '02:00 PM', date: '2024-01-15', type: 'Video Consultation' },
    { id: 4, patient: 'Sarah Williams', time: '03:30 PM', date: '2024-01-15', type: 'Follow-up' },
  ]);

  // Sample chat messages
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'patient', text: 'Hello Doctor, I have a headache', time: '09:30 AM' },
    { id: 2, sender: 'doctor', text: 'Hello, when did it start?', time: '09:32 AM' },
    { id: 3, sender: 'patient', text: 'Since yesterday morning', time: '09:35 AM' },
  ]);

  const [newMessage, setNewMessage] = useState('');

  const handleStartConsultation = (appointmentId) => {
    alert(`Starting consultation for appointment ${appointmentId}`);
    // In real app, this would start video consultation
    setActiveTab('consultation');
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const newMsg = {
        id: chatMessages.length + 1,
        sender: 'doctor',
        text: newMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages([...chatMessages, newMsg]);
      setNewMessage('');
    }
  };

  const handleSavePrescription = () => {
    alert('Prescription saved successfully!');
    // In real app, save to backend
  };

  const handlePrintPrescription = () => {
    window.print();
  };

  const toggleOnlineStatus = () => {
    setIsOnline(!isOnline);
  };

  return (
    <div className="doctor-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Doctor Dashboard</h1>
          <div className="doctor-info">
            <img 
              src="https://cdn-icons-png.flaticon.com/512/3304/3304567.png" 
              alt="Doctor" 
              className="doctor-avatar"
            />
            <div>
              <h3>Dr. Smith Johnson</h3>
              <p>Cardiologist</p>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button 
            onClick={toggleOnlineStatus}
            className={`status-toggle-btn ${isOnline ? 'online' : 'offline'}`}
          >
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </header>

      <div className="dashboard-container">
        {/* Sidebar */}
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            <button 
              className={`nav-btn ${activeTab === 'appointments' ? 'active' : ''}`}
              onClick={() => setActiveTab('appointments')}
            >
              📅 Appointments
            </button>
            <button 
              className={`nav-btn ${activeTab === 'consultation' ? 'active' : ''}`}
              onClick={() => setActiveTab('consultation')}
            >
              🎥 Consultation
            </button>
            <button 
              className={`nav-btn ${activeTab === 'prescription' ? 'active' : ''}`}
              onClick={() => setActiveTab('prescription')}
            >
              📝 Prescription
            </button>
            <button 
              className={`nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Chat
            </button>
            <button 
              className={`nav-btn ${activeTab === 'patients' ? 'active' : ''}`}
              onClick={() => setActiveTab('patients')}
            >
              👥 Patients
            </button>
          </nav>

          {/* Quick Stats */}
          <div className="quick-stats">
            <h4>Today's Stats</h4>
            <div className="stat-item">
              <span className="stat-label">Appointments:</span>
              <span className="stat-value">8</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Completed:</span>
              <span className="stat-value">5</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Pending:</span>
              <span className="stat-value">3</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
          {/* Appointments Tab */}
          {activeTab === 'appointments' && (
            <div className="tab-content">
              <h2>Upcoming Appointments</h2>
              <div className="appointments-grid">
                {appointments.map(appointment => (
                  <div key={appointment.id} className="appointment-card">
                    <div className="appointment-info">
                      <h4>{appointment.patient}</h4>
                      <p className="appointment-time">{appointment.time}</p>
                      <p className="appointment-type">{appointment.type}</p>
                    </div>
                    <button 
                      className="start-consultation-btn"
                      onClick={() => handleStartConsultation(appointment.id)}
                    >
                      Start Consultation
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consultation Tab */}
          {activeTab === 'consultation' && (
            <div className="tab-content consultation-tab">
              <h2>Video Consultation</h2>
              <div className="video-container">
                <div className="video-area">
                  {/* Video placeholder */}
                  <div className="video-placeholder">
                    <div className="video-feed"></div>
                    <div className="video-controls">
                      <button className="control-btn">🎤</button>
                      <button className="control-btn">📹</button>
                      <button className="control-btn end-call">📞 End Call</button>
                      <button className="control-btn">💬</button>
                      <button className="control-btn">📁</button>
                    </div>
                  </div>
                </div>
                
                <div className="consultation-sidebar">
                  <h4>Patient Information</h4>
                  <div className="patient-info">
                    <p><strong>Name:</strong> John Doe</p>
                    <p><strong>Age:</strong> 45</p>
                    <p><strong>Gender:</strong> Male</p>
                    <p><strong>Symptoms:</strong> Headache, Fever</p>
                  </div>
                  
                  <div className="quick-actions">
                    <button className="action-btn">View History</button>
                    <button className="action-btn">Add Notes</button>
                    <button className="action-btn" onClick={() => setActiveTab('prescription')}>
                      Write Prescription
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Prescription Tab */}
          {activeTab === 'prescription' && (
            <div className="tab-content">
              <h2>Prescription Editor</h2>
              <div className="prescription-editor">
                <div className="prescription-header">
                  <div className="patient-info-prescription">
                    <h4>Patient: John Doe</h4>
                    <p>Date: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="prescription-actions">
                    <button className="save-btn" onClick={handleSavePrescription}>
                      Save Prescription
                    </button>
                    <button className="print-btn" onClick={handlePrintPrescription}>
                      Print
                    </button>
                  </div>
                </div>
                
                <textarea
                  className="prescription-textarea"
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  placeholder="Write prescription here...
                  
Example:
Medication:
1. Paracetamol 500mg - 1 tablet every 6 hours
2. Ibuprofen 200mg - 1 tablet as needed
3. Amoxicillin 250mg - 1 tablet 3 times daily

Instructions:
Take after meals. Complete full course of antibiotics."
                  rows={20}
                />
                
                <div className="template-buttons">
                  <h4>Quick Templates:</h4>
                  <div className="template-grid">
                    <button className="template-btn" onClick={() => setPrescription(prev => prev + '\n\nFever: Paracetamol 500mg - 1 tablet every 6 hours')}>
                      Fever
                    </button>
                    <button className="template-btn" onClick={() => setPrescription(prev => prev + '\n\nCough: Cough Syrup - 10ml 3 times daily')}>
                      Cough
                    </button>
                    <button className="template-btn" onClick={() => setPrescription(prev => prev + '\n\nPain: Ibuprofen 200mg - As needed')}>
                      Pain
                    </button>
                    <button className="template-btn" onClick={() => setPrescription(prev => prev + '\n\nAntibiotic: Amoxicillin 250mg - 3 times daily for 7 days')}>
                      Antibiotic
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="tab-content">
              <h2>Chat with Patients</h2>
              <div className="chat-container">
                <div className="chat-sidebar">
                  <div className="chat-search">
                    <input type="text" placeholder="Search patients..." />
                  </div>
                  <div className="chat-list">
                    {['John Doe', 'Jane Smith', 'Robert Johnson', 'Sarah Williams'].map((patient, index) => (
                      <div key={index} className="chat-patient">
                        <div className="patient-avatar">👤</div>
                        <div className="patient-chat-info">
                          <h5>{patient}</h5>
                          <p>Last message...</p>
                        </div>
                        <span className="chat-time">10:30</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="chat-main">
                  <div className="chat-header">
                    <h4>John Doe</h4>
                    <button className="video-call-btn" onClick={() => setActiveTab('consultation')}>
                      📹 Start Video Call
                    </button>
                  </div>
                  
                  <div className="chat-messages">
                    {chatMessages.map(message => (
                      <div key={message.id} className={`message ${message.sender}`}>
                        <div className="message-content">
                          {message.text}
                        </div>
                        <span className="message-time">{message.time}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="chat-input">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button onClick={handleSendMessage}>Send</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Patients Tab */}
          {activeTab === 'patients' && (
            <div className="tab-content">
              <h2>Patient Records</h2>
              <div className="patients-table">
                <table>
                  <thead>
                    <tr>
                      <th>Patient Name</th>
                      <th>Age</th>
                      <th>Last Visit</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>John Doe</td>
                      <td>45</td>
                      <td>2024-01-10</td>
                      <td><span className="status-active">Active</span></td>
                      <td>
                        <button className="action-small">View</button>
                        <button className="action-small">Message</button>
                      </td>
                    </tr>
                    <tr>
                      <td>Jane Smith</td>
                      <td>32</td>
                      <td>2024-01-12</td>
                      <td><span className="status-active">Active</span></td>
                      <td>
                        <button className="action-small">View</button>
                        <button className="action-small">Message</button>
                      </td>
                    </tr>
                    <tr>
                      <td>Robert Johnson</td>
                      <td>58</td>
                      <td>2024-01-08</td>
                      <td><span className="status-followup">Follow-up</span></td>
                      <td>
                        <button className="action-small">View</button>
                        <button className="action-small">Message</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DoctorDashboard;