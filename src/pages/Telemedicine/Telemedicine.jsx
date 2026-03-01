import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import './Telemedicine.css';

const Telemedicine = () => {
  const { currentUser } = useAuth();
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isPhoneActive, setIsPhoneActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [prescription, setPrescription] = useState({
    doctorName: '',
    prescriptionText: ''
  });

  // Refs for video elements
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Mock WebRTC connection (simulated for now)
  const initializeVideoCall = () => {
    setIsVideoActive(true);
    
    // In a real implementation, this would initialize WebRTC
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        // Simulate remote stream after 2 seconds
        setTimeout(() => {
          if (remoteVideoRef.current) {
            // This would be the actual remote stream in production
            remoteVideoRef.current.srcObject = stream;
          }
        }, 2000);
      })
      .catch(err => {
        console.error('Error accessing media devices:', err);
        alert('Could not access camera/microphone. Please check permissions.');
      });
  };

  const stopVideoCall = () => {
    setIsVideoActive(false);
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current?.srcObject) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const startPhoneCall = () => {
    setIsPhoneActive(true);
    alert('Phone consultation started. In a real implementation, this would connect to Twilio or similar service.');
  };

  const stopPhoneCall = () => {
    setIsPhoneActive(false);
    alert('Phone consultation ended.');
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        text: newMessage,
        sender: currentUser?.displayName || 'Patient',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      
      // Simulate doctor response after 1 second
      setTimeout(() => {
        const doctorResponse = {
          id: Date.now() + 1,
          text: `Thank you for your message. How can I help you with "${newMessage}"?`,
          sender: 'Doctor',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, doctorResponse]);
      }, 1000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const downloadPrescription = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Medical Prescription', 10, 10);
    
    // Add patient info
    doc.setFontSize(12);
    doc.text(`Patient: ${currentUser?.displayName || 'Patient'}`, 10, 25);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 35);
    
    // Add prescription
    doc.setFontSize(14);
    doc.text('Prescription:', 10, 50);
    doc.setFontSize(12);
    
    const prescriptionLines = prescription.prescriptionText.split('\n');
    let yPosition = 60;
    prescriptionLines.forEach(line => {
      doc.text(line, 10, yPosition);
      yPosition += 7;
    });
    
    // Add doctor signature
    yPosition += 10;
    doc.text(`Prescribed by: ${prescription.doctorName || 'Dr. Smith'}`, 10, yPosition);
    doc.text('MBBS, MD', 10, yPosition + 7);
    
    // Save PDF
    doc.save('prescription.pdf');
  };

  // Load sample prescription
  useEffect(() => {
    // In a real app, this would come from an API
    setPrescription({
      doctorName: 'Dr. Sarah Johnson',
      prescriptionText: `1. Paracetamol 500mg - Take 1 tablet every 6 hours as needed for fever or pain
2. Amoxicillin 500mg - Take 1 capsule 3 times daily for 7 days
3. Maintain adequate hydration
4. Rest for 48 hours
5. Follow up in 7 days if symptoms persist

Instructions: Take medications after meals. Avoid alcohol while on antibiotics.`
    });

    // Auto-scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="telemedicine-page">
      <header className="telemedicine-header">
        <div className="header-content">
          <h1>Telemedicine Services</h1>
          <p className="welcome-text">
            Welcome, {currentUser?.displayName || 'Patient'}! Get medical consultation from the comfort of your home.
          </p>
        </div>
      </header>

      <main className="telemedicine-main">
        {/* Video Call Section */}
        <section id="video-call-section" className="telemedicine-section">
          <h2>Video Consultation</h2>
          <p>Connect with a doctor via secure video call. Click below to start your consultation.</p>
          
          <div className="video-call-container">
            <div className="video-wrapper">
              <div className="video-box">
                <h4>Your Video</h4>
                <video 
                  ref={localVideoRef} 
                  id="local-video" 
                  autoPlay 
                  muted 
                  className={isVideoActive ? 'active' : 'inactive'}
                ></video>
              </div>
              <div className="video-box">
                <h4>Doctor's Video</h4>
                <video 
                  ref={remoteVideoRef} 
                  id="remote-video" 
                  autoPlay 
                  className={isVideoActive ? 'active' : 'inactive'}
                ></video>
              </div>
            </div>
            
            <div className="button-group">
              <button 
                id="start-video-call" 
                onClick={initializeVideoCall}
                disabled={isVideoActive}
                className="btn-primary"
              >
                {isVideoActive ? 'Call in Progress...' : 'Start Video Call'}
              </button>
              <button 
                id="stop-video-call" 
                onClick={stopVideoCall}
                disabled={!isVideoActive}
                className="btn-secondary"
              >
                End Call
              </button>
            </div>
          </div>
        </section>

        {/* Phone Call Section */}
        <section id="phone-call" className="telemedicine-section">
          <h2>Phone Consultation</h2>
          <p>Speak with a doctor over a secure phone line. Available 24/7.</p>
          
          <div className="button-group">
            <button 
              id="start-phone-call" 
              onClick={startPhoneCall}
              disabled={isPhoneActive}
              className="btn-primary"
            >
              {isPhoneActive ? 'Call Connected...' : 'Start Phone Call'}
            </button>
            <button 
              id="stop-phone-call" 
              onClick={stopPhoneCall}
              disabled={!isPhoneActive}
              className="btn-secondary"
            >
              End Call
            </button>
          </div>
          
          <div className="contact-info">
            <p><strong>Emergency Hotline:</strong> 1800-123-4567</p>
            <p><strong>Available:</strong> 24 hours, 7 days a week</p>
          </div>
        </section>

        {/* Messaging Section */}
        <section id="messaging" className="telemedicine-section">
          <h2>Online Messaging</h2>
          <p>Chat with your doctor in real-time. Responses typically within 30 minutes.</p>
          
          <div className="chat-container">
            <div className="chat-box">
              <div className="messages-container" id="messages">
                {messages.map(message => (
                  <div 
                    key={message.id} 
                    className={`message ${message.sender === 'Doctor' ? 'received' : 'sent'}`}
                  >
                    <div className="message-header">
                      <strong>{message.sender}</strong>
                      <span className="message-time">{message.time}</span>
                    </div>
                    <div className="message-content">{message.text}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="message-input-container">
                <input
                  type="text"
                  id="message-input"
                  placeholder="Type your message here..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={!currentUser}
                />
                <button 
                  id="send-message" 
                  onClick={sendMessage}
                  disabled={!currentUser || !newMessage.trim()}
                  className="btn-primary"
                >
                  Send
                </button>
              </div>
            </div>
            
            {!currentUser && (
              <div className="auth-notice">
                <p>Please sign in to use the messaging feature.</p>
              </div>
            )}
          </div>
        </section>

        {/* Prescription Section */}
        <section id="prescription" className="telemedicine-section">
          <h2>Prescription</h2>
          <p>View and download your medical prescription.</p>
          
          <div className="prescription-container">
            <div className="prescription-header">
              <h3>Doctor's Prescription</h3>
              <p className="doctor-name">Prescribed by: <strong>{prescription.doctorName}</strong></p>
              <p className="prescription-date">Date: {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className="prescription-content">
              <pre>{prescription.prescriptionText}</pre>
            </div>
            
            <div className="prescription-actions">
              <button 
                id="download-pdf" 
                onClick={downloadPrescription}
                className="btn-primary"
              >
                Download Prescription as PDF
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="telemedicine-footer">
        <p>&copy; 2025 SwasthyaSetu Telemedicine Services. All rights reserved.</p>
        <p className="disclaimer">
          <strong>Disclaimer:</strong> This is for demonstration purposes. In a real application, 
          all medical services would be provided by licensed professionals with proper security measures.
        </p>
      </footer>
    </div>
  );
};

export default Telemedicine;