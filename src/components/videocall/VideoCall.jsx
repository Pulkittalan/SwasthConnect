import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase/firebase';
import { 
  doc, 
  updateDoc, 
  addDoc, 
  collection, 
  serverTimestamp,
  onSnapshot,
  getDoc,
  query,
  where,
  deleteDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import './VideoCall.css';

const VideoCall = ({ 
  roomId, 
  currentUser,
  userType,
  userName,
  onClose 
}) => {
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [otherParticipant, setOtherParticipant] = useState(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [networkQuality, setNetworkQuality] = useState('good');

  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const unsubscribeSignalsRef = useRef(null);
  const isMountedRef = useRef(true);
  const signalingCompleteRef = useRef(false);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10
  };

  const cleanup = useCallback(() => {
    console.log('Cleaning up video call resources...');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (unsubscribeSignalsRef.current) {
      unsubscribeSignalsRef.current();
      unsubscribeSignalsRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const initLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      console.log('Requesting camera and microphone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('Media access granted');
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      
      let errorMessage = 'Unable to access camera/microphone. ';
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera and microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found. Please check your devices.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Camera or microphone is already in use by another application.';
      } else {
        errorMessage += err.message;
      }
      
      setError(errorMessage);
      setIsConnecting(false);
      return null;
    }
  }, []);

  const serializeCandidate = (candidate) => {
    if (!candidate) return null;
    return {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      usernameFragment: candidate.usernameFragment
    };
  };

  const deserializeCandidate = (serialized) => {
    if (!serialized) return null;
    return new RTCIceCandidate(serialized);
  };

  const sendSignal = useCallback(async (signal) => {
    try {
      let signalData = { ...signal };
      
      if (signal.candidate) {
        signalData.candidate = serializeCandidate(signal.candidate);
      }
      
      if (signal.offer) {
        signalData.offer = {
          type: signal.offer.type,
          sdp: signal.offer.sdp
        };
      }
      
      if (signal.answer) {
        signalData.answer = {
          type: signal.answer.type,
          sdp: signal.answer.sdp
        };
      }
      
      const signalsRef = collection(db, 'calls', roomId, 'signals');
      await addDoc(signalsRef, {
        ...signalData,
        from: currentUser.uid,
        timestamp: serverTimestamp()
      });
      console.log('Signal sent:', signal.type);
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }, [roomId, currentUser.uid]);

  const setupPeerConnection = useCallback(async (stream, isInitiatorRole) => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach(track => {
      console.log(`Adding ${track.kind} track`);
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0] && isMountedRef.current) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate && isMountedRef.current) {
        await sendSignal({
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('ICE State:', state);
      
      if (state === 'connected' || state === 'completed') {
        setConnectionStatus('connected');
        setIsCallActive(true);
        setIsConnecting(false);
        if (!callStartTimeRef.current) {
          callStartTimeRef.current = Date.now();
          if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = setInterval(() => {
            if (callStartTimeRef.current && isMountedRef.current) {
              setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
            }
          }, 1000);
        }
      } else if (state === 'failed') {
        setError('Connection failed. Please try again.');
        setIsConnecting(false);
      } else if (state === 'disconnected') {
        console.log('ICE disconnected');
        setConnectionStatus('disconnected');
      } else if (state === 'checking') {
        setConnectionStatus('connecting');
        setIsConnecting(true);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        setError('Connection failed. Please try again.');
        setIsConnecting(false);
      }
    };

    return pc;
  }, [sendSignal]);

  const listenForSignals = useCallback(async () => {
    const signalsRef = collection(db, 'calls', roomId, 'signals');
    
    unsubscribeSignalsRef.current = onSnapshot(
      query(signalsRef, where('from', '!=', currentUser.uid)),
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' && peerConnectionRef.current && !signalingCompleteRef.current) {
            const signal = change.doc.data();
            const pc = peerConnectionRef.current;

            try {
              switch (signal.type) {
                case 'offer':
                  if (!pc.currentRemoteDescription) {
                    console.log('Received offer, creating answer...');
                    const offer = new RTCSessionDescription(signal.offer);
                    await pc.setRemoteDescription(offer);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await sendSignal({ type: 'answer', answer: answer });
                    console.log('Answer sent');
                  }
                  break;

                case 'answer':
                  if (!pc.currentRemoteDescription && pc.localDescription?.type === 'offer') {
                    console.log('Received answer, setting remote description...');
                    const answer = new RTCSessionDescription(signal.answer);
                    await pc.setRemoteDescription(answer);
                    signalingCompleteRef.current = true;
                  }
                  break;

                case 'candidate':
                  if (signal.candidate) {
                    try {
                      const candidate = deserializeCandidate(signal.candidate);
                      if (candidate) {
                        await pc.addIceCandidate(candidate);
                      }
                    } catch (e) {
                      console.warn('Error adding ICE candidate:', e);
                    }
                  }
                  break;
              }
            } catch (error) {
              console.error('Error handling signal:', error);
            }
          }
        }
      }
    );
  }, [roomId, currentUser.uid, sendSignal]);

  const startCall = useCallback(async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    const pc = await setupPeerConnection(stream, true);
    await listenForSignals();

    console.log('Creating offer...');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal({ type: 'offer', offer: offer });
    
    console.log('Offer sent, waiting for answer...');

    await updateDoc(doc(db, 'calls', roomId), {
      status: 'active',
      startedAt: serverTimestamp()
    });
  }, [initLocalStream, setupPeerConnection, listenForSignals, sendSignal, roomId]);

  const joinCall = useCallback(async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    await setupPeerConnection(stream, false);
    await listenForSignals();
    
    console.log('Joined call, waiting for offer...');

    await updateDoc(doc(db, 'calls', roomId), {
      status: 'active',
      startedAt: serverTimestamp()
    });
  }, [initLocalStream, setupPeerConnection, listenForSignals, roomId]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const handleEndCall = useCallback(async () => {
    console.log('Ending call...');
    
    try {
      await updateDoc(doc(db, 'calls', roomId), {
        status: 'ended',
        endedAt: serverTimestamp(),
        duration: callDuration
      });

      await addDoc(collection(db, 'callHistory'), {
        roomId,
        userId: currentUser.uid,
        userName: userName,
        userType: userType,
        duration: callDuration,
        endedAt: new Date()
      });
      
      const signalsRef = collection(db, 'calls', roomId, 'signals');
      const signalsSnapshot = await getDocs(signalsRef);
      const batch = writeBatch(db);
      signalsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
    } catch (error) {
      console.error('Error ending call:', error);
    }

    cleanup();
    setIsCallActive(false);
    
    if (onClose) onClose();
  }, [roomId, currentUser.uid, userName, userType, callDuration, onClose, cleanup]);

  // Network quality monitoring
  useEffect(() => {
    if (!peerConnectionRef.current) return;
    
    const pc = peerConnectionRef.current;
    
    const checkNetworkQuality = setInterval(() => {
      if (pc && pc.getStats) {
        pc.getStats().then(stats => {
          let rtt = null;
          
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.nominated) {
              rtt = report.currentRoundTripTime;
            }
          });
          
          if (rtt) {
            if (rtt < 0.1) setNetworkQuality('good');
            else if (rtt < 0.3) setNetworkQuality('poor');
            else setNetworkQuality('bad');
          }
        }).catch(console.error);
      }
    }, 5000);
    
    return () => clearInterval(checkNetworkQuality);
  }, [peerConnectionRef.current]);

  // Fetch other participant info
  useEffect(() => {
    const fetchCallData = async () => {
      try {
        const callRef = doc(db, 'calls', roomId);
        const callDoc = await getDoc(callRef);
        
        if (callDoc.exists()) {
          const callData = callDoc.data();
          const isInitiatorRole = callData.initiator === currentUser.uid;
          setIsInitiator(isInitiatorRole);
          
          if (isInitiatorRole) {
            setOtherParticipant({
              id: callData.participant,
              name: callData.participantName
            });
          } else {
            setOtherParticipant({
              id: callData.initiator,
              name: callData.initiatorName
            });
          }
        }
      } catch (error) {
        console.error('Error fetching call data:', error);
      }
    };
    
    fetchCallData();
  }, [roomId, currentUser.uid]);

  // Initialize call
  useEffect(() => {
    isMountedRef.current = true;
    signalingCompleteRef.current = false;
    
    const initCall = async () => {
      try {
        const callDoc = await getDoc(doc(db, 'calls', roomId));
        
        if (!callDoc.exists()) {
          setError('Call session not found');
          setIsConnecting(false);
          return;
        }
        
        const callData = callDoc.data();
        
        if (callData.initiator === currentUser.uid) {
          await startCall();
        } else {
          await joinCall();
        }
      } catch (error) {
        console.error('Error initializing call:', error);
        setError('Failed to initialize call');
        setIsConnecting(false);
      }
    };

    if (roomId && currentUser) {
      initCall();
    }

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [roomId, currentUser, startCall, joinCall, cleanup]);

  const getNetworkQualityClass = () => {
    switch(networkQuality) {
      case 'good': return 'good';
      case 'poor': return 'poor';
      case 'bad': return 'bad';
      default: return 'good';
    }
  };

  const getNetworkQualityText = () => {
    switch(networkQuality) {
      case 'good': return '📶 Good Connection';
      case 'poor': return '⚠️ Poor Connection';
      case 'bad': return '❌ Bad Connection';
      default: return '📶 Connecting...';
    }
  };

  return (
    <div className="video-call-container">
      {error && (
        <div className="error-overlay">
          <p>{error}</p>
          <button onClick={handleEndCall}>Close</button>
        </div>
      )}

      <div className="video-grid">
        <div className="remote-video-wrapper">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
          />
          {isConnecting && !error && (
            <div className="connecting-overlay">
              <div className="spinner"></div>
              <p>Connecting to {otherParticipant?.name || 'doctor'}...</p>
              <p className="sub-text">
                {isInitiator ? 'Initiating call...' : 'Waiting for response...'}
              </p>
            </div>
          )}
          {connectionStatus === 'connected' && (
            <div className={`network-quality ${getNetworkQualityClass()}`}>
              {getNetworkQualityText()}
            </div>
          )}
          <div className="remote-label">{otherParticipant?.name || 'Doctor'}</div>
        </div>

        <div className="local-video-wrapper">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="local-video"
          />
          {isVideoOff && (
            <div className="video-off-overlay">
              <span>Camera Off</span>
            </div>
          )}
          <div className="local-label">{userName || 'You'}</div>
        </div>
      </div>

      <div className="call-controls">
        <div className="call-timer">
          {isCallActive ? formatDuration(callDuration) : 'Connecting...'}
        </div>
        
        <div className="controls-group">
          <button
            className={`control-btn ${isMuted ? 'active' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          
          <button
            className={`control-btn ${isVideoOff ? 'active' : ''}`}
            onClick={toggleVideo}
            title={isVideoOff ? 'Turn On Camera' : 'Turn Off Camera'}
          >
            {isVideoOff ? '📹' : '🎥'}
          </button>
          
          <button
            className="control-btn end-call"
            onClick={handleEndCall}
            title="End Call"
          >
            📞 End Call
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;