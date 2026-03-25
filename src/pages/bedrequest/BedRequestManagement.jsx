// BedRequestManagement.jsx - Fixed undefined field error
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/firebase';
import { 
  doc, 
  updateDoc, 
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  runTransaction,
  deleteDoc
} from 'firebase/firestore';
import './BedRequestManagement.css';

const BedRequestManagement = ({ hospitalId, bedData, onBedUpdate }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formData, setFormData] = useState({
    patientName: '',
    age: '',
    gender: '',
    diagnosis: '',
    priority: 'normal',
    requiredBedType: '',
    estimatedStay: '',
    contactNumber: '',
    doctorName: '',
    notes: '',
    oxygenLevel: '95',
    condition: 'normal'
  });
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [bedsList, setBedsList] = useState([]);

  useEffect(() => {
    if (hospitalId) {
      fetchRequests();
      fetchBeds();
    }
  }, [hospitalId]);

  const fetchBeds = async () => {
    try {
      const bedsRef = collection(db, 'hospitals', hospitalId, 'beds');
      const bedsSnapshot = await getDocs(bedsRef);
      const beds = bedsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBedsList(beds);
    } catch (error) {
      console.error('Error fetching beds:', error);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const requestsRef = collection(db, 'hospitals', hospitalId, 'bedRequests');
      const q = query(requestsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const requestsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(requestsList);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePriorityScore = (request) => {
    let score = 0;
    const log = [];
    
    if (request.priority === 'emergency') {
      score += 50;
      log.push('Emergency: +50');
    } else if (request.priority === 'urgent') {
      score += 30;
      log.push('Urgent: +30');
    }
    
    const oxygenLevel = parseInt(request.oxygenLevel) || 95;
    if (oxygenLevel < 85) {
      score += 40;
      log.push(`Critical oxygen (${oxygenLevel}%): +40`);
    } else if (oxygenLevel < 90) {
      score += 30;
      log.push(`Low oxygen (${oxygenLevel}%): +30`);
    } else if (oxygenLevel < 95) {
      score += 10;
      log.push(`Moderate oxygen (${oxygenLevel}%): +10`);
    }
    
    const age = parseInt(request.age) || 0;
    if (age > 70) {
      score += 25;
      log.push(`Age > 70: +25`);
    } else if (age > 60) {
      score += 15;
      log.push(`Age > 60: +15`);
    } else if (age < 10 && age > 0) {
      score += 20;
      log.push(`Child (<10): +20`);
    }
    
    if (request.condition === 'critical') {
      score += 35;
      log.push('Critical condition: +35');
    } else if (request.condition === 'severe') {
      score += 20;
      log.push('Severe condition: +20');
    } else if (request.condition === 'moderate') {
      score += 10;
      log.push('Moderate condition: +10');
    }
    
    const criticalKeywords = ['heart', 'stroke', 'bleeding', 'sepsis', 'respiratory', 'failure', 'cancer', 'tumor'];
    const diagnosis = (request.diagnosis || '').toLowerCase();
    criticalKeywords.forEach(keyword => {
      if (diagnosis.includes(keyword)) {
        score += 15;
        log.push(`Keyword "${keyword}": +15`);
      }
    });
    
    const finalScore = Math.min(score, 100);
    return { score: finalScore, log };
  };

  const determineBedType = (priority) => {
    if (priority >= 70) return 'ICU';
    if (priority >= 50) return 'Emergency';
    if (priority >= 40) return 'Surgical';
    return 'General Ward';
  };

  const aiAllocateBed = (request) => {
    const { score: priority, log: priorityLog } = calculatePriorityScore(request);
    const requiredType = determineBedType(priority);
    
    let availableBeds = bedsList.filter(bed => 
      bed.status === 'available' && bed.type === requiredType
    );
    
    if (availableBeds.length === 0 && requiredType === 'ICU') {
      availableBeds = bedsList.filter(bed => 
        bed.status === 'available' && ['Emergency', 'Surgical'].includes(bed.type)
      );
    } else if (availableBeds.length === 0) {
      availableBeds = bedsList.filter(bed => bed.status === 'available');
    }
    
    const bedsByFloor = {};
    availableBeds.forEach(bed => {
      const floor = bed.floor || '1';
      if (!bedsByFloor[floor]) bedsByFloor[floor] = [];
      bedsByFloor[floor].push(bed);
    });
    
    if (availableBeds.length === 0) {
      return {
        hasAvailable: false,
        message: `No ${requiredType} beds available. Will be added to waiting queue.`,
        priority,
        priorityLog,
        requiredType,
        bedsByFloor: {},
        waitingQueuePosition: requests.filter(r => r.status === 'pending').length + 1
      };
    }
    
    const sortedBeds = availableBeds.sort((a, b) => {
      if (priority > 70) {
        return parseInt(a.floor) - parseInt(b.floor);
      }
      return (b.features?.length || 0) - (a.features?.length || 0);
    });
    
    const selectedBed = sortedBeds[0];
    
    return {
      hasAvailable: true,
      bed: selectedBed,
      priority,
      priorityLog,
      requiredType,
      bedsByFloor,
      message: `AI recommends Bed ${selectedBed.bedId} (${selectedBed.type}) in Room ${selectedBed.roomNumber}, Floor ${selectedBed.floor}`,
      reasoning: `Priority Score: ${priority} (${priorityLog.join(', ')}) → Recommended: ${selectedBed.type} Bed on Floor ${selectedBed.floor}`
    };
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'diagnosis' || name === 'priority') {
      suggestBedType(value, formData.priority);
    }
  };

  const suggestBedType = (diagnosis, priority) => {
    const diagnosis_lower = diagnosis.toLowerCase();
    
    if (diagnosis_lower.includes('heart') || diagnosis_lower.includes('cardiac') || 
        diagnosis_lower.includes('icu') || priority === 'emergency') {
      setFormData(prev => ({ ...prev, requiredBedType: 'ICU' }));
    } else if (diagnosis_lower.includes('surgery') || diagnosis_lower.includes('operation')) {
      setFormData(prev => ({ ...prev, requiredBedType: 'Surgical' }));
    } else if (diagnosis_lower.includes('emergency') || diagnosis_lower.includes('accident')) {
      setFormData(prev => ({ ...prev, requiredBedType: 'Emergency' }));
    } else {
      setFormData(prev => ({ ...prev, requiredBedType: 'General Ward' }));
    }
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    
    if (!formData.patientName || !formData.age || !formData.diagnosis) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    
    try {
      setLoading(true);
      
      const requestData = {
        ...formData,
        patientId: `REQ_${Date.now()}`,
        status: 'pending',
        createdAt: serverTimestamp(),
        hospitalId: hospitalId,
        age: parseInt(formData.age),
        estimatedStay: formData.estimatedStay ? parseInt(formData.estimatedStay) : null,
        oxygenLevel: parseInt(formData.oxygenLevel) || 95,
        condition: formData.condition || 'normal',
        diagnosis: formData.diagnosis || '',
        contactNumber: formData.contactNumber || '',
        doctorName: formData.doctorName || '',
        notes: formData.notes || '',
        requiredBedType: formData.requiredBedType || ''
      };
      
      const aiSuggestionResult = aiAllocateBed(requestData);
      setAiSuggestion(aiSuggestionResult);
      
      const requestsRef = collection(db, 'hospitals', hospitalId, 'bedRequests');
      await addDoc(requestsRef, requestData);
      
      showNotification('Bed request submitted successfully! AI analyzing best allocation...', 'success');
      
      setFormData({
        patientName: '',
        age: '',
        gender: '',
        diagnosis: '',
        priority: 'normal',
        requiredBedType: '',
        estimatedStay: '',
        contactNumber: '',
        doctorName: '',
        notes: '',
        oxygenLevel: '95',
        condition: 'normal'
      });
      
      setShowRequestForm(false);
      fetchRequests();
      fetchBeds();
      
    } catch (error) {
      console.error('Error submitting request:', error);
      showNotification('Error submitting request', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateBed = async (request, recommendedBed) => {
    try {
      setLoading(true);
      
      const bedRef = doc(db, 'hospitals', hospitalId, 'beds', recommendedBed.id);
      const bedDoc = await getDoc(bedRef);
      
      if (!bedDoc.exists() || bedDoc.data().status !== 'available') {
        showNotification('Bed is no longer available!', 'error');
        fetchBeds();
        return;
      }
      
      // Create clean patient data object with NO undefined values
      const updateData = {
        status: 'occupied',
        patientId: `PAT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patientName: request.patientName || '',
        patientAge: parseInt(request.age) || 0,
        patientCondition: request.condition || 'normal',
        admissionDate: serverTimestamp(),
        priority: request.priority === 'emergency' ? 50 : request.priority === 'urgent' ? 30 : 10,
        allocationReason: 'AI Allocation',
        oxygenLevel: parseInt(request.oxygenLevel) || 95
      };
      
      // Only add fields if they have valid values (not undefined, null, or empty string)
      if (request.diagnosis && request.diagnosis.trim() !== '') {
        updateData.diagnosis = request.diagnosis;
      }
      
      if (request.contactNumber && request.contactNumber.trim() !== '') {
        updateData.contactNumber = request.contactNumber;
      }
      
      if (request.doctorName && request.doctorName.trim() !== '') {
        updateData.doctorName = request.doctorName;
      }
      
      await runTransaction(db, async (transaction) => {
        const currentBedDoc = await transaction.get(bedRef);
        if (currentBedDoc.data().status !== 'available') {
          throw new Error('Bed is no longer available!');
        }
        
        transaction.update(bedRef, updateData);
      });
      
      const requestRef = doc(db, 'hospitals', hospitalId, 'bedRequests', request.id);
      await updateDoc(requestRef, {
        status: 'allocated',
        allocatedBedId: recommendedBed.id,
        allocatedBedNumber: recommendedBed.bedId,
        allocatedBedType: recommendedBed.type,
        allocatedRoomNumber: recommendedBed.roomNumber,
        allocatedFloor: recommendedBed.floor,
        allocatedAt: serverTimestamp(),
        allocatedBy: 'AI System'
      });
      
      if (onBedUpdate) onBedUpdate();
      
      showNotification(`Bed allocated successfully! Bed ${recommendedBed.bedId} (${recommendedBed.type}) on Floor ${recommendedBed.floor}`, 'success');
      fetchRequests();
      fetchBeds();
      
    } catch (error) {
      console.error('Error allocating bed:', error);
      showNotification('Error allocating bed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAllocate = async () => {
    const pendingRequests = requests.filter(r => r.status === 'pending');
    if (pendingRequests.length === 0) {
      showNotification('No pending requests', 'info');
      return;
    }
    
    setLoading(true);
    let allocated = 0;
    const failedRequests = [];
    
    for (const request of pendingRequests) {
      const aiSuggestion = aiAllocateBed(request);
      if (aiSuggestion.hasAvailable && aiSuggestion.bed) {
        await handleAllocateBed(request, aiSuggestion.bed);
        allocated++;
      } else {
        failedRequests.push(request.patientName);
      }
    }
    
    setLoading(false);
    if (allocated > 0) {
      showNotification(`AI allocated ${allocated} out of ${pendingRequests.length} requests`, 'success');
    }
    if (failedRequests.length > 0) {
      showNotification(`Could not allocate: ${failedRequests.join(', ')}`, 'warning');
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'emergency': return '#dc2626';
      case 'urgent': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const getPriorityLabel = (priority) => {
    switch(priority) {
      case 'emergency': return '🚨 Emergency';
      case 'urgent': return '⚠️ Urgent';
      default: return '✅ Normal';
    }
  };

  const getBedTypeIcon = (type) => {
    const icons = {
      'ICU': '💙',
      'Emergency': '🚨',
      'Surgical': '💚',
      'General Ward': '🛏️',
      'Private Room': '🏠'
    };
    return icons[type] || '🛏️';
  };

  const bedStats = React.useMemo(() => {
    const stats = {};
    bedsList.forEach(bed => {
      if (!stats[bed.type]) {
        stats[bed.type] = { total: 0, available: 0, occupied: 0, floors: {} };
      }
      stats[bed.type].total++;
      if (bed.status === 'available') stats[bed.type].available++;
      else stats[bed.type].occupied++;
      
      const floor = bed.floor || '1';
      if (!stats[bed.type].floors[floor]) {
        stats[bed.type].floors[floor] = { total: 0, available: 0 };
      }
      stats[bed.type].floors[floor].total++;
      if (bed.status === 'available') stats[bed.type].floors[floor].available++;
    });
    return stats;
  }, [bedsList]);

  return (
    <div className="bed-request-management">
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">{notification.message}</div>
        </div>
      )}
      
      <div className="request-header">
        <div className="header-left">
          <h2>🛏️ Bed Request Management</h2>
          <p className="subtitle">AI-powered bed allocation system</p>
        </div>
        <div className="header-actions">
          <button 
            className="auto-allocate-btn"
            onClick={handleAutoAllocate}
            disabled={loading}
          >
            <span>🤖</span>
            <span>AI Auto-Allocate</span>
          </button>
          <button 
            className="new-request-btn"
            onClick={() => setShowRequestForm(!showRequestForm)}
          >
            <span>➕</span>
            <span>New Request</span>
          </button>
        </div>
      </div>
      
      <div className="ai-stats-summary">
        <div className="ai-stat-card">
          <div className="ai-stat-icon">🤖</div>
          <div className="ai-stat-info">
            <div className="ai-stat-value">{requests.length}</div>
            <div className="ai-stat-label">Total Requests</div>
          </div>
        </div>
        <div className="ai-stat-card">
          <div className="ai-stat-icon">⏳</div>
          <div className="ai-stat-info">
            <div className="ai-stat-value">{requests.filter(r => r.status === 'pending').length}</div>
            <div className="ai-stat-label">Pending</div>
          </div>
        </div>
        <div className="ai-stat-card">
          <div className="ai-stat-icon">✅</div>
          <div className="ai-stat-info">
            <div className="ai-stat-value">{requests.filter(r => r.status === 'allocated').length}</div>
            <div className="ai-stat-label">Allocated</div>
          </div>
        </div>
        <div className="ai-stat-card">
          <div className="ai-stat-icon">🎯</div>
          <div className="ai-stat-info">
            <div className="ai-stat-value">AI</div>
            <div className="ai-stat-label">Smart Allocation</div>
          </div>
        </div>
      </div>
      
      <div className="bed-availability-summary" style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>🛏️ Bed Availability by Type</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {Object.entries(bedStats).map(([type, stats]) => (
            <div key={type} style={{ background: 'white', padding: '10px', borderRadius: '8px', borderLeft: `4px solid ${stats.available > 0 ? '#10b981' : '#ef4444'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <span>{getBedTypeIcon(type)}</span>
                <strong>{type}</strong>
              </div>
              <div style={{ fontSize: '12px' }}>
                Available: <span style={{ color: '#10b981', fontWeight: 'bold' }}>{stats.available}</span> / {stats.total}
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                {Object.entries(stats.floors).map(([floor, floorStats]) => (
                  <div key={floor}>Floor {floor}: {floorStats.available}/{floorStats.total}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {showRequestForm && (
        <div className="request-form-container">
          <h3>New Bed Request</h3>
          <form onSubmit={handleSubmitRequest}>
            <div className="form-grid">
              <div className="form-group">
                <label>Patient Name *</label>
                <input
                  type="text"
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter patient name"
                />
              </div>
              <div className="form-group">
                <label>Age *</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter age"
                />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority Level *</label>
                <select name="priority" value={formData.priority} onChange={handleInputChange} required>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="form-group">
                <label>Condition Severity</label>
                <select name="condition" value={formData.condition} onChange={handleInputChange}>
                  <option value="normal">Normal</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label>Oxygen Level (%)</label>
                <input
                  type="number"
                  name="oxygenLevel"
                  value={formData.oxygenLevel}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  placeholder="Enter oxygen saturation"
                />
              </div>
              <div className="form-group full-width">
                <label>Diagnosis / Condition *</label>
                <textarea
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleInputChange}
                  required
                  placeholder="Describe the patient's condition"
                  rows="2"
                />
              </div>
              <div className="form-group">
                <label>Required Bed Type (AI Suggestion)</label>
                <input
                  type="text"
                  name="requiredBedType"
                  value={formData.requiredBedType}
                  onChange={handleInputChange}
                  placeholder="ICU / General Ward / Emergency / Surgical"
                />
                <small className="ai-hint">🤖 AI will suggest based on diagnosis</small>
              </div>
              <div className="form-group">
                <label>Estimated Stay (days)</label>
                <input
                  type="number"
                  name="estimatedStay"
                  value={formData.estimatedStay}
                  onChange={handleInputChange}
                  placeholder="Estimated hospital stay"
                />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input
                  type="text"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  placeholder="Emergency contact"
                />
              </div>
              <div className="form-group">
                <label>Referring Doctor</label>
                <input
                  type="text"
                  name="doctorName"
                  value={formData.doctorName}
                  onChange={handleInputChange}
                  placeholder="Doctor's name"
                />
              </div>
              <div className="form-group full-width">
                <label>Additional Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Any special requirements or notes"
                  rows="2"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={() => setShowRequestForm(false)}>
                Cancel
              </button>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {aiSuggestion && (
        <div className={`ai-suggestion-card ${aiSuggestion.hasAvailable ? 'available' : 'unavailable'}`}>
          <div className="ai-suggestion-header">
            <span className="ai-icon">🤖</span>
            <span className="ai-title">AI Bed Allocation Suggestion</span>
          </div>
          <p className="ai-message">{aiSuggestion.message}</p>
          {aiSuggestion.bed && (
            <div className="ai-details">
              <div className="ai-detail">
                <strong>Recommended Bed:</strong> {aiSuggestion.bed.bedId} ({aiSuggestion.bed.type})
              </div>
              <div className="ai-detail">
                <strong>Room:</strong> {aiSuggestion.bed.roomNumber} | <strong>Floor:</strong> {aiSuggestion.bed.floor}
              </div>
              <div className="ai-detail">
                <strong>Priority Score:</strong> {aiSuggestion.priority}
              </div>
              <div className="ai-detail">
                <strong>Reasoning:</strong> {aiSuggestion.reasoning}
              </div>
            </div>
          )}
          {!aiSuggestion.hasAvailable && (
            <div className="ai-details">
              <div className="ai-detail">
                <strong>Queue Position:</strong> {aiSuggestion.waitingQueuePosition}
              </div>
              <div className="ai-detail">
                <strong>Priority Score:</strong> {aiSuggestion.priority}
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="requests-list">
        <div className="list-header">
          <h3>Bed Requests</h3>
          <span className="request-count">{requests.length} total</span>
        </div>
        
        {loading && !requests.length ? (
          <div className="loading-state">
            <div className="loading-spinner-small"></div>
            <p>Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛏️</div>
            <p>No bed requests yet</p>
            <button className="new-request-btn-small" onClick={() => setShowRequestForm(true)}>
              Create First Request
            </button>
          </div>
        ) : (
          requests.map(request => {
            const aiRecommendation = aiAllocateBed(request);
            return (
              <div key={request.id} className={`request-card status-${request.status}`}>
                <div className="request-header-info">
                  <div className="patient-info">
                    <div className="patient-name">
                      <span className="patient-icon">👤</span>
                      <strong>{request.patientName}</strong>
                      {request.age && <span className="patient-age">({request.age} yrs)</span>}
                    </div>
                    <div className="patient-diagnosis">
                      <span>🏥 {request.diagnosis}</span>
                    </div>
                  </div>
                  <div className="request-meta">
                    <span className={`priority-badge priority-${request.priority}`}>
                      {getPriorityLabel(request.priority)}
                    </span>
                    <span className="status-badge">
                      {request.status === 'pending' && '⏳ Pending'}
                      {request.status === 'allocated' && '✅ Allocated'}
                      {request.status === 'cancelled' && '❌ Cancelled'}
                    </span>
                  </div>
                </div>
                
                <div className="request-details">
                  {request.condition && (
                    <div className="detail-item">
                      <span className="detail-label">Condition:</span>
                      <span className="detail-value">{request.condition}</span>
                    </div>
                  )}
                  {request.oxygenLevel && (
                    <div className="detail-item">
                      <span className="detail-label">Oxygen:</span>
                      <span className="detail-value">{request.oxygenLevel}%</span>
                    </div>
                  )}
                  {request.requiredBedType && (
                    <div className="detail-item">
                      <span className="detail-label">Required Bed:</span>
                      <span className="detail-value">{request.requiredBedType}</span>
                    </div>
                  )}
                  {request.estimatedStay && (
                    <div className="detail-item">
                      <span className="detail-label">Est. Stay:</span>
                      <span className="detail-value">{request.estimatedStay} days</span>
                    </div>
                  )}
                  {request.doctorName && (
                    <div className="detail-item">
                      <span className="detail-label">Doctor:</span>
                      <span className="detail-value">{request.doctorName}</span>
                    </div>
                  )}
                  {request.contactNumber && (
                    <div className="detail-item">
                      <span className="detail-label">Contact:</span>
                      <span className="detail-value">{request.contactNumber}</span>
                    </div>
                  )}
                </div>
                
                {request.status === 'pending' && aiRecommendation.hasAvailable && aiRecommendation.bed && (
                  <div className="ai-recommendation">
                    <div className="ai-recommendation-header">
                      <span className="ai-icon-small">🤖</span>
                      <span>AI Recommendation</span>
                    </div>
                    <div className="ai-recommendation-content">
                      <span className="recommended-bed">
                        {aiRecommendation.bed.bedId} ({aiRecommendation.bed.type}) - Floor {aiRecommendation.bed.floor}
                      </span>
                      <span className="availability-info">
                        (Priority Score: {aiRecommendation.priority})
                      </span>
                      <button
                        className="allocate-btn"
                        onClick={() => handleAllocateBed(request, aiRecommendation.bed)}
                        disabled={loading}
                      >
                        Allocate Now
                      </button>
                    </div>
                  </div>
                )}
                
                {request.status === 'pending' && !aiRecommendation.hasAvailable && (
                  <div className="ai-recommendation warning">
                    <span className="warning-icon">⚠️</span>
                    <span>No beds available. Added to queue (Position: {aiRecommendation.waitingQueuePosition})</span>
                  </div>
                )}
                
                {request.status === 'allocated' && (
                  <div className="allocated-info">
                    <span className="allocated-bed">
                      🛏️ Allocated: {request.allocatedBedNumber} ({request.allocatedBedType})
                    </span>
                    <span className="allocated-room">
                      Room {request.allocatedRoomNumber}, Floor {request.allocatedFloor}
                    </span>
                    <span className="allocated-by">🤖 by {request.allocatedBy || 'AI System'}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BedRequestManagement;