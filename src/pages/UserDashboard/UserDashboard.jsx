import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  getDoc, 
  addDoc, 
  orderBy, 
  serverTimestamp,
  onSnapshot,  // ✅ ADD THIS - was missing
  setDoc        // ✅ ADD THIS - was missing
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import VideoCall from '../../components/videocall/VideoCall';
import Chat from '../../components/Chat/Chat';
import './UserDashboard.css';
import SHA256 from "crypto-js/sha256";
import CryptoJS from "crypto-js";
import { getContract } from "../../blockchain/medicalContract";

const UserDashboard = () => {
  const { currentUser, userData, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [userPreferences, setUserPreferences] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [recordType, setRecordType] = useState("prescription");
  const [recordDescription, setRecordDescription] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentReason, setAppointmentReason] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [bookingError, setBookingError] = useState("");

  // New states for independent doctors
  const [independentDoctors, setIndependentDoctors] = useState([]);
  const [doctorType, setDoctorType] = useState("hospital"); // 'hospital' or 'independent'

  // State for hospital search with bed data
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [bedsByHospital, setBedsByHospital] = useState({});

  // State for bed requests
  const [bedRequests, setBedRequests] = useState([]);
  const [showBedRequestModal, setShowBedRequestModal] = useState(false);
  const [selectedHospitalForBed, setSelectedHospitalForBed] = useState(null);
  const [selectedBedInfo, setSelectedBedInfo] = useState(null);
  const [bedRequestForm, setBedRequestForm] = useState({
    patientName: "",
    patientAge: "",
    patientGender: "",
    condition: "",
    requiredWard: "General Ward",
    requiredDate: "",
    medicalDescription: "",
    emergency: false,
    doctorName: "",
    contactNumber: "",
    additionalNotes: "",
    oxygenLevel: "95",
    conditionSeverity: "normal",
  });
  const [bedRequestSuccess, setBedRequestSuccess] = useState("");
  const [bedRequestError, setBedRequestError] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    phone: "",
    address: "",
    bloodGroup: "",
    emergencyContact: "",
    dateOfBirth: "",
    allergies: "",
    chronicConditions: "",
    medications: "",
  });

  // Video call and chat states
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [activeCallRoom, setActiveCallRoom] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [selectedDoctorForChat, setSelectedDoctorForChat] = useState(null);
  const [chatList, setChatList] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState({});

  const navigate = useNavigate();

  // Fetch independent doctors from top-level doctors collection
  useEffect(() => {
    const fetchIndependentDoctors = async () => {
      try {
        const doctorsRef = collection(db, "doctors");
        const q = query(
          doctorsRef,
          where("status", "==", "approved"),
          where("isActive", "==", true),
        );
        const doctorsSnapshot = await getDocs(q);
        const doctorsData = doctorsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setIndependentDoctors(doctorsData);
      } catch (error) {
        console.error("Error fetching independent doctors:", error);
      }
    };

    fetchIndependentDoctors();
  }, []);

  // Fetch hospitals with real-time bed updates
  useEffect(() => {
    const fetchHospitalsWithBeds = async () => {
      try {
        const hospitalsRef = collection(db, "hospitals");
        const hospitalsSnapshot = await getDocs(hospitalsRef);
        const hospitalsData = hospitalsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setHospitals(hospitalsData);

        // Fetch beds for each hospital
        for (const hospital of hospitalsData) {
          const bedsRef = collection(db, "hospitals", hospital.id, "beds");
          const bedsSnapshot = await getDocs(bedsRef);
          const beds = bedsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setBedsByHospital((prev) => ({
            ...prev,
            [hospital.id]: beds,
          }));
        }
      } catch (error) {
        console.error("Error fetching hospitals:", error);
      }
    };

    fetchHospitalsWithBeds();
  }, []);

  // Modified fetchDoctors to handle both hospital and independent doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      if (doctorType === "hospital" && selectedHospital) {
        try {
          const doctorsRef = collection(
            db,
            "hospitals",
            selectedHospital,
            "doctors",
          );
          const doctorsSnapshot = await getDocs(doctorsRef);
          const doctorsData = doctorsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            doctorType: "hospital",
            hospitalId: selectedHospital,
          }));
          setDoctors(doctorsData);
        } catch (error) {
          console.error("Error fetching hospital doctors:", error);
        }
      } else if (doctorType === "independent") {
        setDoctors(independentDoctors);
      }
    };

    fetchDoctors();
  }, [selectedHospital, doctorType, independentDoctors]);

  // Initialize chat with doctor
  const initChatWithDoctor = async (doctorId, doctorName) => {
    try {
      const chatId = [currentUser.uid, doctorId].sort().join("_");
      const chatRef = doc(db, "chats", chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [currentUser.uid, doctorId],
          participantNames: {
            [currentUser.uid]: userData?.displayName,
            [doctorId]: doctorName,
          },
          participantTypes: {
            [currentUser.uid]: "patient",
            [doctorId]: "doctor",
          },
          createdAt: new Date(),
          lastMessage: "",
          lastMessageTime: new Date(),
          unreadCount: {
            [currentUser.uid]: 0,
            [doctorId]: 0,
          },
        });
      }

      setActiveChat(chatId);
      setSelectedDoctorForChat({ id: doctorId, name: doctorName });
      setShowChat(true);
    } catch (error) {
      console.error("Error initializing chat:", error);
    }
  };

  // Initiate video call with doctor
  const initiateVideoCall = async (doctorId, doctorName) => {
    try {
      const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const callRef = doc(db, "calls", roomId);

      await setDoc(callRef, {
        roomId,
        initiator: currentUser.uid,
        initiatorName: userData?.displayName,
        initiatorType: "patient",
        participant: doctorId,
        participantName: doctorName,
        status: "waiting",
        createdAt: new Date(),
      });

      setActiveCallRoom(roomId);
      setShowVideoCall(true);
    } catch (error) {
      console.error("Error initiating video call:", error);
    }
  };

  // Listen for chats
  useEffect(() => {
    if (!currentUser) return;

    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid),
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const chats = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChatList(chats);

      // Calculate unread messages
      const unread = {};
      chats.forEach((chat) => {
        const count = chat.unreadCount?.[currentUser.uid] || 0;
        if (count > 0) {
          const otherParticipant = chat.participants.find(
            (p) => p !== currentUser.uid,
          );
          unread[otherParticipant] = count;
        }
      });
      setUnreadMessages(unread);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Listen for incoming calls
  useEffect(() => {
    if (!currentUser) return;

    const callsQuery = query(
      collection(db, "calls"),
      where("participant", "==", currentUser.uid),
      where("status", "==", "waiting"),
    );

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const call = change.doc.data();
          if (
            window.confirm(
              `${call.initiatorName} (${call.initiatorType}) is calling you. Accept?`,
            )
          ) {
            setActiveCallRoom(call.roomId);
            setShowVideoCall(true);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);

        if (!currentUser) return;

        // Fetch user preferences
        const prefRef = doc(db, "userPreferences", currentUser.uid);
        const prefDoc = await getDoc(prefRef);
        if (prefDoc.exists()) {
          setUserPreferences(prefDoc.data());
        }

        // Fetch medical records
        const medicalQuery = query(
          collection(db, "medicalRecords"),
          where("userId", "==", currentUser.uid),
          orderBy("uploadedAt", "desc"),
        );
        const medicalSnapshot = await getDocs(medicalQuery);
        const medicalData = medicalSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMedicalRecords(medicalData);

        // Fetch appointments
        const appointmentsQuery = query(
          collection(db, "appointments"),
          where("userId", "==", currentUser.uid),
          orderBy("date", "desc"),
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const appointmentsData = appointmentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAppointments(appointmentsData);

        // Fetch bed requests from all hospitals
        const allBedRequests = [];
        for (const hospital of hospitals) {
          const bedRequestsQuery = query(
            collection(db, "hospitals", hospital.id, "bedRequests"),
            where("userId", "==", currentUser.uid),
            orderBy("createdAt", "desc"),
          );
          const bedRequestsSnapshot = await getDocs(bedRequestsQuery);
          const bedRequestsData = bedRequestsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            hospitalName: hospital.name,
          }));
          allBedRequests.push(...bedRequestsData);
        }
        setBedRequests(
          allBedRequests.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          ),
        );

        // Initialize form data
        if (userData) {
          setFormData({
            displayName: userData.displayName || "",
            phone: userData.phone || "",
            address: userData.address || "",
            bloodGroup: userData.bloodGroup || "",
            emergencyContact: userData.emergencyContact || "",
            dateOfBirth: userData.dateOfBirth || "",
            allergies: userData.allergies || "",
            chronicConditions: userData.chronicConditions || "",
            medications: userData.medications || "",
          });

          // Initialize bed request form with user data
          setBedRequestForm((prev) => ({
            ...prev,
            patientName: userData.displayName || "",
            contactNumber: userData.phone || "",
            patientAge: userData.dateOfBirth
              ? calculateAge(userData.dateOfBirth)
              : "",
            patientGender: userData.gender || "",
          }));
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser && userData) {
      fetchUserData();
    }
  }, [currentUser, userData, hospitals]);

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return "";
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age.toString();
  };

  const searchHospitals = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const filtered = hospitals.filter(
        (hospital) =>
          hospital.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          hospital.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          hospital.state?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          hospital.pincode?.includes(searchQuery),
      );

      const filteredWithBeds = filtered.map((hospital) => ({
        ...hospital,
        beds: bedsByHospital[hospital.id] || [],
      }));

      setSearchResults(filteredWithBeds);
    } catch (error) {
      console.error("Error searching hospitals:", error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (showSearchModal) {
        searchHospitals();
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, showSearchModal]);

  const handleBedRequestSubmit = async (e) => {
    e.preventDefault();

    if (!selectedHospitalForBed) {
      setBedRequestError("Please select a hospital");
      return;
    }

    if (
      !bedRequestForm.patientName ||
      !bedRequestForm.requiredWard ||
      !bedRequestForm.requiredDate
    ) {
      setBedRequestError("Please fill in all required fields");
      return;
    }

    setSubmittingRequest(true);
    setBedRequestError("");
    setBedRequestSuccess("");

    try {
      const { score: priority, log: priorityLog } =
        calculatePriorityScore(bedRequestForm);
      const recommendedBedType = determineBedType(priority);

      const bedRequestData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        hospitalId: selectedHospitalForBed.id,
        hospitalName: selectedHospitalForBed.name,
        hospitalCity: selectedHospitalForBed.city,
        hospitalPhone: selectedHospitalForBed.phone,
        ...bedRequestForm,
        priority,
        priorityLog,
        recommendedBedType,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        requestId: `BED_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      const notificationData = {
        hospitalId: selectedHospitalForBed.id,
        userId: currentUser.uid,
        userName: bedRequestForm.patientName,
        type: "bed_request",
        message: `New bed request from ${bedRequestForm.patientName}`,
        requestId: bedRequestData.requestId,
        status: "unread",
        createdAt: serverTimestamp(),
        bedRequest: bedRequestData,
      };

      const notificationsRef = collection(
        db,
        "hospitals",
        selectedHospitalForBed.id,
        "notifications",
      );
      await addDoc(notificationsRef, notificationData);

      const requestsRef = collection(
        db,
        "hospitals",
        selectedHospitalForBed.id,
        "bedRequests",
      );
      const docRef = await addDoc(requestsRef, bedRequestData);

      setBedRequests((prev) => [
        {
          id: docRef.id,
          ...bedRequestData,
          createdAt: new Date().toISOString(),
          hospitalName: selectedHospitalForBed.name,
        },
        ...prev,
      ]);

      setBedRequestSuccess(
        `Bed request sent successfully to ${selectedHospitalForBed.name}! AI Priority Score: ${priority}. The hospital will contact you soon.`,
      );

      setTimeout(() => {
        setBedRequestSuccess("");
        setShowBedRequestModal(false);
        setSelectedHospitalForBed(null);
        setSelectedBedInfo(null);
        setBedRequestForm({
          patientName: userData?.displayName || "",
          patientAge: userData?.dateOfBirth
            ? calculateAge(userData.dateOfBirth)
            : "",
          patientGender: userData?.gender || "",
          condition: "",
          requiredWard: "General Ward",
          requiredDate: "",
          medicalDescription: "",
          emergency: false,
          doctorName: "",
          contactNumber: userData?.phone || "",
          additionalNotes: "",
          oxygenLevel: "95",
          conditionSeverity: "normal",
        });
      }, 3000);
    } catch (error) {
      console.error("Error submitting bed request:", error);
      setBedRequestError("Failed to submit bed request. Please try again.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const calculatePriorityScore = (patient) => {
    let score = 0;
    const log = [];

    if (patient.emergency) {
      score += 50;
      log.push("Emergency: +50");
    }

    const oxygenLevel = parseInt(patient.oxygenLevel) || 95;
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

    const age = parseInt(patient.patientAge) || 0;
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

    if (patient.conditionSeverity === "critical") {
      score += 35;
      log.push("Critical condition: +35");
    } else if (patient.conditionSeverity === "severe") {
      score += 20;
      log.push("Severe condition: +20");
    } else if (patient.conditionSeverity === "moderate") {
      score += 10;
      log.push("Moderate condition: +10");
    }

    const criticalKeywords = [
      "heart",
      "stroke",
      "bleeding",
      "sepsis",
      "respiratory",
      "failure",
      "cancer",
      "tumor",
    ];
    const diagnosis = (patient.medicalDescription || "").toLowerCase();
    criticalKeywords.forEach((keyword) => {
      if (diagnosis.includes(keyword)) {
        score += 15;
        log.push(`Keyword "${keyword}": +15`);
      }
    });

    const finalScore = Math.min(score, 100);
    return { score: finalScore, log };
  };

  const determineBedType = (priority) => {
    if (priority >= 70) return "ICU";
    if (priority >= 50) return "Emergency";
    if (priority >= 40) return "Surgical";
    return "General Ward";
  };

  const handleBedRequestInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBedRequestForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openBedRequestModal = (hospital, bedInfo = null) => {
    setSelectedHospitalForBed(hospital);
    setSelectedBedInfo(bedInfo);
    setShowBedRequestModal(true);
    if (bedInfo) {
      setBedRequestForm((prev) => ({
        ...prev,
        requiredWard: bedInfo.type,
      }));
    }
  };

  const handleLogoClick = () => {
    navigate("/");
    document.body.classList.remove("dashboard-mode");
  };

  const handleLogout = async () => {
    try {
      await logout();
      document.body.classList.remove("dashboard-mode");
      navigate("/");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        ...formData,
        profileComplete: true,
        updatedAt: new Date().toISOString(),
      });
      setEditMode(false);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("File size too large. Max 10MB allowed.");
        return;
      }
      setSelectedFile(file);
      setUploadError("");
    }
  };

  const handleUploadRecord = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setUploadError("Please select a file to upload");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const recordId = `${currentUser.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const fileHash = await generateFileHash(selectedFile);

      const timestamp = Date.now();
      const fileName = `${timestamp}_${selectedFile.name}`;

      const storageRef = ref(
        storage,
        `medicalRecords/${currentUser.uid}/${recordType}/${fileName}`,
      );

      await uploadBytes(storageRef, selectedFile);
      const fileUrl = await getDownloadURL(storageRef);

      const blockchainTx = await storeHashOnBlockchain(
        currentUser.uid,
        recordId,
        fileHash,
        recordType,
        selectedFile.name,
      );

      const recordData = {
        userId: currentUser.uid,
        recordId: recordId,
        type: recordType,
        fileName: selectedFile.name,
        fileUrl: fileUrl,
        description: recordDescription,
        uploadedAt: new Date().toISOString(),
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        blockchainHash: fileHash,
        blockchainTx: blockchainTx,
      };

      const docRef = await addDoc(collection(db, "medicalRecords"), recordData);

      setMedicalRecords((prev) => [
        {
          id: docRef.id,
          ...recordData,
        },
        ...prev,
      ]);

      setUploadSuccess(
        "Record uploaded securely with blockchain verification!",
      );
      setSelectedFile(null);
      setRecordDescription("");
      document.getElementById("fileInput").value = "";
    } catch (error) {
      console.error("Error uploading record:", error);
      setUploadError("Failed to upload record. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Updated handleBookAppointment to support both doctor types
  // In UserDashboard.jsx - Update handleBookAppointment function
  const handleBookAppointment = async (e) => {
    e.preventDefault();

    if (!selectedDoctor || !appointmentDate || !appointmentTime) {
      setBookingError("Please fill in all required fields");
      return;
    }

    if (doctorType === "hospital" && !selectedHospital) {
      setBookingError("Please select a hospital");
      return;
    }

    setBookingError("");
    setBookingSuccess("");

    try {
      const selectedDoctorObj = doctors.find((d) => d.id === selectedDoctor);

      let appointmentData;

      if (doctorType === "independent") {
        appointmentData = {
          // Use consistent field names
          patientId: currentUser.uid, // ← ADD THIS (use patientId, not userId)
          patientName: userData?.displayName || "User",
          patientEmail: currentUser.email,
          patientPhone: userData?.phone || "",
          doctorId: selectedDoctor,
          doctorName: selectedDoctorObj?.name || "",
          doctorEmail: selectedDoctorObj?.email || "",
          doctorSpecialization: selectedDoctorObj?.specialization || "General",
          doctorType: "independent",
          clinicName: selectedDoctorObj?.clinicName || "",
          clinicAddress: selectedDoctorObj?.clinicAddress || "",
          clinicCity: selectedDoctorObj?.clinicCity || "",
          clinicPincode: selectedDoctorObj?.clinicPincode || "",
          clinicPhone: selectedDoctorObj?.clinicPhone || "",
          consultationFee:
            selectedDoctorObj?.consultation_fee ||
            selectedDoctorObj?.online_fee ||
            500,
          date: appointmentDate,
          time: appointmentTime,
          reason: appointmentReason,
          status: "scheduled",
          createdAt: new Date().toISOString(),
        };
      } else {
        const selectedHospitalObj = hospitals.find(
          (h) => h.id === selectedHospital,
        );
        appointmentData = {
          // Use consistent field names
          patientId: currentUser.uid, // ← ADD THIS (use patientId, not userId)
          patientName: userData?.displayName || "User",
          patientEmail: currentUser.email,
          patientPhone: userData?.phone || "",
          hospitalId: selectedHospital,
          hospitalName: selectedHospitalObj?.name || "",
          doctorId: selectedDoctor,
          doctorName: selectedDoctorObj?.name || "",
          doctorEmail: selectedDoctorObj?.email || "",
          doctorSpecialization:
            selectedDoctorObj?.specialization ||
            selectedDoctorObj?.department ||
            "General",
          doctorType: "hospital",
          consultationFee:
            selectedDoctorObj?.consultation_fee ||
            selectedDoctorObj?.online_fee ||
            500,
          date: appointmentDate,
          time: appointmentTime,
          reason: appointmentReason,
          status: "scheduled",
          createdAt: new Date().toISOString(),
        };
      }

      const docRef = await addDoc(
        collection(db, "appointments"),
        appointmentData,
      );

      setAppointments((prev) => [
        {
          id: docRef.id,
          ...appointmentData,
        },
        ...prev,
      ]);

      setBookingSuccess("Appointment booked successfully!");
      setSelectedHospital("");
      setSelectedDoctor("");
      setAppointmentDate("");
      setAppointmentTime("");
      setAppointmentReason("");
      setDoctorType("hospital");

      setTimeout(() => setBookingSuccess(""), 3000);
    } catch (error) {
      console.error("Error booking appointment:", error);
      setBookingError("Failed to book appointment. Please try again.");
    }
  };

  const getRecordTypeIcon = (type) => {
    switch (type) {
      case "prescription":
        return "📋";
      case "lab-report":
        return "🔬";
      case "scan":
        return "🖥️";
      case "xray":
        return "📸";
      case "mri":
        return "🧠";
      default:
        return "📄";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const storeHashOnBlockchain = async (
    patientId,
    recordId,
    hash,
    recordType,
    fileName,
  ) => {
    try {
      const contract = await getContract();
      if (!contract) return null;

      const provider = contract.runner?.provider;

      if (provider) {
        const code = await provider.getCode(
          contract.target || contract.address,
        );
        if (code === "0x" || code === "0x0") {
          console.error("No contract found at this address!");
          return null;
        }
      }

      const tx = await contract.addRecord(
        patientId,
        recordId,
        hash,
        recordType,
        fileName,
      );
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error("Blockchain error details:", error);
      return null;
    }
  };

  const generateFileHash = async (file) => {
    const buffer = await file.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(buffer);
    const hash = SHA256(wordArray).toString();
    return hash;
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "pending":
        return "status-pending";
      case "approved":
        return "status-approved";
      case "rejected":
        return "status-rejected";
      case "allocated":
        return "status-allocated";
      default:
        return "status-pending";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "pending":
        return "⏳ Pending";
      case "approved":
        return "✅ Approved";
      case "rejected":
        return "❌ Rejected";
      case "allocated":
        return "🛏️ Bed Allocated";
      default:
        return "⏳ Pending";
    }
  };

  const getBedTypeIcon = (type) => {
    const icons = {
      ICU: "💙",
      Emergency: "🚨",
      Surgical: "💚",
      "General Ward": "🛏️",
      "Private Room": "🏠",
    };
    return icons[type] || "🛏️";
  };

  if (loading) {
    return (
      <div className="user-dashboard">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <div className="loading-spinner"></div>
          <p style={{ marginLeft: "15px" }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "overview", label: "Dashboard Overview", icon: "📊" },
    { id: "profile", label: "Health Profile", icon: "👤" },
    { id: "appointments", label: "Appointment Booking", icon: "📅" },
    { id: "bed-requests", label: "Bed Requests", icon: "🛏️" },
    { id: "upload", label: "Upload Medical Records", icon: "📤" },
    { id: "records", label: "View Medical Records", icon: "📁" },
    { id: "prescriptions", label: "Prescriptions", icon: "📋" },
    { id: "lab-reports", label: "Lab Reports", icon: "🔬" },
    { id: "scans", label: "Scans (X-ray, MRI)", icon: "🖥️" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="user-dashboard">
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
              userType="patient"
              userName={
                userData?.displayName || currentUser?.displayName || "Patient"
              }
              onClose={() => {
                setShowVideoCall(false);
                setActiveCallRoom(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChat && activeChat && selectedDoctorForChat && (
        <div className="modal-overlay">
          <div className="modal-content chat-modal">
            <button
              className="modal-close"
              onClick={() => {
                setShowChat(false);
                setActiveChat(null);
                setSelectedDoctorForChat(null);
              }}
            >
              ×
            </button>
            <Chat
              chatId={activeChat}
              currentUser={currentUser}
              otherUser={selectedDoctorForChat}
              userType="patient"
              onVideoCall={() => {
                setShowChat(false);
                if (selectedDoctorForChat) {
                  initiateVideoCall(
                    selectedDoctorForChat.id,
                    selectedDoctorForChat.name,
                  );
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="dashboard-header">
        <div className="header-content">
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div
              onClick={handleLogoClick}
              style={{ cursor: "pointer" }}
              title="Go to Home"
            >
              <img
                src="/images/logo.png"
                alt="SwasthyaSetu Logo"
                className="dashboard-logo"
                onError={(e) => {
                  e.target.src = "/images/default-logo.png";
                }}
                style={{ width: "60px", height: "60px", borderRadius: "8px" }}
              />
            </div>

            <div className="user-info-header">
              <img
                src={currentUser?.photoURL || "/images/default-avatar.png"}
                alt="Profile"
                className="dashboard-avatar"
                onError={(e) => {
                  e.target.src = "/images/default-avatar.png";
                }}
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  border: "3px solid white",
                }}
              />
              <div>
                <h1>Welcome, {userData?.displayName || "User"}!</h1>
                <p>{userData?.email}</p>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "15px",
              alignItems: "center",
              position: "relative",
            }}
          >
            {/* Unread messages badge */}
            {/* Unread messages badge - FIXED */}
            {(() => {
              const totalUnread = Object.values(unreadMessages).reduce(
                (a, b) => {
                  // Make sure values are numbers, not timestamps
                  const numA = typeof a === "number" ? a : 0;
                  const numB = typeof b === "number" ? b : 0;
                  return numA + numB;
                },
                0,
              );

              return totalUnread > 0 ? (
                <div className="unread-badge">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </div>
              ) : null;
            })()}
            <button
              onClick={() => setShowSearchModal(true)}
              className="logout-btn"
              style={{
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              🔍 Search Hospitals
            </button>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Hospital Search Modal */}
      {showSearchModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowSearchModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔍 Search Hospitals</h2>
              <button
                className="modal-close"
                onClick={() => setShowSearchModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="search-input-container">
                <input
                  type="text"
                  placeholder="Search by hospital name, city, or pincode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  autoFocus
                />
                {searching && <div className="search-spinner"></div>}
              </div>

              <div className="search-results">
                {searchResults.length > 0 ? (
                  searchResults.map((hospital) => {
                    const beds = hospital.beds || [];
                    const bedsByType = {};
                    beds.forEach((bed) => {
                      if (!bedsByType[bed.type]) {
                        bedsByType[bed.type] = { total: 0, available: 0 };
                      }
                      bedsByType[bed.type].total++;
                      if (bed.status === "available")
                        bedsByType[bed.type].available++;
                    });

                    return (
                      <div key={hospital.id} className="hospital-card">
                        <div className="hospital-header">
                          <h3>{hospital.name}</h3>
                          <span
                            className={`hospital-status status-${hospital.status || "approved"}`}
                          >
                            {hospital.status || "approved"}
                          </span>
                        </div>
                        <div className="hospital-details">
                          <p>
                            <strong>📍 Address:</strong> {hospital.city},{" "}
                            {hospital.state} - {hospital.pincode}
                          </p>
                          <p>
                            <strong>📞 Phone:</strong>{" "}
                            {hospital.phone || "Not available"}
                          </p>
                          <p>
                            <strong>📧 Email:</strong>{" "}
                            {hospital.email || "Not available"}
                          </p>
                          <p>
                            <strong>🏥 Type:</strong>{" "}
                            {hospital.type || "Hospital"}
                          </p>
                        </div>

                        <div className="bed-availability">
                          <h4>🛏️ Bed Availability</h4>
                          <div className="bed-stats">
                            {Object.entries(bedsByType).map(([type, stats]) => (
                              <div key={type} className="bed-stat">
                                <span className="bed-label">
                                  {getBedTypeIcon(type)} {type}:
                                </span>
                                <span
                                  className="bed-value"
                                  style={{
                                    color:
                                      stats.available > 0
                                        ? "#10b981"
                                        : "#ef4444",
                                  }}
                                >
                                  {stats.available}/{stats.total}
                                </span>
                              </div>
                            ))}
                          </div>

                          {beds.length > 0 && (
                            <div className="bed-data-detailed">
                              <h5>Available Beds by Floor:</h5>
                              {beds
                                .filter((bed) => bed.status === "available")
                                .slice(0, 5)
                                .map((bed) => (
                                  <div key={bed.id} className="ward-details">
                                    <strong>
                                      {getBedTypeIcon(bed.type)} {bed.type}
                                    </strong>{" "}
                                    - {bed.bedId}
                                    <span className="last-updated">
                                      {" "}
                                      (Floor {bed.floor}, Room {bed.roomNumber})
                                    </span>
                                    <button
                                      className="bed-request-btn-small"
                                      onClick={() =>
                                        openBedRequestModal(hospital, bed)
                                      }
                                      style={{
                                        marginLeft: "10px",
                                        padding: "2px 8px",
                                        fontSize: "11px",
                                      }}
                                    >
                                      Request This Bed
                                    </button>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>

                        {hospital.facilities &&
                          hospital.facilities.length > 0 && (
                            <div className="hospital-facilities">
                              <strong>🏥 Facilities:</strong>
                              <div className="facilities-list">
                                {hospital.facilities.map((facility, idx) => (
                                  <span key={idx} className="facility-tag">
                                    {facility}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        <div className="hospital-footer">
                          <span className="established-year">
                            Est. {hospital.year_established}
                          </span>
                          {hospital.emergency_phone && (
                            <span className="emergency-contact">
                              🚨 Emergency: {hospital.emergency_phone}
                            </span>
                          )}
                          <button
                            className="bed-request-btn"
                            onClick={() => openBedRequestModal(hospital)}
                          >
                            🛏️ Request Bed
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : searchQuery && !searching ? (
                  <div className="no-results">
                    <p>No hospitals found matching "{searchQuery}"</p>
                  </div>
                ) : (
                  !searching && (
                    <div className="search-placeholder">
                      <p>
                        🔍 Enter a hospital name, city, or pincode to search
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bed Request Modal */}
      {showBedRequestModal && selectedHospitalForBed && (
        <div
          className="modal-overlay"
          onClick={() => setShowBedRequestModal(false)}
        >
          <div
            className="modal-content bed-request-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>🛏️ Bed Request - {selectedHospitalForBed.name}</h2>
              <button
                className="modal-close"
                onClick={() => setShowBedRequestModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {bedRequestSuccess && (
                <div className="success-message">{bedRequestSuccess}</div>
              )}
              {bedRequestError && (
                <div className="error-message">{bedRequestError}</div>
              )}

              {selectedBedInfo && (
                <div
                  className="selected-bed-info"
                  style={{
                    background: "#e8f4fe",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "15px",
                  }}
                >
                  <strong>Recommended Bed:</strong> {selectedBedInfo.bedId} (
                  {selectedBedInfo.type}) - Floor {selectedBedInfo.floor}, Room{" "}
                  {selectedBedInfo.roomNumber}
                </div>
              )}

              <form onSubmit={handleBedRequestSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Patient Name *</label>
                    <input
                      type="text"
                      name="patientName"
                      value={bedRequestForm.patientName}
                      onChange={handleBedRequestInputChange}
                      required
                      placeholder="Enter patient name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Age *</label>
                    <input
                      type="number"
                      name="patientAge"
                      value={bedRequestForm.patientAge}
                      onChange={handleBedRequestInputChange}
                      required
                      placeholder="Enter age"
                    />
                  </div>

                  <div className="form-group">
                    <label>Gender *</label>
                    <select
                      name="patientGender"
                      value={bedRequestForm.patientGender}
                      onChange={handleBedRequestInputChange}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Contact Number *</label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={bedRequestForm.contactNumber}
                      onChange={handleBedRequestInputChange}
                      required
                      placeholder="Enter contact number"
                    />
                  </div>

                  <div className="form-group">
                    <label>Required Ward *</label>
                    <select
                      name="requiredWard"
                      value={bedRequestForm.requiredWard}
                      onChange={handleBedRequestInputChange}
                      required
                    >
                      <option value="General Ward">General Ward</option>
                      <option value="ICU">ICU</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Surgical">Surgical</option>
                      <option value="Private Room">Private Room</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Required Date *</label>
                    <input
                      type="date"
                      name="requiredDate"
                      value={bedRequestForm.requiredDate}
                      onChange={handleBedRequestInputChange}
                      min={new Date().toISOString().split("T")[0]}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Condition Severity</label>
                    <select
                      name="conditionSeverity"
                      value={bedRequestForm.conditionSeverity}
                      onChange={handleBedRequestInputChange}
                    >
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
                      value={bedRequestForm.oxygenLevel}
                      onChange={handleBedRequestInputChange}
                      min="0"
                      max="100"
                      placeholder="Enter oxygen saturation"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Medical Condition / Diagnosis</label>
                    <input
                      type="text"
                      name="condition"
                      value={bedRequestForm.condition}
                      onChange={handleBedRequestInputChange}
                      placeholder="e.g., Pneumonia, Fracture, etc."
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Detailed Medical Description</label>
                    <textarea
                      name="medicalDescription"
                      value={bedRequestForm.medicalDescription}
                      onChange={handleBedRequestInputChange}
                      rows="3"
                      placeholder="Describe the medical condition, symptoms, and any specific requirements..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Doctor's Name (if known)</label>
                    <input
                      type="text"
                      name="doctorName"
                      value={bedRequestForm.doctorName}
                      onChange={handleBedRequestInputChange}
                      placeholder="Enter doctor's name"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="emergency"
                        checked={bedRequestForm.emergency}
                        onChange={handleBedRequestInputChange}
                      />
                      This is an emergency case
                    </label>
                  </div>

                  <div className="form-group full-width">
                    <label>Additional Notes</label>
                    <textarea
                      name="additionalNotes"
                      value={bedRequestForm.additionalNotes}
                      onChange={handleBedRequestInputChange}
                      rows="2"
                      placeholder="Any additional information that might help..."
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowBedRequestModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="save-btn"
                    disabled={submittingRequest}
                  >
                    {submittingRequest
                      ? "Sending Request..."
                      : "Send Bed Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-container">
        <div className="dashboard-sidebar">
          <div
            className="sidebar-section"
            style={{ textAlign: "center", padding: "15px" }}
          >
            <img
              src="/images/logo.png"
              alt="Logo"
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "8px",
                border: "2px solid #4074e6",
              }}
              onError={(e) => {
                e.target.src = "/images/default-logo.png";
              }}
            />
            <h3 style={{ color: "#4074e6", margin: 0 }}>SwasthyaSetu</h3>
            <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              Your Health Partner
            </p>
          </div>

          <div className="sidebar-section">
            <h3>Main Menu</h3>
            <ul>
              {navItems.map((item) => (
                <li
                  key={item.id}
                  className={activeTab === item.id ? "active" : ""}
                  onClick={() => setActiveTab(item.id)}
                >
                  <span style={{ marginRight: "10px" }}>{item.icon}</span>
                  {item.label}
                  {item.id === "appointments" && appointments.length > 0 && (
                    <span className="nav-badge">{appointments.length}</span>
                  )}
                  {item.id === "bed-requests" && bedRequests.length > 0 && (
                    <span className="nav-badge">{bedRequests.length}</span>
                  )}
                  {item.id === "records" && medicalRecords.length > 0 && (
                    <span className="nav-badge">{medicalRecords.length}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="sidebar-section">
            <h3>Quick Stats</h3>
            <div style={{ fontSize: "14px" }}>
              <p>📅 Appointments: {appointments.length}</p>
              <p>🛏️ Bed Requests: {bedRequests.length}</p>
              <p>📁 Records: {medicalRecords.length}</p>
              <p>🩺 Health Score: {userData?.healthScore || "N/A"}</p>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          {activeTab === "overview" && (
            <div className="tab-content">
              <h2>Dashboard Overview</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">📅</div>
                  <div className="stat-details">
                    <h3>Appointments</h3>
                    <p className="stat-number">{appointments.length}</p>
                    <p className="stat-label">
                      Upcoming:{" "}
                      {
                        appointments.filter((a) => a.status === "scheduled")
                          .length
                      }
                    </p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🛏️</div>
                  <div className="stat-details">
                    <h3>Bed Requests</h3>
                    <p className="stat-number">{bedRequests.length}</p>
                    <p className="stat-label">
                      Pending:{" "}
                      {bedRequests.filter((r) => r.status === "pending").length}
                    </p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📁</div>
                  <div className="stat-details">
                    <h3>Medical Records</h3>
                    <p className="stat-number">{medicalRecords.length}</p>
                    <p className="stat-label">
                      Last uploaded:{" "}
                      {medicalRecords[0]?.uploadedAt?.split("T")[0] || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">❤️</div>
                  <div className="stat-details">
                    <h3>Health Status</h3>
                    <p className="stat-number">
                      {userData?.bloodGroup || "N/A"}
                    </p>
                    <p className="stat-label">Blood Group</p>
                  </div>
                </div>
              </div>

              <div className="recent-activity">
                <h3>Recent Bed Requests</h3>
                {bedRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="activity-item">
                    <span className="activity-icon">🛏️</span>
                    <div className="activity-details">
                      <p>
                        <strong>{request.hospitalName}</strong> -{" "}
                        {request.requiredWard}
                      </p>
                      <p className="activity-time">
                        Requested:{" "}
                        {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                      {request.priority && (
                        <p className="activity-time">
                          Priority Score: {request.priority}
                        </p>
                      )}
                    </div>
                    <span
                      className={`status-badge ${getStatusBadgeClass(request.status)}`}
                    >
                      {getStatusText(request.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="tab-content">
              <h2>Health Profile</h2>
              {!editMode ? (
                <div className="profile-view">
                  <div className="profile-header">
                    <img
                      src={
                        currentUser?.photoURL || "/images/default-avatar.png"
                      }
                      alt="Profile"
                      className="profile-avatar"
                    />
                    <div>
                      <h3>{userData?.displayName || "Not set"}</h3>
                      <p>{userData?.email}</p>
                    </div>
                    <button
                      className="edit-btn"
                      onClick={() => setEditMode(true)}
                    >
                      Edit Profile
                    </button>
                  </div>

                  <div className="profile-details-grid">
                    <div className="detail-item">
                      <label>Phone</label>
                      <p>{userData?.phone || "Not set"}</p>
                    </div>
                    <div className="detail-item">
                      <label>Date of Birth</label>
                      <p>{userData?.dateOfBirth || "Not set"}</p>
                    </div>
                    <div className="detail-item">
                      <label>Blood Group</label>
                      <p className="blood-group">
                        {userData?.bloodGroup || "Not set"}
                      </p>
                    </div>
                    <div className="detail-item">
                      <label>Emergency Contact</label>
                      <p>{userData?.emergencyContact || "Not set"}</p>
                    </div>
                    <div className="detail-item full-width">
                      <label>Address</label>
                      <p>{userData?.address || "Not set"}</p>
                    </div>
                    <div className="detail-item full-width">
                      <label>Allergies</label>
                      <p>{userData?.allergies || "None reported"}</p>
                    </div>
                    <div className="detail-item full-width">
                      <label>Chronic Conditions</label>
                      <p>{userData?.chronicConditions || "None reported"}</p>
                    </div>
                    <div className="detail-item full-width">
                      <label>Current Medications</label>
                      <p>{userData?.medications || "None reported"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleProfileUpdate}
                  className="profile-edit-form"
                >
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input
                        type="text"
                        name="displayName"
                        value={formData.displayName}
                        onChange={handleInputChange}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Blood Group</label>
                      <select
                        name="bloodGroup"
                        value={formData.bloodGroup}
                        onChange={handleInputChange}
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
                      <label>Emergency Contact</label>
                      <input
                        type="tel"
                        name="emergencyContact"
                        value={formData.emergencyContact}
                        onChange={handleInputChange}
                        placeholder="Emergency contact number"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Address</label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Enter your address"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Allergies</label>
                      <textarea
                        name="allergies"
                        value={formData.allergies}
                        onChange={handleInputChange}
                        placeholder="List any allergies (comma separated)"
                        rows="2"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Chronic Conditions</label>
                      <textarea
                        name="chronicConditions"
                        value={formData.chronicConditions}
                        onChange={handleInputChange}
                        placeholder="List any chronic conditions"
                        rows="2"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Current Medications</label>
                      <textarea
                        name="medications"
                        value={formData.medications}
                        onChange={handleInputChange}
                        placeholder="List current medications"
                        rows="2"
                      />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="save-btn">
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === "appointments" && (
            <div className="tab-content">
              <h2>Book Appointment</h2>

              {bookingSuccess && (
                <div className="success-message">{bookingSuccess}</div>
              )}
              {bookingError && (
                <div className="error-message">{bookingError}</div>
              )}

              <div className="booking-form">
                <form onSubmit={handleBookAppointment}>
                  {/* Doctor Type Selection */}
                  <div className="form-group">
                    <label>Doctor Type *</label>
                    <div
                      style={{
                        display: "flex",
                        gap: "20px",
                        marginTop: "10px",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <input
                          type="radio"
                          value="hospital"
                          checked={doctorType === "hospital"}
                          onChange={(e) => {
                            setDoctorType(e.target.value);
                            setSelectedHospital("");
                            setSelectedDoctor("");
                          }}
                        />
                        🏥 Hospital Doctor
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <input
                          type="radio"
                          value="independent"
                          checked={doctorType === "independent"}
                          onChange={(e) => {
                            setDoctorType(e.target.value);
                            setSelectedHospital("");
                            setSelectedDoctor("");
                          }}
                        />
                        👨‍⚕️ Independent Doctor
                      </label>
                    </div>
                  </div>

                  {/* Hospital Selection - Only for hospital doctors */}
                  {doctorType === "hospital" && (
                    <div className="form-group">
                      <label>Select Hospital *</label>
                      <select
                        value={selectedHospital}
                        onChange={(e) => setSelectedHospital(e.target.value)}
                        required
                      >
                        <option value="">Choose a hospital</option>
                        {hospitals.map((hospital) => (
                          <option key={hospital.id} value={hospital.id}>
                            {hospital.name} - {hospital.city}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Doctor Selection */}
                  <div className="form-group">
                    <label>Select Doctor *</label>
                    <select
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      required
                      disabled={doctorType === "hospital" && !selectedHospital}
                    >
                      <option value="">Choose a doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name} -{" "}
                          {doctor.specialization ||
                            doctor.department ||
                            "General"}
                          {doctor.doctorType === "independent" &&
                            " (Independent)"}
                          {doctor.doctorType === "hospital" &&
                            doctor.hospitalName &&
                            ` - ${doctor.hospitalName}`}
                          {doctor.experience_years &&
                            ` - ${doctor.experience_years} yrs exp`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Doctor Details Display */}
                  {selectedDoctor &&
                    doctors.find((d) => d.id === selectedDoctor) && (
                      <div
                        className="doctor-info"
                        style={{
                          background: "#f0f7ff",
                          padding: "15px",
                          borderRadius: "8px",
                          marginBottom: "20px",
                          borderLeft: "4px solid #4074e6",
                        }}
                      >
                        <h4 style={{ margin: "0 0 10px 0", color: "#4074e6" }}>
                          Doctor Details
                        </h4>
                        {(() => {
                          const selectedDoc = doctors.find(
                            (d) => d.id === selectedDoctor,
                          );
                          return (
                            <>
                              <p>
                                <strong>👨‍⚕️ Name:</strong> {selectedDoc.name}
                              </p>
                              <p>
                                <strong>🎓 Qualification:</strong>{" "}
                                {selectedDoc.qualification || "MBBS"}
                              </p>
                              <p>
                                <strong>🔬 Specialization:</strong>{" "}
                                {selectedDoc.specialization ||
                                  selectedDoc.department ||
                                  "General Medicine"}
                              </p>
                              <p>
                                <strong>⭐ Experience:</strong>{" "}
                                {selectedDoc.experience_years ||
                                  selectedDoc.totalExperienceYears ||
                                  0}{" "}
                                years
                              </p>
                              <p>
                                <strong>📞 Contact:</strong>{" "}
                                {selectedDoc.phone ||
                                  selectedDoc.clinicPhone ||
                                  "N/A"}
                              </p>
                              {selectedDoc.doctorType === "independent" && (
                                <>
                                  <p>
                                    <strong>🏪 Clinic:</strong>{" "}
                                    {selectedDoc.clinicName || "N/A"}
                                  </p>
                                  <p>
                                    <strong>📍 Address:</strong>{" "}
                                    {selectedDoc.clinicAddress},{" "}
                                    {selectedDoc.clinicCity} -{" "}
                                    {selectedDoc.clinicPincode}
                                  </p>
                                  <p>
                                    <strong>💰 Fees:</strong> ₹
                                    {selectedDoc.consultation_fee ||
                                      selectedDoc.online_fee ||
                                      500}
                                  </p>
                                </>
                              )}
                              {selectedDoc.doctorType === "hospital" && (
                                <>
                                  <p>
                                    <strong>🏥 Hospital:</strong>{" "}
                                    {selectedDoc.hospitalName}
                                  </p>
                                  <p>
                                    <strong>💰 Fees:</strong> ₹
                                    {selectedDoc.consultation_fee ||
                                      selectedDoc.online_fee ||
                                      500}
                                  </p>
                                </>
                              )}
                              {selectedDoc.opd_days &&
                                selectedDoc.opd_days.length > 0 && (
                                  <p>
                                    <strong>📅 OPD Days:</strong>{" "}
                                    {selectedDoc.opd_days.join(", ")}
                                  </p>
                                )}
                              {selectedDoc.opd_time && (
                                <p>
                                  <strong>⏰ OPD Time:</strong>{" "}
                                  {selectedDoc.opd_time}
                                </p>
                              )}
                              {/* Add Video Call and Chat Buttons */}
                              <div
                                style={{
                                  marginTop: "15px",
                                  display: "flex",
                                  gap: "10px",
                                }}
                              >
                                <button
                                  type="button"
                                  className="video-call-btn"
                                  onClick={() =>
                                    initiateVideoCall(
                                      selectedDoc.id,
                                      selectedDoc.name,
                                    )
                                  }
                                  style={{
                                    padding: "8px 15px",
                                    background: "#e74c3c",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                  }}
                                >
                                  📹 Request Video Call
                                </button>
                                <button
                                  type="button"
                                  className="chat-btn"
                                  onClick={() =>
                                    initChatWithDoctor(
                                      selectedDoc.id,
                                      selectedDoc.name,
                                    )
                                  }
                                  style={{
                                    padding: "8px 15px",
                                    background: "#3498db",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                  }}
                                >
                                  💬 Chat with Doctor
                                  {unreadMessages[selectedDoc.id] > 0 && (
                                    <span
                                      className="unread-count"
                                      style={{
                                        marginLeft: "5px",
                                        background: "#e74c3c",
                                        borderRadius: "50%",
                                        padding: "2px 6px",
                                        fontSize: "10px",
                                      }}
                                    >
                                      {unreadMessages[selectedDoc.id]}
                                    </span>
                                  )}
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Time *</label>
                      <input
                        type="time"
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Reason for Visit</label>
                    <textarea
                      value={appointmentReason}
                      onChange={(e) => setAppointmentReason(e.target.value)}
                      placeholder="Briefly describe your symptoms or reason for appointment"
                      rows="3"
                    />
                  </div>

                  <button type="submit" className="book-btn">
                    Book Appointment
                  </button>
                </form>
              </div>

              <div className="appointments-list">
                <h3>Your Appointments</h3>
                {appointments.length > 0 ? (
                  appointments.map((apt) => (
                    <div key={apt.id} className="appointment-card">
                      <div className="appointment-header">
                        <span className="appointment-date">{apt.date}</span>
                        <span className="appointment-time">{apt.time}</span>
                        <span className={`status-badge status-${apt.status}`}>
                          {apt.status}
                        </span>
                      </div>
                      <div className="appointment-details">
                        <p>
                          <strong>Doctor:</strong> {apt.doctorName}
                        </p>
                        <p>
                          <strong>Specialization:</strong>{" "}
                          {apt.doctorSpecialization || "General"}
                        </p>
                        <p>
                          <strong>
                            {apt.doctorType === "independent"
                              ? "Clinic"
                              : "Hospital"}
                            :
                          </strong>{" "}
                          {apt.doctorType === "independent"
                            ? apt.clinicName
                            : apt.hospitalName}
                        </p>
                        {apt.clinicAddress && (
                          <p>
                            <strong>📍 Address:</strong> {apt.clinicAddress},{" "}
                            {apt.clinicCity}
                          </p>
                        )}
                        {apt.reason && (
                          <p>
                            <strong>Reason:</strong> {apt.reason}
                          </p>
                        )}
                        <p>
                          <strong>💰 Fee:</strong> ₹{apt.consultationFee || 500}
                        </p>

                        {/* Add Video Call and Chat buttons to existing appointments */}
                        <div
                          style={{
                            marginTop: "15px",
                            display: "flex",
                            gap: "10px",
                          }}
                        >
                          <button
                            className="video-call-btn"
                            onClick={() =>
                              initiateVideoCall(apt.doctorId, apt.doctorName)
                            }
                            style={{
                              padding: "6px 12px",
                              background: "#e74c3c",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            📹 Video Call
                          </button>
                          <button
                            className="chat-btn"
                            onClick={() =>
                              initChatWithDoctor(apt.doctorId, apt.doctorName)
                            }
                            style={{
                              padding: "6px 12px",
                              background: "#3498db",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            💬 Chat
                            {unreadMessages[apt.doctorId] > 0 && (
                              <span
                                className="unread-count"
                                style={{
                                  marginLeft: "5px",
                                  background: "#e74c3c",
                                  borderRadius: "50%",
                                  padding: "2px 6px",
                                  fontSize: "10px",
                                }}
                              >
                                {unreadMessages[apt.doctorId]}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-data">No appointments booked yet.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "bed-requests" && (
            <div className="tab-content">
              <h2>🛏️ My Bed Requests</h2>

              {bedRequests.length > 0 ? (
                <div className="bed-requests-list">
                  {bedRequests.map((request) => (
                    <div key={request.id} className="bed-request-card">
                      <div className="bed-request-header">
                        <h3>{request.hospitalName}</h3>
                        <span
                          className={`status-badge ${getStatusBadgeClass(request.status)}`}
                        >
                          {getStatusText(request.status)}
                        </span>
                      </div>
                      <div className="bed-request-details">
                        <div className="detail-row">
                          <span className="detail-label">Request ID:</span>
                          <span className="detail-value">
                            {request.requestId}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Required Ward:</span>
                          <span className="detail-value">
                            {request.requiredWard}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Required Date:</span>
                          <span className="detail-value">
                            {new Date(
                              request.requiredDate,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        {request.priority && (
                          <div className="detail-row">
                            <span className="detail-label">
                              AI Priority Score:
                            </span>
                            <span
                              className="detail-value"
                              style={{
                                fontWeight: "bold",
                                color:
                                  request.priority > 70
                                    ? "#dc2626"
                                    : request.priority > 40
                                      ? "#f59e0b"
                                      : "#10b981",
                              }}
                            >
                              {request.priority}
                            </span>
                          </div>
                        )}
                        {request.recommendedBedType && (
                          <div className="detail-row">
                            <span className="detail-label">
                              Recommended Bed:
                            </span>
                            <span className="detail-value">
                              {request.recommendedBedType}
                            </span>
                          </div>
                        )}
                        {request.condition && (
                          <div className="detail-row">
                            <span className="detail-label">Condition:</span>
                            <span className="detail-value">
                              {request.condition}
                            </span>
                          </div>
                        )}
                        {request.medicalDescription && (
                          <div className="detail-row">
                            <span className="detail-label">Description:</span>
                            <span className="detail-value">
                              {request.medicalDescription}
                            </span>
                          </div>
                        )}
                        {request.emergency && (
                          <div className="emergency-badge">
                            🚨 Emergency Case
                          </div>
                        )}
                        <div className="detail-row">
                          <span className="detail-label">Requested on:</span>
                          <span className="detail-value">
                            {new Date(request.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {request.status === "approved" && (
                        <div className="request-action">
                          <button className="contact-hospital-btn">
                            📞 Contact Hospital
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No bed requests found.</p>
                  <button
                    className="upload-btn"
                    onClick={() => setShowSearchModal(true)}
                  >
                    Search Hospitals to Request Bed
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "upload" && (
            <div className="tab-content">
              <h2>Upload Medical Records</h2>

              {uploadSuccess && (
                <div className="success-message">{uploadSuccess}</div>
              )}
              {uploadError && (
                <div className="error-message">{uploadError}</div>
              )}

              <form onSubmit={handleUploadRecord} className="upload-form">
                <div className="form-group">
                  <label>Record Type *</label>
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value)}
                  >
                    <option value="prescription">Prescription</option>
                    <option value="lab-report">Lab Report</option>
                    <option value="scan">Scan (X-ray, MRI, CT)</option>
                    <option value="xray">X-ray</option>
                    <option value="mri">MRI</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    value={recordDescription}
                    onChange={(e) => setRecordDescription(e.target.value)}
                    placeholder="e.g., Blood Test Report - March 2026"
                  />
                </div>

                <div className="form-group">
                  <label>Select File * (Max 10MB)</label>
                  <input
                    id="fileInput"
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="file-input"
                  />
                  {selectedFile && (
                    <div className="file-info">
                      Selected: {selectedFile.name} (
                      {formatFileSize(selectedFile.size)})
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="upload-btn"
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? "Uploading..." : "Upload Record"}
                </button>
              </form>
            </div>
          )}

          {activeTab === "records" && (
            <div className="tab-content">
              <h2>All Medical Records</h2>

              {medicalRecords.length > 0 ? (
                <div className="records-grid">
                  {medicalRecords.map((record) => (
                    <div key={record.id} className="record-card">
                      <div className="record-icon">
                        {getRecordTypeIcon(record.type)}
                      </div>
                      <div className="record-details">
                        <h4>
                          {record.type.charAt(0).toUpperCase() +
                            record.type.slice(1).replace("-", " ")}
                        </h4>
                        <p className="record-description">
                          {record.description || "No description"}
                        </p>
                        <p className="record-date">
                          Uploaded:{" "}
                          {new Date(record.uploadedAt).toLocaleDateString()}
                        </p>
                        <p className="record-size">
                          Size: {formatFileSize(record.fileSize)}
                        </p>
                        <a
                          href={record.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="view-link"
                        >
                          View Document →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No medical records found.</p>
                  <button
                    className="upload-btn"
                    onClick={() => setActiveTab("upload")}
                  >
                    Upload Your First Record
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "prescriptions" && (
            <div className="tab-content">
              <h2>Prescriptions</h2>
              {medicalRecords.filter((r) => r.type === "prescription").length >
              0 ? (
                <div className="records-grid">
                  {medicalRecords
                    .filter((r) => r.type === "prescription")
                    .map((record) => (
                      <div key={record.id} className="record-card prescription">
                        <div className="record-icon">📋</div>
                        <div className="record-details">
                          <h4>Prescription</h4>
                          <p className="record-description">
                            {record.description || "Prescription document"}
                          </p>
                          <p className="record-date">
                            Uploaded:{" "}
                            {new Date(record.uploadedAt).toLocaleDateString()}
                          </p>
                          <a
                            href={record.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-link"
                          >
                            View Prescription →
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No prescriptions uploaded yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "lab-reports" && (
            <div className="tab-content">
              <h2>Lab Reports</h2>
              {medicalRecords.filter((r) => r.type === "lab-report").length >
              0 ? (
                <div className="records-grid">
                  {medicalRecords
                    .filter((r) => r.type === "lab-report")
                    .map((record) => (
                      <div key={record.id} className="record-card lab-report">
                        <div className="record-icon">🔬</div>
                        <div className="record-details">
                          <h4>Lab Report</h4>
                          <p className="record-description">
                            {record.description || "Lab report document"}
                          </p>
                          <p className="record-date">
                            Uploaded:{" "}
                            {new Date(record.uploadedAt).toLocaleDateString()}
                          </p>
                          <a
                            href={record.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-link"
                          >
                            View Report →
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No lab reports uploaded yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "scans" && (
            <div className="tab-content">
              <h2>Scans (X-ray, MRI, CT)</h2>
              {medicalRecords.filter((r) =>
                ["scan", "xray", "mri"].includes(r.type),
              ).length > 0 ? (
                <div className="records-grid">
                  {medicalRecords
                    .filter((r) => ["scan", "xray", "mri"].includes(r.type))
                    .map((record) => (
                      <div key={record.id} className="record-card scan">
                        <div className="record-icon">
                          {record.type === "xray"
                            ? "📸"
                            : record.type === "mri"
                              ? "🧠"
                              : "🖥️"}
                        </div>
                        <div className="record-details">
                          <h4>
                            {record.type === "xray"
                              ? "X-ray"
                              : record.type === "mri"
                                ? "MRI"
                                : "Scan"}
                          </h4>
                          <p className="record-description">
                            {record.description || "Scan document"}
                          </p>
                          <p className="record-date">
                            Uploaded:{" "}
                            {new Date(record.uploadedAt).toLocaleDateString()}
                          </p>
                          <a
                            href={record.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-link"
                          >
                            View Scan →
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No scans uploaded yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="tab-content">
              <h2>Settings</h2>
              <div className="settings-section">
                <h3>Notifications</h3>
                <div className="setting-item">
                  <label>
                    <input type="checkbox" /> Email notifications for
                    appointments
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input type="checkbox" /> SMS reminders
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input type="checkbox" /> Newsletter and health tips
                  </label>
                </div>
              </div>

              <div className="settings-section">
                <h3>Privacy</h3>
                <div className="setting-item">
                  <label>
                    <input type="checkbox" /> Make profile public to hospitals
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input type="checkbox" /> Share medical records with doctors
                  </label>
                </div>
              </div>

              <div className="settings-section">
                <h3>Account</h3>
                <button className="danger-btn">Delete Account</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};;

export default UserDashboard;