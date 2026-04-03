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
  where
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

  // Use refs for streams to prevent re-renders
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const unsubscribeSignalsRef = useRef(null);
  const isMountedRef = useRef(true);

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
      }
    ],
    iceCandidatePoolSize: 10
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop all tracks in local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Unsubscribe from signals
    if (unsubscribeSignalsRef.current) {
      unsubscribeSignalsRef.current();
      unsubscribeSignalsRef.current = null;
    }
  }, []);

  // Initialize local stream ONCE
  const initLocalStream = useCallback(async () => {
    // Don't re-initialize if we already have a stream
    if (localStreamRef.current) {
      console.log('Local stream already exists');
      return localStreamRef.current;
    }

    try {
      console.log('Requesting camera and microphone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('Camera access granted');
      localStreamRef.current = stream;
      
      // Set video to local element only once
      if (localVideoRef.current && localVideoRef.current.srcObject !== stream) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Camera/Microphone access denied. Please allow access in browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera or microphone found.');
      } else {
        setError(`Unable to access camera/microphone: ${err.message}`);
      }
      
      return null;
    }
  }, []);

  const sendSignal = useCallback(async (signal) => {
    try {
      const signalsRef = collection(db, 'calls', roomId, 'signals');
      await addDoc(signalsRef, {
        ...signal,
        from: currentUser.uid,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }, [roomId, currentUser.uid]);

  const setupPeerConnection = useCallback(async (stream) => {
    if (peerConnectionRef.current) {
      console.log('Peer connection already exists');
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // Add tracks from stream
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
      if (event.candidate) {
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
        if (!callStartTimeRef.current) {
          callStartTimeRef.current = Date.now();
          durationIntervalRef.current = setInterval(() => {
            if (callStartTimeRef.current && isMountedRef.current) {
              setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
            }
          }, 1000);
        }
      } else if (state === 'failed') {
        setError('Connection failed. Please try again.');
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
          if (change.type === 'added' && peerConnectionRef.current) {
            const signal = change.doc.data();
            const pc = peerConnectionRef.current;

            try {
              switch (signal.type) {
                case 'offer':
                  if (!pc.currentRemoteDescription) {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await sendSignal({ type: 'answer', answer: answer });
                  }
                  break;

                case 'answer':
                  if (!pc.currentRemoteDescription) {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                  }
                  break;

                case 'candidate':
                  if (signal.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
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

    const pc = await setupPeerConnection(stream);
    await listenForSignals();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal({ type: 'offer', offer: offer });
    
    console.log('Offer sent');

    await updateDoc(doc(db, 'calls', roomId), {
      status: 'active',
      startedAt: serverTimestamp()
    });
  }, [initLocalStream, setupPeerConnection, listenForSignals, sendSignal, roomId]);

  const joinCall = useCallback(async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    await setupPeerConnection(stream);
    await listenForSignals();
    
    console.log('Waiting for offer...');

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
    
    // Update call status in Firestore
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
    } catch (error) {
      console.error('Error ending call:', error);
    }

    // Cleanup
    cleanup();
    setIsCallActive(false);
    
    if (onClose) onClose();
  }, [roomId, currentUser.uid, userName, userType, callDuration, onClose, cleanup]);

  // Fetch other participant info
  useEffect(() => {
    const fetchCallData = async () => {
      try {
        const callRef = doc(db, 'calls', roomId);
        const callDoc = await getDoc(callRef);
        
        if (callDoc.exists()) {
          const callData = callDoc.data();
          if (callData.initiator === currentUser.uid) {
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
    
    const initCall = async () => {
      try {
        const callDoc = await getDoc(doc(db, 'calls', roomId));
        
        if (!callDoc.exists()) {
          setError('Call session not found');
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

  return (
    <div className="video-call-container">
      {error && (
        <div className="error-overlay">
          <p>{error}</p>
          <button onClick={handleEndCall}>Close</button>
        </div>
      )}

      <div className="video-grid">
        {/* Remote Video */}
        <div className="remote-video-wrapper">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
          />
          {connectionStatus === 'connecting' && !error && (
            <div className="connecting-overlay">
              <div className="spinner"></div>
              <p>Connecting to {otherParticipant?.name || 'doctor'}...</p>
            </div>
          )}
          <div className="remote-label">{otherParticipant?.name || 'Doctor'}</div>
        </div>

        {/* Local Video (Picture-in-Picture) */}
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

      {/* Call Controls */}
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