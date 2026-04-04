// BedManagement.jsx - Updated with Bed Availability Prediction
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/firebase';
import { 
  doc, 
  updateDoc, 
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  deleteDoc,
  writeBatch,
  runTransaction,
  limit
} from 'firebase/firestore';
import './BedManagement.css';

// Import bed images
import availableBedImage from './available bed.png';
import occupiedBedImage from './not_available_bed-removebg-preview (1).png';
import icuBedImage from './greenbed-removebg-preview.png';
import emergencyBedImage from './redbed-removebg-preview.png';
import surgicalBedImage from './bluebed-removebg-preview.png';
import generalBedImage from './gerybed-removebg-preview.png';

const BedManagement = () => {
  const navigate = useNavigate();

  // States
  const [beds, setBeds] = useState([]);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [targetBed, setTargetBed] = useState(null);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prediction States
  const [bedPredictions, setBedPredictions] = useState([]);
  const [showPredictionsModal, setShowPredictionsModal] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);

  // AI Allocation Criteria
  const [allocationCriteria, setAllocationCriteria] = useState({
    emergencyWeight: 50,
    oxygenCritical: 85,
    oxygenCriticalWeight: 40,
    oxygenLow: 90,
    oxygenLowWeight: 30,
    oxygenModerate: 95,
    oxygenModerateWeight: 10,
    ageVeryOld: 70,
    ageVeryOldWeight: 25,
    ageOld: 60,
    ageOldWeight: 15,
    ageMiddle: 50,
    ageMiddleWeight: 10,
    ageChild: 5,
    ageChildWeight: 20,
    conditionCritical: 35,
    conditionSevere: 20,
    conditionModerate: 10,
    criticalKeywords: [
      "heart",
      "stroke",
      "bleeding",
      "sepsis",
      "respiratory",
      "failure",
    ],
    keywordWeight: 15,
    bedTypeThresholds: {
      ICU: 70,
      Emergency: 50,
      Surgical: 40,
    },
  });

  // AI States
  const [aiPatientForm, setAiPatientForm] = useState({
    name: "",
    age: "",
    condition: "normal",
    oxygenLevel: "95",
    emergency: false,
    diagnosis: "",
    contactNumber: "",
  });
  const [showAiForm, setShowAiForm] = useState(false);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [autoAllocate, setAutoAllocate] = useState(true);
  const [lastAllocationLog, setLastAllocationLog] = useState(null);
  const [isAllocating, setIsAllocating] = useState(false);

  // Bulk bed creation with dynamic floors
  const [bulkBedForm, setBulkBedForm] = useState({
    roomStart: "",
    roomEnd: "",
    type: "General Ward",
    floor: "1",
    bedsPerRoom: "2",
    customFloor: "",
  });
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [floorOptions, setFloorOptions] = useState([
    "Ground",
    "1",
    "2",
    "3",
    "4",
    "5",
  ]);
  const [showCustomFloorInput, setShowCustomFloorInput] = useState(false);

  // Track next available numbers by type and floor
  const [nextNumbers, setNextNumbers] = useState({});

  // Track processed patient IDs to prevent duplicates
  const processedPatientIds = useRef(new Set());

  // ==================== PREDICTION FUNCTIONS ====================

  // Calculate days admitted from timestamp
  const calculateDaysAdmitted = (admissionDate) => {
    if (!admissionDate) return 0;

    let admission;
    if (admissionDate.seconds) {
      admission = new Date(admissionDate.seconds * 1000);
    } else if (admissionDate.toDate) {
      admission = admissionDate.toDate();
    } else {
      admission = new Date(admissionDate);
    }

    const now = new Date();
    const diffTime = Math.abs(now - admission);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Calculate estimated discharge based on bed type, condition, and priority
  const calculateEstimatedDischarge = (bed) => {
    // Average stay times by bed type (in days) - based on medical standards
    const averageStays = {
      ICU: {
        min: 2,
        max: 7,
        critical: 5,
        severe: 4,
        moderate: 3,
        normal: 2,
      },
      Emergency: {
        min: 0.5,
        max: 2,
        critical: 1.5,
        severe: 1,
        moderate: 0.75,
        normal: 0.5,
      },
      Surgical: {
        min: 3,
        max: 10,
        critical: 8,
        severe: 6,
        moderate: 4,
        normal: 3,
      },
      "General Ward": {
        min: 2,
        max: 8,
        critical: 6,
        severe: 4,
        moderate: 3,
        normal: 2,
      },
      "Private Room": {
        min: 1,
        max: 10,
        critical: 7,
        severe: 5,
        moderate: 3,
        normal: 2,
      },
    };

    const bedType = bed.type || "General Ward";
    const patientCondition = bed.patientCondition || "normal";
    const priority = bed.priority || 0;

    let stayMultiplier = 1;

    // Adjust based on priority score
    if (priority >= 70) {
      stayMultiplier = 1.3; // Higher priority cases stay longer
    } else if (priority >= 50) {
      stayMultiplier = 1.15;
    } else if (priority >= 30) {
      stayMultiplier = 1.0;
    } else {
      stayMultiplier = 0.9;
    }

    const stays = averageStays[bedType] || averageStays["General Ward"];
    let avgStay;

    switch (patientCondition) {
      case "critical":
        avgStay = stays.critical;
        break;
      case "severe":
        avgStay = stays.severe;
        break;
      case "moderate":
        avgStay = stays.moderate;
        break;
      default:
        avgStay = stays.normal;
    }

    // Apply priority multiplier
    avgStay = avgStay * stayMultiplier;

    const daysAdmitted = calculateDaysAdmitted(bed.admissionDate);
    const daysRemaining = Math.max(0, Math.ceil(avgStay - daysAdmitted));

    // Calculate confidence based on how much data we have
    let confidence = 70; // Base confidence

    if (bed.patientCondition && bed.patientCondition !== "normal") {
      confidence += 5;
    }
    if (bed.priority && bed.priority > 0) {
      confidence += 5;
    }
    if (daysAdmitted > 0) {
      confidence += Math.min(10, daysAdmitted);
    }
    if (bed.diagnosis && bed.diagnosis !== "") {
      confidence += 5;
    }

    confidence = Math.min(95, confidence);

    // Calculate estimated discharge date
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + daysRemaining);

    return {
      daysRemaining,
      estimatedDate,
      confidence,
      avgStay,
      daysAdmitted,
    };
  };

  // Predict bed availability
  const predictBedAvailability = useCallback(async () => {
    setPredictionLoading(true);

    try {
      const predictions = [];

      // Get all occupied beds
      const occupiedBeds = beds.filter((bed) => bed.status === "occupied");

      for (const bed of occupiedBeds) {
        const prediction = calculateEstimatedDischarge(bed);

        // Only include beds that are predicted to be free within the next 48 hours
        if (prediction.daysRemaining <= 2 && prediction.daysRemaining >= 0) {
          predictions.push({
            bedId: bed.bedId,
            bedNumber: bed.bedNumber,
            type: bed.type,
            floor: bed.floor,
            roomNumber: bed.roomNumber,
            currentPatient: bed.patientName,
            patientAge: bed.patientAge,
            patientCondition: bed.patientCondition,
            priority: bed.priority,
            daysRemaining: prediction.daysRemaining,
            estimatedDate: prediction.estimatedDate,
            confidence: prediction.confidence,
            hoursRemaining: Math.round(prediction.daysRemaining * 24),
            avgStay: prediction.avgStay,
            daysAdmitted: prediction.daysAdmitted,
            admissionDate: bed.admissionDate,
          });
        }
      }

      // Sort by soonest available first
      predictions.sort((a, b) => a.daysRemaining - b.daysRemaining);

      setBedPredictions(predictions);
    } catch (error) {
      console.error("Error predicting bed availability:", error);
      showNotification("Error generating predictions", "error");
    } finally {
      setPredictionLoading(false);
    }
  }, [beds]);

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return "#10b981";
    if (confidence >= 60) return "#f59e0b";
    return "#ef4444";
  };

  // Get confidence label
  const getConfidenceLabel = (confidence) => {
    if (confidence >= 80) return "High";
    if (confidence >= 60) return "Medium";
    return "Low";
  };

  // Clean up processed patient IDs periodically (every hour)
  useEffect(() => {
    const cleanupInterval = setInterval(
      () => {
        processedPatientIds.current.clear();
      },
      60 * 60 * 1000,
    ); // Clear every hour

    return () => clearInterval(cleanupInterval);
  }, []);

  // ==================== EXISTING FUNCTIONS ====================

  // Real-time subscription to beds
  useEffect(() => {
    if (!hospitalId) return;

    const bedsRef = collection(db, "hospitals", hospitalId, "beds");
    const unsubscribe = onSnapshot(
      bedsRef,
      (snapshot) => {
        const bedsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setBeds(bedsList);

        // Calculate next available numbers by type and floor
        const newNextNumbers = {};

        bedsList.forEach((bed) => {
          const type = bed.type;
          const floor = bed.floor || "1";
          const key = `${type}_${floor}`;
          const match = bed.bedId?.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (!newNextNumbers[key] || num >= newNextNumbers[key]) {
              newNextNumbers[key] = num + 1;
            }
          }
        });

        setNextNumbers(newNextNumbers);

        // AUTO-ALLOCATE: When beds become available, allocate to waiting queue
        if (autoAllocate && waitingQueue.length > 0 && !isAllocating) {
          const availableBeds = bedsList.filter(
            (bed) => bed.status === "available",
          );
          if (availableBeds.length > 0) {
            autoAllocateFromQueue();
          }
        }
      },
      (error) => {
        console.error("Error fetching beds:", error);
      },
    );

    return () => unsubscribe();
  }, [hospitalId, waitingQueue.length, autoAllocate]);

  // Update predictions when beds change
  useEffect(() => {
    if (beds.length > 0) {
      predictBedAvailability();
    }
  }, [beds, predictBedAvailability]);

  // Load hospital data
  useEffect(() => {
    const loadHospital = async () => {
      try {
        setLoading(true);
        const loggedInHospitalId = localStorage.getItem("hospitalId");

        if (!loggedInHospitalId) {
          showNotification("No hospital session found", "error");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        const docRef = doc(db, "hospitals", loggedInHospitalId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setHospitalName(data.name || "Hospital");
          setHospitalId(loggedInHospitalId);
          await loadWaitingQueue(loggedInHospitalId);

          // Load floor options from existing beds
          const bedsRef = collection(
            db,
            "hospitals",
            loggedInHospitalId,
            "beds",
          );
          const bedsSnapshot = await getDocs(bedsRef);
          const existingFloors = new Set();
          bedsSnapshot.docs.forEach((doc) => {
            const floor = doc.data().floor;
            if (floor) existingFloors.add(floor);
          });
          if (existingFloors.size > 0) {
            setFloorOptions([...existingFloors]);
          }
        } else {
          showNotification("Hospital not found", "error");
        }
      } catch (error) {
        console.error("Error loading hospital:", error);
        showNotification("Error loading hospital data", "error");
      } finally {
        setLoading(false);
      }
    };

    loadHospital();
  }, [navigate]);

  // Clean up duplicate/stale queue entries periodically
  

  // Load waiting queue with real-time listener
  // Fixed loadWaitingQueue function
  // Improved loadWaitingQueue with better duplicate prevention
  const loadWaitingQueue = useCallback(
    async (hospitalIdParam) => {
      if (!hospitalIdParam) return;

      try {
        const queueRef = collection(
          db,
          "hospitals",
          hospitalIdParam,
          "waitingQueue",
        );
        const q = query(
          queueRef,
          where("status", "==", "waiting"),
          orderBy("priority", "desc"),
          orderBy("createdAt", "asc"),
        );

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const queue = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            // Enhanced deduplication - remove exact duplicates
            const uniqueQueue = [];
            const seenKeys = new Map(); // Use Map to track the best version

            queue.forEach((patient) => {
              // Create a comprehensive unique key
              const name = (patient.name || "").trim().toLowerCase();
              const contact = (patient.contactNumber || "").trim();
              const age = patient.age || "";
              const createdAtTime =
                patient.createdAt?.toDate?.()?.getTime() || 0;

              // Primary key: name + contact (if contact exists)
              let key;
              if (contact) {
                key = `${name}_${contact}`;
              } else {
                key = `${name}_${age}`;
              }

              // If we haven't seen this patient before, add them
              if (!seenKeys.has(key)) {
                seenKeys.set(key, patient);
                uniqueQueue.push(patient);
              } else {
                // If we have seen them, keep the one with the later createdAt (more recent)
                const existing = seenKeys.get(key);
                const existingTime =
                  existing.createdAt?.toDate?.()?.getTime() || 0;
                if (createdAtTime > existingTime) {
                  // Replace with newer one
                  const index = uniqueQueue.findIndex(
                    (p) => p.id === existing.id,
                  );
                  if (index !== -1) {
                    uniqueQueue[index] = patient;
                  }
                  seenKeys.set(key, patient);
                }
              }
            });

            // Also filter out patients that are already admitted (check against current beds)
            const occupiedBedPatients = new Set();
            beds.forEach((bed) => {
              if (bed.status === "occupied" && bed.patientName) {
                const patientName = (bed.patientName || "")
                  .trim()
                  .toLowerCase();
                const patientContact = (bed.contactNumber || "").trim();
                const patientAge = bed.patientAge || "";

                if (patientContact) {
                  occupiedBedPatients.add(`${patientName}_${patientContact}`);
                } else {
                  occupiedBedPatients.add(`${patientName}_${patientAge}`);
                }
              }
            });

            const filteredQueue = uniqueQueue.filter((patient) => {
              const patientName = (patient.name || "").trim().toLowerCase();
              const patientContact = (patient.contactNumber || "").trim();
              const patientAge = patient.age || "";

              let patientKey;
              if (patientContact) {
                patientKey = `${patientName}_${patientContact}`;
              } else {
                patientKey = `${patientName}_${patientAge}`;
              }

              return !occupiedBedPatients.has(patientKey);
            });

            setWaitingQueue(filteredQueue);
          },
          (error) => {
            console.error("Error loading queue:", error);
          },
        );

        return () => unsubscribe();
      } catch (error) {
        console.error("Error setting up queue listener:", error);
        return null;
      }
    },
    [beds],
  );

  // Calculate priority score
  const calculatePriorityScore = useCallback(
    (patient) => {
      let score = 0;
      const log = [];

      if (patient.emergency) {
        score += allocationCriteria.emergencyWeight;
        log.push(`Emergency: +${allocationCriteria.emergencyWeight}`);
      }

      const oxygenLevel = parseInt(patient.oxygenLevel) || 95;
      if (oxygenLevel < allocationCriteria.oxygenCritical) {
        score += allocationCriteria.oxygenCriticalWeight;
        log.push(
          `Oxygen < ${allocationCriteria.oxygenCritical}%: +${allocationCriteria.oxygenCriticalWeight}`,
        );
      } else if (oxygenLevel < allocationCriteria.oxygenLow) {
        score += allocationCriteria.oxygenLowWeight;
        log.push(
          `Oxygen < ${allocationCriteria.oxygenLow}%: +${allocationCriteria.oxygenLowWeight}`,
        );
      } else if (oxygenLevel < allocationCriteria.oxygenModerate) {
        score += allocationCriteria.oxygenModerateWeight;
        log.push(
          `Oxygen < ${allocationCriteria.oxygenModerate}%: +${allocationCriteria.oxygenModerateWeight}`,
        );
      }

      const age = parseInt(patient.age) || 0;
      if (age > allocationCriteria.ageVeryOld) {
        score += allocationCriteria.ageVeryOldWeight;
        log.push(
          `Age > ${allocationCriteria.ageVeryOld}: +${allocationCriteria.ageVeryOldWeight}`,
        );
      } else if (age > allocationCriteria.ageOld) {
        score += allocationCriteria.ageOldWeight;
        log.push(
          `Age > ${allocationCriteria.ageOld}: +${allocationCriteria.ageOldWeight}`,
        );
      } else if (age > allocationCriteria.ageMiddle) {
        score += allocationCriteria.ageMiddleWeight;
        log.push(
          `Age > ${allocationCriteria.ageMiddle}: +${allocationCriteria.ageMiddleWeight}`,
        );
      } else if (age < allocationCriteria.ageChild && age > 0) {
        score += allocationCriteria.ageChildWeight;
        log.push(
          `Age < ${allocationCriteria.ageChild}: +${allocationCriteria.ageChildWeight}`,
        );
      }

      if (patient.condition === "critical") {
        score += allocationCriteria.conditionCritical;
        log.push(
          `Critical condition: +${allocationCriteria.conditionCritical}`,
        );
      } else if (patient.condition === "severe") {
        score += allocationCriteria.conditionSevere;
        log.push(`Severe condition: +${allocationCriteria.conditionSevere}`);
      } else if (patient.condition === "moderate") {
        score += allocationCriteria.conditionModerate;
        log.push(
          `Moderate condition: +${allocationCriteria.conditionModerate}`,
        );
      }

      const diagnosis = (patient.diagnosis || "").toLowerCase();
      allocationCriteria.criticalKeywords.forEach((keyword) => {
        if (diagnosis.includes(keyword)) {
          score += allocationCriteria.keywordWeight;
          log.push(
            `Keyword "${keyword}": +${allocationCriteria.keywordWeight}`,
          );
        }
      });

      const finalScore = Math.min(score, 100);
      return { score: finalScore, log };
    },
    [allocationCriteria],
  );

  // Determine bed type
  const determineBedType = useCallback(
    (priority) => {
      if (priority >= allocationCriteria.bedTypeThresholds.ICU) {
        return "ICU";
      } else if (priority >= allocationCriteria.bedTypeThresholds.Emergency) {
        return "Emergency";
      } else if (priority >= allocationCriteria.bedTypeThresholds.Surgical) {
        return "Surgical";
      }
      return "General Ward";
    },
    [allocationCriteria],
  );

  // AI Bed Allocation
  const aiAllocateBed = useCallback(
    (patient) => {
      const { score: priority, log: priorityLog } =
        calculatePriorityScore(patient);
      const requiredType = determineBedType(priority);

      let availableBeds = beds.filter(
        (bed) => bed.status === "available" && bed.type === requiredType,
      );

      if (availableBeds.length === 0 && requiredType === "ICU") {
        availableBeds = beds.filter(
          (bed) =>
            bed.status === "available" &&
            ["Emergency", "Surgical"].includes(bed.type),
        );
      } else if (availableBeds.length === 0) {
        availableBeds = beds.filter((bed) => bed.status === "available");
      }

      if (availableBeds.length === 0) {
        return {
          hasAvailable: false,
          message: `No ${requiredType} beds available. Added to waiting queue.`,
          priority,
          priorityLog,
          requiredType,
          waitingQueuePosition: waitingQueue.length + 1,
        };
      }

      const selectedBed = availableBeds.sort((a, b) => {
        if (priority > 70) {
          return parseInt(a.floor) - parseInt(b.floor);
        }
        return (b.features?.length || 0) - (a.features?.length || 0);
      })[0];

      return {
        hasAvailable: true,
        bed: selectedBed,
        priority,
        priorityLog,
        requiredType,
        message: `AI recommends Bed ${selectedBed.bedId} (${selectedBed.type}) in Room ${selectedBed.roomNumber}, Floor ${selectedBed.floor}`,
        reasoning: `Priority Score: ${priority} (${priorityLog.join(", ")}) → Recommended: ${selectedBed.type} Bed`,
      };
    },
    [beds, waitingQueue.length, calculatePriorityScore, determineBedType],
  );

  // Allocate patient to bed
  // Fixed allocatePatientToBed function
  const allocatePatientToBed = useCallback(
    async (patient, bed) => {
      const patientKey = `${patient.name}_${patient.contactNumber || patient.age}`;

      // Check if already processed
      if (processedPatientIds.current.has(patientKey)) {
        console.log("Patient already processed:", patient.name);
        return false;
      }

      try {
        const bedRef = doc(db, "hospitals", hospitalId, "beds", bed.id);

        const updateData = {
          status: "occupied",
          patientId: `PAT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          patientName: patient.name || "",
          patientAge: parseInt(patient.age) || 0,
          patientCondition: patient.condition || "normal",
          admissionDate: serverTimestamp(),
          priority: patient.priority || 0,
          diagnosis: patient.diagnosis || "",
          allocationReason:
            patient.allocationReason ||
            patient.priorityLog?.join(", ") ||
            "AI Allocation",
        };

        if (patient.contactNumber && patient.contactNumber.trim() !== "") {
          updateData.contactNumber = patient.contactNumber;
        }

        if (patient.oxygenLevel) {
          updateData.oxygenLevel = parseInt(patient.oxygenLevel) || 95;
        }

        // Use transaction to ensure atomic operation
        await runTransaction(db, async (transaction) => {
          const bedDoc = await transaction.get(bedRef);
          if (!bedDoc.exists()) {
            throw new Error("Bed does not exist!");
          }

          if (bedDoc.data().status !== "available") {
            throw new Error("Bed is no longer available!");
          }

          transaction.update(bedRef, updateData);
        });

        // Mark as processed
        processedPatientIds.current.add(patientKey);

        // Create patient record
        const patientData = {
          name: patient.name || "",
          age: parseInt(patient.age) || 0,
          condition: patient.condition || "normal",
          oxygenLevel: parseInt(patient.oxygenLevel) || 95,
          emergency: patient.emergency || false,
          diagnosis: patient.diagnosis || "",
          priority: patient.priority || 0,
          priorityLog: patient.priorityLog || [],
          bedId: bed.id,
          bedNumber: bed.bedId,
          bedType: bed.type,
          roomNumber: bed.roomNumber,
          floor: bed.floor,
          admissionDate: serverTimestamp(),
          status: "admitted",
        };

        if (patient.contactNumber && patient.contactNumber.trim() !== "") {
          patientData.contactNumber = patient.contactNumber;
        }

        const patientRef = collection(db, "hospitals", hospitalId, "patients");
        await addDoc(patientRef, patientData);

        // CRITICAL FIX: Remove from waiting queue - try multiple methods
        let queueDeleted = false;

        // Method 1: If we have patient.id from the queue document
        if (patient.id) {
          try {
            const queueDocRef = doc(
              db,
              "hospitals",
              hospitalId,
              "waitingQueue",
              patient.id,
            );
            await deleteDoc(queueDocRef);
            queueDeleted = true;
            console.log("Queue entry deleted by ID:", patient.id);
          } catch (err) {
            console.error("Error deleting by ID:", err);
          }
        }

        // Method 2: If method 1 failed, try to find and delete by patient name and contact
        if (!queueDeleted) {
          try {
            const queueRef = collection(
              db,
              "hospitals",
              hospitalId,
              "waitingQueue",
            );
            const q = query(
              queueRef,
              where("name", "==", patient.name),
              where("contactNumber", "==", patient.contactNumber || ""),
              where("status", "==", "waiting"),
            );
            const querySnapshot = await getDocs(q);

            for (const docSnapshot of querySnapshot.docs) {
              await deleteDoc(
                doc(
                  db,
                  "hospitals",
                  hospitalId,
                  "waitingQueue",
                  docSnapshot.id,
                ),
              );
              queueDeleted = true;
              console.log("Queue entry deleted by query:", docSnapshot.id);
            }
          } catch (err) {
            console.error("Error deleting by query:", err);
          }
        }

        // Method 3: Try by name and age
        if (!queueDeleted) {
          try {
            const queueRef = collection(
              db,
              "hospitals",
              hospitalId,
              "waitingQueue",
            );
            const q = query(
              queueRef,
              where("name", "==", patient.name),
              where("age", "==", parseInt(patient.age) || 0),
              where("status", "==", "waiting"),
            );
            const querySnapshot = await getDocs(q);

            for (const docSnapshot of querySnapshot.docs) {
              await deleteDoc(
                doc(
                  db,
                  "hospitals",
                  hospitalId,
                  "waitingQueue",
                  docSnapshot.id,
                ),
              );
              queueDeleted = true;
              console.log("Queue entry deleted by name/age:", docSnapshot.id);
            }
          } catch (err) {
            console.error("Error deleting by name/age:", err);
          }
        }

        if (!queueDeleted) {
          console.warn(
            "Could not find queue entry to delete for patient:",
            patient.name,
          );
        }

        // Force refresh the waiting queue
        await loadWaitingQueue(hospitalId);

        return true;
      } catch (error) {
        console.error("Error allocating bed:", error);
        return false;
      }
    },
    [hospitalId, loadWaitingQueue],
  );

  // Auto-allocate from queue
  // Fixed autoAllocateFromQueue function
  const autoAllocateFromQueue = useCallback(async () => {
    if (isAllocating) return;
    if (waitingQueue.length === 0) return;

    setIsAllocating(true);
    let allocatedCount = 0;
    const allocatedPatients = [];

    try {
      // Get fresh available beds
      const availableBeds = beds.filter((bed) => bed.status === "available");
      if (availableBeds.length === 0) {
        setIsAllocating(false);
        return;
      }

      // Get fresh queue (use the current state)
      const queueCopy = [...waitingQueue];

      for (const patient of queueCopy) {
        // Verify patient still exists in queue
        const stillInQueue = waitingQueue.some((p) => p.id === patient.id);
        if (!stillInQueue) continue;

        // Check if there's still an available bed
        const currentAvailableBeds = beds.filter(
          (bed) => bed.status === "available",
        );
        if (currentAvailableBeds.length === 0) break;

        const allocation = aiAllocateBed(patient);
        if (allocation.hasAvailable && allocation.bed) {
          const success = await allocatePatientToBed(patient, allocation.bed);
          if (success) {
            allocatedCount++;
            allocatedPatients.push(patient.name);
            setLastAllocationLog({
              patient: patient.name,
              bed: allocation.bed.bedId,
              priority: allocation.priority,
              reasoning: allocation.reasoning,
              timestamp: new Date().toISOString(),
            });

            // Short delay to allow Firestore to update
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Refresh beds and queue
            const bedsRef = collection(db, "hospitals", hospitalId, "beds");
            const bedsSnapshot = await getDocs(bedsRef);
            const updatedBeds = bedsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setBeds(updatedBeds);

            await loadWaitingQueue(hospitalId);
          }
        }
      }

      if (allocatedCount > 0) {
        showNotification(
          `🤖 Auto-allocated ${allocatedCount} patient(s): ${allocatedPatients.join(", ")}`,
          "success",
        );
      }
    } catch (error) {
      console.error("Error in auto-allocation:", error);
    } finally {
      setIsAllocating(false);
    }
  }, [
    waitingQueue,
    beds,
    aiAllocateBed,
    allocatePatientToBed,
    hospitalId,
    loadWaitingQueue,
    isAllocating,
  ]);

  // Handle AI admission
  // Updated handleAiAdmission with isSubmitting
const handleAiAdmission = useCallback(async (e) => {
  e.preventDefault();
  
  if (isSubmitting) return; // Prevent multiple submissions
  
  if (!aiPatientForm.name || !aiPatientForm.age) {
    showNotification('Please fill patient name and age', 'error');
    return;
  }
  
  // Normalize the input for duplicate checking
  const normalizedName = aiPatientForm.name.trim().toLowerCase();
  const normalizedContact = aiPatientForm.contactNumber?.trim() || '';
  
  setIsSubmitting(true);
  setLoading(true);
  
  try {
    // FIRST: Check if patient already exists in waiting queue (real-time check)
    const queueRef = collection(db, 'hospitals', hospitalId, 'waitingQueue');
    const q = query(
      queueRef,
      where('status', '==', 'waiting')
    );
    const querySnapshot = await getDocs(q);
    
    let isDuplicateInQueue = false;
    let existingPatientInQueue = null;
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const existingName = (data.name || '').trim().toLowerCase();
      const existingContact = (data.contactNumber || '').trim();
      const existingAge = parseInt(data.age);
      const inputAge = parseInt(aiPatientForm.age);
      
      // Check for duplicate by name AND contact (if contact exists)
      if (normalizedContact && existingContact === normalizedContact && existingName === normalizedName) {
        isDuplicateInQueue = true;
        existingPatientInQueue = data;
      }
      // Check by name AND age if no contact
      else if (!normalizedContact && existingName === normalizedName && existingAge === inputAge) {
        isDuplicateInQueue = true;
        existingPatientInQueue = data;
      }
      // Also check by name AND phone (if phone exists in both)
      else if (normalizedContact && existingContact === normalizedContact) {
        isDuplicateInQueue = true;
        existingPatientInQueue = data;
      }
    });
    
    if (isDuplicateInQueue) {
      showNotification(`❌ Patient "${aiPatientForm.name}" is already in the waiting queue!`, 'warning');
      setIsSubmitting(false);
      setLoading(false);
      return;
    }
    
    // SECOND: Check if patient is already admitted (in an occupied bed)
    const isAlreadyAdmitted = beds.some(bed => 
      bed.status === 'occupied' && 
      bed.patientName && 
      bed.patientName.trim().toLowerCase() === normalizedName &&
      (!normalizedContact || bed.contactNumber === normalizedContact)
    );
    
    if (isAlreadyAdmitted) {
      showNotification(`❌ Patient "${aiPatientForm.name}" is already admitted to a bed!`, 'warning');
      setIsSubmitting(false);
      setLoading(false);
      return;
    }
    
    // THIRD: Check recent admissions (within last 5 minutes) to prevent rapid re-submissions
    const recentAdmissionsRef = collection(db, 'hospitals', hospitalId, 'patients');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentQuery = query(
      recentAdmissionsRef,
      where('name', '==', aiPatientForm.name),
      where('admissionDate', '>=', fiveMinutesAgo)
    );
    const recentSnapshot = await getDocs(recentQuery);
    
    if (!recentSnapshot.empty) {
      showNotification(`⚠️ Patient "${aiPatientForm.name}" was recently admitted. Please wait before re-admitting.`, 'warning');
      setIsSubmitting(false);
      setLoading(false);
      return;
    }
    
    // Calculate priority score
    const { score: priority, log: priorityLog } = calculatePriorityScore(aiPatientForm);
    
    const patientData = {
      name: aiPatientForm.name.trim(),
      age: parseInt(aiPatientForm.age) || 0,
      condition: aiPatientForm.condition || 'normal',
      oxygenLevel: parseInt(aiPatientForm.oxygenLevel) || 95,
      emergency: aiPatientForm.emergency || false,
      diagnosis: aiPatientForm.diagnosis || '',
      priority: priority,
      priorityLog: priorityLog,
      status: 'waiting',
      createdAt: serverTimestamp(),
      allocationReason: `Priority Score: ${priority} (${priorityLog.join(', ')})`
    };
    
    if (aiPatientForm.contactNumber && aiPatientForm.contactNumber.trim() !== '') {
      patientData.contactNumber = aiPatientForm.contactNumber.trim();
    }
    
    const allocation = aiAllocateBed(patientData);
    
    if (allocation.hasAvailable && allocation.bed) {
      patientData.allocationReason = allocation.reasoning;
      const success = await allocatePatientToBed(patientData, allocation.bed);
      
      if (success) {
        setLastAllocationLog({
          patient: patientData.name,
          bed: allocation.bed.bedId,
          priority: allocation.priority,
          reasoning: allocation.reasoning,
          timestamp: new Date().toISOString()
        });
        
        showNotification(`✅ Bed ${allocation.bed.bedId} allocated to ${patientData.name}!`, 'success');
        
        setAiPatientForm({
          name: '',
          age: '',
          condition: 'normal',
          oxygenLevel: '95',
          emergency: false,
          diagnosis: '',
          contactNumber: ''
        });
        setShowAiForm(false);
      } else {
        showNotification('Failed to allocate bed. Please try again.', 'error');
      }
      
    } else {
      // Add to waiting queue with duplicate prevention
      // Check one more time before adding to queue (race condition prevention)
      const finalCheckQuery = query(
        queueRef,
        where('name', '==', aiPatientForm.name.trim()),
        where('status', '==', 'waiting')
      );
      const finalCheckSnapshot = await getDocs(finalCheckQuery);
      
      if (!finalCheckSnapshot.empty) {
        showNotification(`❌ Patient "${aiPatientForm.name}" was just added to the queue. Please wait.`, 'warning');
        setIsSubmitting(false);
        setLoading(false);
        return;
      }
      
      const newQueueRef = await addDoc(queueRef, {
        ...patientData,
        requiredType: allocation.requiredType,
        priority: allocation.priority,
        status: 'waiting',
        createdAt: serverTimestamp()
      });
      
      await loadWaitingQueue(hospitalId);
      
      showNotification(`⚠️ No beds available. ${patientData.name} added to waiting queue (Position: ${allocation.waitingQueuePosition})`, 'warning');
    }
    
  } catch (error) {
    console.error('Error in AI admission:', error);
    showNotification('Error processing admission', 'error');
  } finally {
    setLoading(false);
    setIsSubmitting(false);
  }
}, [aiPatientForm, hospitalId, beds, calculatePriorityScore, aiAllocateBed, allocatePatientToBed, loadWaitingQueue, isSubmitting]);

  // Bulk create beds
  const bulkCreateBeds = useCallback(async () => {
    if (!bulkBedForm.roomStart || !bulkBedForm.roomEnd) {
      showNotification("Please enter room range", "warning");
      return;
    }

    const start = parseInt(bulkBedForm.roomStart);
    const end = parseInt(bulkBedForm.roomEnd);
    const bedsPerRoom = parseInt(bulkBedForm.bedsPerRoom) || 2;

    if (isNaN(start) || isNaN(end)) {
      showNotification("Please enter valid room numbers", "error");
      return;
    }

    if (start > end) {
      showNotification("Start room must be less than end room", "error");
      return;
    }

    const floorValue =
      bulkBedForm.customFloor && showCustomFloorInput
        ? bulkBedForm.customFloor
        : bulkBedForm.floor;

    setLoading(true);
    const batch = writeBatch(db);
    let created = 0;
    const bedsToCreate = [];

    const typeKey = `${bulkBedForm.type}_${floorValue}`;
    const currentCounter = nextNumbers[typeKey] || 1;

    try {
      for (let room = start; room <= end; room++) {
        for (let bedNum = 1; bedNum <= bedsPerRoom; bedNum++) {
          const counter = currentCounter + created;
          const prefix =
            bulkBedForm.type === "ICU"
              ? "ICU"
              : bulkBedForm.type === "Emergency"
                ? "EMG"
                : bulkBedForm.type === "Surgical"
                  ? "SUR"
                  : bulkBedForm.type === "General Ward"
                    ? "GEN"
                    : "PRV";
          const formattedNumber = counter.toString().padStart(3, "0");
          const bedId = `${prefix}${formattedNumber}`;

          bedsToCreate.push({
            bedId: bedId,
            type: bulkBedForm.type,
            roomNumber: room.toString(),
            floor: floorValue,
            status: "available",
            features: [],
            patientId: null,
            patientName: null,
            createdAt: serverTimestamp(),
            bedNumber: bedNum,
          });
          created++;
        }
      }

      for (const bedData of bedsToCreate) {
        const bedsRef = collection(db, "hospitals", hospitalId, "beds");
        const newBedRef = doc(bedsRef);
        batch.set(newBedRef, bedData);
      }

      await batch.commit();

      setNextNumbers((prev) => ({
        ...prev,
        [typeKey]: currentCounter + created,
      }));

      showNotification(
        `✅ Successfully created ${created} beds on Floor ${floorValue}!`,
        "success",
      );
      setShowBulkForm(false);
      setBulkBedForm({
        roomStart: "",
        roomEnd: "",
        type: "General Ward",
        floor: "1",
        bedsPerRoom: "2",
        customFloor: "",
      });
      setShowCustomFloorInput(false);

      if (autoAllocate && waitingQueue.length > 0) {
        setTimeout(() => autoAllocateFromQueue(), 500);
      }
    } catch (error) {
      console.error("Error creating beds:", error);
      showNotification("Error creating beds", "error");
    } finally {
      setLoading(false);
    }
  }, [
    bulkBedForm,
    hospitalId,
    nextNumbers,
    autoAllocate,
    waitingQueue,
    autoAllocateFromQueue,
    showCustomFloorInput,
  ]);

  // Discharge patient
  const dischargePatient = useCallback(async () => {
    if (!selectedBed) return;

    try {
      setLoading(true);

      const bedRef = doc(db, "hospitals", hospitalId, "beds", selectedBed.id);
      await updateDoc(bedRef, {
        status: "available",
        patientId: null,
        patientName: null,
        patientAge: null,
        patientCondition: null,
        dischargedAt: serverTimestamp(),
      });

      showNotification(
        `✅ Patient discharged from Bed ${selectedBed.bedId}.`,
        "success",
      );
      setShowDischargeModal(false);
      setSelectedBed(null);

      if (autoAllocate && waitingQueue.length > 0) {
        setTimeout(() => autoAllocateFromQueue(), 100);
      }
    } catch (error) {
      console.error("Error discharging patient:", error);
      showNotification("Error discharging patient", "error");
    } finally {
      setLoading(false);
    }
  }, [
    selectedBed,
    hospitalId,
    autoAllocate,
    waitingQueue,
    autoAllocateFromQueue,
  ]);

  // Relocate patient
  const relocatePatient = useCallback(async () => {
    if (!selectedBed || !targetBed) {
      showNotification("Please select both beds", "warning");
      return;
    }

    if (targetBed.status !== "available") {
      showNotification("Target bed is not available", "error");
      return;
    }

    try {
      setLoading(true);

      const sourceRef = doc(
        db,
        "hospitals",
        hospitalId,
        "beds",
        selectedBed.id,
      );
      const targetRef = doc(db, "hospitals", hospitalId, "beds", targetBed.id);

      await runTransaction(db, async (transaction) => {
        const sourceDoc = await transaction.get(sourceRef);
        const targetDoc = await transaction.get(targetRef);

        if (!sourceDoc.exists() || !targetDoc.exists()) {
          throw new Error("Bed does not exist!");
        }

        if (targetDoc.data().status !== "available") {
          throw new Error("Target bed is no longer available!");
        }

        transaction.update(sourceRef, {
          status: "available",
          patientId: null,
          patientName: null,
          patientAge: null,
          patientCondition: null,
          relocatedFrom: true,
        });

        transaction.update(targetRef, {
          status: "occupied",
          patientId: selectedBed.patientId,
          patientName: selectedBed.patientName,
          patientAge: selectedBed.patientAge,
          patientCondition: selectedBed.patientCondition,
          relocatedAt: serverTimestamp(),
          previousBed: selectedBed.bedId,
        });
      });

      showNotification(
        `🔄 Patient relocated from Bed ${selectedBed.bedId} to Bed ${targetBed.bedId}`,
        "success",
      );
      setShowRelocateModal(false);
      setSelectedBed(null);
      setTargetBed(null);
    } catch (error) {
      console.error("Error relocating patient:", error);
      showNotification("Error relocating patient", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedBed, targetBed, hospitalId]);

  // Remove from queue
  const removeFromQueue = useCallback(
    async (patientId) => {
      if (window.confirm("Remove this patient from waiting queue?")) {
        try {
          await deleteDoc(
            doc(db, "hospitals", hospitalId, "waitingQueue", patientId),
          );
          showNotification("Patient removed from queue", "success");
          await loadWaitingQueue(hospitalId);
        } catch (error) {
          console.error("Error removing from queue:", error);
          showNotification("Error removing patient", "error");
        }
      }
    },
    [hospitalId, loadWaitingQueue],
  );

  const showNotification = useCallback((message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "" });
    }, 3000);
  }, []);

  // Get bed image
  const getBedImage = useCallback((bed) => {
    if (bed.status === "available") return availableBedImage;

    switch (bed.type) {
      case "ICU":
        return icuBedImage;
      case "Emergency":
        return emergencyBedImage;
      case "Surgical":
        return surgicalBedImage;
      case "General Ward":
        return generalBedImage;
      default:
        return occupiedBedImage;
    }
  }, []);

  // Calculate statistics by type
  const stats = useMemo(() => {
    const total = beds.length;
    const available = beds.filter((bed) => bed.status === "available").length;
    const occupied = beds.filter((bed) => bed.status === "occupied").length;

    const byType = {};
    beds.forEach((bed) => {
      if (!byType[bed.type]) {
        byType[bed.type] = { total: 0, available: 0, occupied: 0, floors: {} };
      }
      byType[bed.type].total++;
      if (bed.status === "available") byType[bed.type].available++;
      else byType[bed.type].occupied++;

      const floor = bed.floor || "1";
      if (!byType[bed.type].floors[floor]) {
        byType[bed.type].floors[floor] = {
          total: 0,
          available: 0,
          occupied: 0,
        };
      }
      byType[bed.type].floors[floor].total++;
      if (bed.status === "available")
        byType[bed.type].floors[floor].available++;
      else byType[bed.type].floors[floor].occupied++;
    });

    return { total, available, occupied, byType };
  }, [beds]);

  // Group beds by type and floor
  const bedsByTypeAndFloor = useMemo(() => {
    const grouped = {};
    beds.forEach((bed) => {
      const type = bed.type;
      const floor = bed.floor || "1";
      if (!grouped[type]) grouped[type] = {};
      if (!grouped[type][floor]) grouped[type][floor] = [];
      grouped[type][floor].push(bed);
    });
    return grouped;
  }, [beds]);

  const getBedTypeIcon = useCallback((type) => {
    const icons = {
      ICU: "💙",
      Emergency: "🚨",
      Surgical: "💚",
      "General Ward": "🛏️",
      "Private Room": "🏠",
    };
    return icons[type] || "🛏️";
  }, []);

  const bedTypes = useMemo(
    () => ["ICU", "Emergency", "Surgical", "General Ward", "Private Room"],
    [],
  );

  // Get unique floors from beds
  const uniqueFloors = useMemo(() => {
    const floors = new Set();
    beds.forEach((bed) => {
      if (bed.floor) floors.add(bed.floor);
    });
    return Array.from(floors).sort();
  }, [beds]);

  // Input handlers
  const handlePatientInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setAiPatientForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const handleBulkInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setBulkBedForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "floor" && value === "custom") {
      setShowCustomFloorInput(true);
    } else if (name === "floor" && value !== "custom") {
      setShowCustomFloorInput(false);
    }
  }, []);

  if (loading && !beds.length) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <p>Loading hospital bed data...</p>
      </div>
    );
  }
  
  return (
    <div className="bed-management">
      {/* Notification */}
      {notification.show && (
        <div className={`notification ${notification.type} show`}>
          <div className="notification-content">{notification.message}</div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Processing...</p>
        </div>
      )}

      <button
        className="edit-link"
        onClick={() => navigate(`/dashboard/${hospitalId}`)}
      >
        ← Back to Dashboard
      </button>
      

      {/* AI Admission Modal */}
      {showAiForm && (
        <div className="modal-overlay" onClick={() => setShowAiForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 AI Bed Allocation System</h2>
              <button
                className="modal-close"
                onClick={() => setShowAiForm(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAiAdmission}>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Patient Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={aiPatientForm.name}
                      onChange={handlePatientInputChange}
                      placeholder="Enter patient name"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>Age *</label>
                    <input
                      type="number"
                      name="age"
                      value={aiPatientForm.age}
                      onChange={handlePatientInputChange}
                      placeholder="Enter age"
                      required
                      min="0"
                      max="120"
                    />
                  </div>

                  <div className="form-group">
                    <label>Contact Number (Optional)</label>
                    <input
                      type="text"
                      name="contactNumber"
                      value={aiPatientForm.contactNumber}
                      onChange={handlePatientInputChange}
                      placeholder="Enter contact number"
                    />
                  </div>

                  <div className="form-group">
                    <label>Condition</label>
                    <select
                      name="condition"
                      value={aiPatientForm.condition}
                      onChange={handlePatientInputChange}
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
                      value={aiPatientForm.oxygenLevel}
                      onChange={handlePatientInputChange}
                      min="0"
                      max="100"
                      step="1"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="emergency"
                        checked={aiPatientForm.emergency}
                        onChange={handlePatientInputChange}
                      />
                      🚨 Emergency Case
                    </label>
                  </div>

                  <div className="form-group full-width">
                    <label>Diagnosis / Medical Condition</label>
                    <textarea
                      name="diagnosis"
                      value={aiPatientForm.diagnosis}
                      onChange={handlePatientInputChange}
                      placeholder="e.g., Heart attack, Respiratory distress, Fracture..."
                      rows="2"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowAiForm(false)}
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={loading || isSubmitting}
                  >
                    {loading || isSubmitting
                      ? "Processing..."
                      : "🤖 AI Allocate Bed"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Queue Modal */}
      {showQueueModal && (
        <div className="modal-overlay" onClick={() => setShowQueueModal(false)}>
          <div
            className="modal-content queue-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "700px" }}
          >
            <div className="modal-header">
              <h2>⏳ Waiting Queue ({waitingQueue.length} patients)</h2>
              <button
                className="modal-close"
                onClick={() => setShowQueueModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {waitingQueue.length === 0 ? (
                <div className="empty-queue">
                  <div className="empty-icon">✅</div>
                  <p>No patients waiting in queue</p>
                </div>
              ) : (
                <div className="full-queue-list">
                  {waitingQueue.map((patient, idx) => (
                    <div key={patient.id} className="queue-item-full">
                      <div className="queue-rank">{idx + 1}</div>
                      <div className="queue-details-full">
                        <div className="queue-name-full">
                          {patient.name}
                          {patient.emergency && (
                            <span className="emergency-badge">
                              🚨 EMERGENCY
                            </span>
                          )}
                        </div>
                        <div className="queue-info-full">
                          Age: {patient.age} yrs | Priority: {patient.priority}
                          {patient.requiredType && (
                            <span> | Needs: {patient.requiredType}</span>
                          )}
                          {patient.contactNumber && (
                            <span> | Contact: {patient.contactNumber}</span>
                          )}
                        </div>
                        <div className="queue-diagnosis">
                          <strong>Diagnosis:</strong>{" "}
                          {patient.diagnosis || "Not specified"}
                        </div>
                        <div className="queue-priority-breakdown">
                          <strong>Priority Breakdown:</strong>{" "}
                          {patient.priorityLog?.join(", ") || "Standard"}
                        </div>
                        <div className="queue-time">
                          Added:{" "}
                          {patient.createdAt?.toDate?.()?.toLocaleString() ||
                            "Just now"}
                        </div>
                      </div>
                      <button
                        className="remove-queue-btn"
                        onClick={() => removeFromQueue(patient.id)}
                        title="Remove from queue"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowQueueModal(false)}
                >
                  Close
                </button>
                {waitingQueue.length > 0 && (
                  <button
                    className="submit-btn"
                    onClick={() => {
                      autoAllocateFromQueue();
                      setShowQueueModal(false);
                    }}
                  >
                    🤖 Force Allocate Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bed Availability Prediction Modal */}
      {showPredictionsModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowPredictionsModal(false)}
        >
          <div
            className="modal-content prediction-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "800px" }}
          >
            <div className="modal-header">
              <h2>🔮 Bed Availability Predictions</h2>
              <button
                className="modal-close"
                onClick={() => setShowPredictionsModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {predictionLoading ? (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <div
                    className="loading-spinner-small"
                    style={{ margin: "0 auto 15px" }}
                  ></div>
                  <p>Analyzing patient data and generating predictions...</p>
                </div>
              ) : bedPredictions.length === 0 ? (
                <div
                  className="empty-state"
                  style={{ padding: "40px", textAlign: "center" }}
                >
                  <div
                    className="empty-icon"
                    style={{ fontSize: "48px", marginBottom: "15px" }}
                  >
                    🔮
                  </div>
                  <h3>No Predictions Available</h3>
                  <p>
                    Currently, no beds are predicted to be available in the next
                    48 hours.
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      marginTop: "10px",
                    }}
                  >
                    This could mean all patients have just been admitted or we
                    need more data.
                  </p>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                      padding: "15px",
                      borderRadius: "12px",
                      marginBottom: "20px",
                      borderLeft: "4px solid #f59e0b",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span style={{ fontSize: "24px" }}>📊</span>
                      <div>
                        <strong>AI Prediction Summary</strong>
                        <p style={{ margin: "5px 0 0 0", fontSize: "14px" }}>
                          {bedPredictions.length} bed(s) predicted to become
                          available in the next 48 hours
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="predictions-list"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "15px",
                    }}
                  >
                    {bedPredictions.map((prediction, idx) => (
                      <div
                        key={idx}
                        className="prediction-card"
                        style={{
                          background: "white",
                          borderRadius: "12px",
                          padding: "15px",
                          border: "1px solid #e2e8f0",
                          transition: "all 0.3s ease",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "4px",
                            height: "100%",
                            background:
                              prediction.hoursRemaining <= 12
                                ? "#10b981"
                                : "#f59e0b",
                          }}
                        ></div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "12px",
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                margin: 0,
                                fontSize: "18px",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span>
                                {prediction.type === "ICU"
                                  ? "💙"
                                  : prediction.type === "Emergency"
                                    ? "🚨"
                                    : prediction.type === "Surgical"
                                      ? "💚"
                                      : "🛏️"}
                              </span>
                              {prediction.bedId} ({prediction.type})
                            </h3>
                            <p
                              style={{
                                margin: "5px 0 0 0",
                                fontSize: "13px",
                                color: "#64748b",
                              }}
                            >
                              Room {prediction.roomNumber}, Floor{" "}
                              {prediction.floor}
                            </p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                background:
                                  prediction.hoursRemaining <= 12
                                    ? "#d1fae5"
                                    : "#fef3c7",
                                color:
                                  prediction.hoursRemaining <= 12
                                    ? "#065f46"
                                    : "#92400e",
                                padding: "4px 12px",
                                borderRadius: "20px",
                                fontWeight: "600",
                                fontSize: "14px",
                              }}
                            >
                              {prediction.hoursRemaining <= 24
                                ? `⏰ ${prediction.hoursRemaining} hours`
                                : `📅 ${Math.ceil(prediction.daysRemaining)} day${prediction.daysRemaining > 1 ? "s" : ""}`}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: "12px",
                            marginBottom: "12px",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              Current Patient
                            </div>
                            <div
                              style={{ fontWeight: "600", fontSize: "14px" }}
                            >
                              {prediction.currentPatient}
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569" }}>
                              Age: {prediction.patientAge} | Condition:{" "}
                              {prediction.patientCondition || "Normal"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              Admission Details
                            </div>
                            <div style={{ fontSize: "13px" }}>
                              Admitted: {prediction.daysAdmitted} day
                              {prediction.daysAdmitted !== 1 ? "s" : ""} ago
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569" }}>
                              Avg Stay: {prediction.avgStay} days
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              Prediction Confidence
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                marginTop: "4px",
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  height: "6px",
                                  background: "#e2e8f0",
                                  borderRadius: "3px",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${prediction.confidence}%`,
                                    height: "100%",
                                    background: getConfidenceColor(
                                      prediction.confidence,
                                    ),
                                    borderRadius: "3px",
                                  }}
                                ></div>
                              </div>
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  color: getConfidenceColor(
                                    prediction.confidence,
                                  ),
                                }}
                              >
                                {prediction.confidence}% (
                                {getConfidenceLabel(prediction.confidence)})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            background: "#f8fafc",
                            padding: "10px",
                            borderRadius: "8px",
                            marginTop: "8px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "10px",
                          }}
                        >
                          <div>
                            <span
                              style={{ fontSize: "13px", color: "#475569" }}
                            >
                              📍 Estimated availability:
                              <strong
                                style={{
                                  color:
                                    prediction.hoursRemaining <= 12
                                      ? "#10b981"
                                      : "#f59e0b",
                                  marginLeft: "5px",
                                }}
                              >
                                {prediction.estimatedDate.toLocaleDateString()}{" "}
                                at{" "}
                                {prediction.estimatedDate.toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </strong>
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#8b5cf6" }}>
                            🤖 Based on{" "}
                            {prediction.priority
                              ? `priority score ${prediction.priority}`
                              : "admission patterns"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      marginTop: "20px",
                      padding: "12px",
                      background: "#f1f5f9",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <strong>💡 How predictions work:</strong>
                    <ul
                      style={{
                        margin: "8px 0 0 20px",
                        fontSize: "12px",
                        color: "#475569",
                      }}
                    >
                      <li>
                        Based on average stay times for each bed type (ICU: 2-7
                        days, Emergency: 0.5-2 days, etc.)
                      </li>
                      <li>
                        Adjusted by patient condition (critical, severe,
                        moderate, normal)
                      </li>
                      <li>Priority scores influence expected length of stay</li>
                      <li>Confidence increases with more admission data</li>
                      <li>
                        Only shows beds predicted to be free in next 48 hours
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="form-actions" style={{ marginTop: "20px" }}>
                <button
                  className="cancel-btn"
                  onClick={() => setShowPredictionsModal(false)}
                >
                  Close
                </button>
                <button
                  className="submit-btn"
                  onClick={() => {
                    predictBedAvailability();
                  }}
                  disabled={predictionLoading}
                >
                  {predictionLoading
                    ? "Refreshing..."
                    : "🔄 Refresh Predictions"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Criteria Modal */}
      {showCriteriaModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCriteriaModal(false)}
        >
          <div
            className="modal-content criteria-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "700px" }}
          >
            <div className="modal-header">
              <h2>⚙️ Configure AI Allocation Criteria</h2>
              <button
                className="modal-close"
                onClick={() => setShowCriteriaModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="criteria-section">
                <h3>🚨 Emergency Priority</h3>
                <div className="criteria-input">
                  <label>Emergency Weight:</label>
                  <input
                    type="number"
                    value={allocationCriteria.emergencyWeight}
                    onChange={(e) =>
                      setAllocationCriteria((prev) => ({
                        ...prev,
                        emergencyWeight: parseInt(e.target.value) || 0,
                      }))
                    }
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className="criteria-section">
                <h3>💨 Oxygen Level Scoring</h3>
                <div className="criteria-grid">
                  <div>
                    <label>
                      Critical (&lt; {allocationCriteria.oxygenCritical}%):
                    </label>
                    <input
                      type="number"
                      value={allocationCriteria.oxygenCriticalWeight}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          oxygenCriticalWeight: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>Low (&lt; {allocationCriteria.oxygenLow}%):</label>
                    <input
                      type="number"
                      value={allocationCriteria.oxygenLowWeight}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          oxygenLowWeight: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>
                      Moderate (&lt; {allocationCriteria.oxygenModerate}%):
                    </label>
                    <input
                      type="number"
                      value={allocationCriteria.oxygenModerateWeight}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          oxygenModerateWeight: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="criteria-section">
                <h3>👤 Age-Based Scoring</h3>
                <div className="criteria-grid">
                  <div>
                    <label>
                      Very Old (&gt; {allocationCriteria.ageVeryOld}):
                    </label>
                    <input
                      type="number"
                      value={allocationCriteria.ageVeryOldWeight}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          ageVeryOldWeight: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>Old (&gt; {allocationCriteria.ageOld}):</label>
                    <input
                      type="number"
                      value={allocationCriteria.ageOldWeight}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          ageOldWeight: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>Middle (&gt; {allocationCriteria.ageMiddle}):</label>
                    <input
                      type="number"
                      value={allocationCriteria.ageMiddleWeight}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          ageMiddleWeight: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>Child (&lt; {allocationCriteria.ageChild}):</label>
                    <input
                      type="number"
                      value={allocationCriteria.ageChildWeight}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          ageChildWeight: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="criteria-section">
                <h3>🏥 Condition Severity</h3>
                <div className="criteria-grid">
                  <div>
                    <label>Critical:</label>
                    <input
                      type="number"
                      value={allocationCriteria.conditionCritical}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          conditionCritical: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>Severe:</label>
                    <input
                      type="number"
                      value={allocationCriteria.conditionSevere}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          conditionSevere: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>Moderate:</label>
                    <input
                      type="number"
                      value={allocationCriteria.conditionModerate}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          conditionModerate: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="criteria-section">
                <h3>📊 Bed Type Thresholds</h3>
                <div className="criteria-grid">
                  <div>
                    <label>ICU Threshold (priority ≥):</label>
                    <input
                      type="number"
                      value={allocationCriteria.bedTypeThresholds.ICU}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          bedTypeThresholds: {
                            ...prev.bedTypeThresholds,
                            ICU: parseInt(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>Emergency Threshold (priority ≥):</label>
                    <input
                      type="number"
                      value={allocationCriteria.bedTypeThresholds.Emergency}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          bedTypeThresholds: {
                            ...prev.bedTypeThresholds,
                            Emergency: parseInt(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>Surgical Threshold (priority ≥):</label>
                    <input
                      type="number"
                      value={allocationCriteria.bedTypeThresholds.Surgical}
                      onChange={(e) =>
                        setAllocationCriteria((prev) => ({
                          ...prev,
                          bedTypeThresholds: {
                            ...prev.bedTypeThresholds,
                            Surgical: parseInt(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowCriteriaModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="submit-btn"
                  onClick={() => {
                    setShowCriteriaModal(false);
                    showNotification("Allocation criteria updated!", "success");
                  }}
                >
                  Save Criteria
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Beds Modal */}
      {showBulkForm && (
        <div className="modal-overlay" onClick={() => setShowBulkForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏗️ Bulk Create Beds</h2>
              <button
                className="modal-close"
                onClick={() => setShowBulkForm(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div
                className="info-box"
                style={{
                  background: "#f0fdf4",
                  padding: "12px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                }}
              >
                <strong>Next available IDs by type and floor:</strong>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "8px",
                    marginTop: "8px",
                  }}
                >
                  {Object.entries(nextNumbers)
                    .slice(0, 10)
                    .map(([key, num]) => {
                      const [type, floor] = key.split("_");
                      const prefix =
                        type === "ICU"
                          ? "ICU"
                          : type === "Emergency"
                            ? "EMG"
                            : type === "Surgical"
                              ? "SUR"
                              : type === "General Ward"
                                ? "GEN"
                                : "PRV";
                      return (
                        <div key={key}>
                          {type} (Floor {floor}): {prefix}
                          {num.toString().padStart(3, "0")}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Room Range (Start)</label>
                  <input
                    type="number"
                    name="roomStart"
                    value={bulkBedForm.roomStart}
                    onChange={handleBulkInputChange}
                    placeholder="e.g., 101"
                  />
                </div>
                <div className="form-group">
                  <label>Room Range (End)</label>
                  <input
                    type="number"
                    name="roomEnd"
                    value={bulkBedForm.roomEnd}
                    onChange={handleBulkInputChange}
                    placeholder="e.g., 110"
                  />
                </div>
                <div className="form-group">
                  <label>Bed Type</label>
                  <select
                    name="type"
                    value={bulkBedForm.type}
                    onChange={handleBulkInputChange}
                  >
                    <option value="General Ward">General Ward</option>
                    <option value="ICU">ICU</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Surgical">Surgical</option>
                    <option value="Private Room">Private Room</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Floor</label>
                  <select
                    name="floor"
                    value={bulkBedForm.floor}
                    onChange={handleBulkInputChange}
                  >
                    {floorOptions.map((floor) => (
                      <option key={floor} value={floor}>
                        {floor === "Ground"
                          ? "Ground Floor"
                          : `${floor}${floor === "1" ? "st" : floor === "2" ? "nd" : floor === "3" ? "rd" : "th"} Floor`}
                      </option>
                    ))}
                    <option value="custom">+ Add Custom Floor</option>
                  </select>
                </div>
                {showCustomFloorInput && (
                  <div className="form-group">
                    <label>Custom Floor Name</label>
                    <input
                      type="text"
                      name="customFloor"
                      value={bulkBedForm.customFloor}
                      onChange={handleBulkInputChange}
                      placeholder="e.g., Basement, Terrace, etc."
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Beds per Room</label>
                  <input
                    type="number"
                    name="bedsPerRoom"
                    value={bulkBedForm.bedsPerRoom}
                    onChange={handleBulkInputChange}
                    min="1"
                    max="4"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowBulkForm(false)}
                >
                  Cancel
                </button>
                <button className="submit-btn" onClick={bulkCreateBeds}>
                  Create Beds
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Modal */}
      {showDischargeModal && selectedBed && (
        <div
          className="modal-overlay"
          onClick={() => setShowDischargeModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Discharge Patient</h2>
              <button
                className="modal-close"
                onClick={() => setShowDischargeModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="discharge-confirm">
                <div className="discharge-icon">🏥</div>
                <h3>Discharge Patient?</h3>
                <p>
                  <strong>Bed:</strong> {selectedBed.bedId}
                </p>
                <p>
                  <strong>Room:</strong> {selectedBed.roomNumber}
                </p>
                <p>
                  <strong>Floor:</strong> {selectedBed.floor}
                </p>
                <p>
                  <strong>Patient:</strong> {selectedBed.patientName}
                </p>
                <p className="warning-text">
                  This will free up the bed for new patients.
                </p>
              </div>
              <div className="form-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowDischargeModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="submit-btn danger"
                  onClick={dischargePatient}
                >
                  Confirm Discharge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Relocate Modal */}
      {showRelocateModal && selectedBed && targetBed && (
        <div
          className="modal-overlay"
          onClick={() => setShowRelocateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔄 Relocate Patient</h2>
              <button
                className="modal-close"
                onClick={() => setShowRelocateModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="relocate-info">
                <div className="source-bed">
                  <h3>Source Bed</h3>
                  <p>Bed: {selectedBed.bedId}</p>
                  <p>Room: {selectedBed.roomNumber}</p>
                  <p>Floor: {selectedBed.floor}</p>
                  <p>Patient: {selectedBed.patientName}</p>
                </div>
                <div className="arrow">→</div>
                <div className="target-bed">
                  <h3>Target Bed</h3>
                  <p>Bed: {targetBed.bedId}</p>
                  <p>Room: {targetBed.roomNumber}</p>
                  <p>Floor: {targetBed.floor}</p>
                  <p>Type: {targetBed.type}</p>
                </div>
              </div>
              <div className="form-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowRelocateModal(false)}
                >
                  Cancel
                </button>
                <button className="submit-btn" onClick={relocatePatient}>
                  Confirm Relocation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container">
        {/* Left side - Beds display */}
        <div className="beds-container">
          {/* Action Buttons */}
          <div className="action-buttons-container">
            <button
              className="ai-quick-action"
              onClick={() => setShowAiForm(true)}
            >
              <span>🤖</span>
              <span>AI Smart Admission</span>
            </button>
            <button
              className="bulk-action"
              onClick={() => setShowBulkForm(true)}
            >
              <span>🏗️</span>
              <span>Bulk Create Beds</span>
            </button>
            <button
              className="queue-action"
              onClick={() => setShowQueueModal(true)}
              style={{
                background:
                  waitingQueue.length > 0
                    ? "linear-gradient(135deg, #f59e0b, #d97706)"
                    : "linear-gradient(135deg, #64748b, #475569)",
                color: "white",
                position: "relative",
              }}
            >
              <span>⏳</span>
              <span>Queue ({waitingQueue.length})</span>
              {waitingQueue.length > 0 && (
                <span className="queue-badge">{waitingQueue.length}</span>
              )}
            </button>
            <button
              className="prediction-action"
              onClick={() => {
                predictBedAvailability();
                setShowPredictionsModal(true);
              }}
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                color: "white",
                padding: "10px 20px",
                borderRadius: "12px",
                border: "none",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>🔮</span>
              <span>Predict Available Beds</span>
              {bedPredictions.length > 0 && (
                <span
                  style={{
                    background: "#ef4444",
                    borderRadius: "20px",
                    padding: "2px 8px",
                    fontSize: "12px",
                    marginLeft: "4px",
                  }}
                >
                  {bedPredictions.length}
                </span>
              )}
            </button>
            <button
              className="criteria-action"
              onClick={() => setShowCriteriaModal(true)}
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                color: "white",
              }}
            >
              <span>⚙️</span>
              <span>Configure</span>
            </button>
          </div>

          {/* Auto-allocate Toggle */}
          <div className="auto-allocate-toggle">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoAllocate}
                onChange={(e) => setAutoAllocate(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span>Auto-allocate from queue when beds become available</span>
            {autoAllocate && waitingQueue.length > 0 && (
              <span className="auto-status">🤖 Auto-allocation active</span>
            )}
          </div>

          {/* Last Allocation Log */}
          {lastAllocationLog && (
            <div className="allocation-log">
              <div className="log-header">
                <span>🤖</span>
                <strong>Last Auto-Allocation</strong>
                <span className="log-time">
                  {new Date(lastAllocationLog.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="log-details">
                {lastAllocationLog.patient} → Bed {lastAllocationLog.bed}
              </div>
              <div className="log-reasoning">{lastAllocationLog.reasoning}</div>
            </div>
          )}

          {/* Bed Display - Grouped by Type then Floor */}
          {bedTypes.map((bedType) => {
            const typeStats = stats.byType[bedType] || {
              total: 0,
              available: 0,
              occupied: 0,
            };
            if (typeStats.total === 0) return null;

            const floorsForType = bedsByTypeAndFloor[bedType] || {};
            const sortedFloors = Object.keys(floorsForType).sort();

            return (
              <div key={bedType} className="bed-category">
                <div className="category-title">
                  <h2>
                    {getBedTypeIcon(bedType)} {bedType} Beds
                    <span className="availability-badge">
                      {typeStats.available}/{typeStats.total} available
                    </span>
                  </h2>
                  <div className="category-stats">
                    <span className="stat-total">Total: {typeStats.total}</span>
                    <span className="stat-available">
                      Available: {typeStats.available}
                    </span>
                    <span className="stat-occupied">
                      Occupied: {typeStats.occupied}
                    </span>
                    <div className="stat-progress">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(typeStats.occupied / typeStats.total) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {sortedFloors.map((floor) => (
                  <div
                    key={`${bedType}-${floor}`}
                    className="bed-floor-section"
                  >
                    <div className="floor-header">
                      <h3>🏢 Floor {floor}</h3>
                      <span className="floor-stats">
                        {
                          floorsForType[floor].filter(
                            (b) => b.status === "available",
                          ).length
                        }{" "}
                        / {floorsForType[floor].length} available
                      </span>
                    </div>
                    <div className="beds-grid">
                      {floorsForType[floor].map((bed) => (
                        <div
                          key={bed.id}
                          className={`bed-card ${bed.status === "available" ? "available" : "occupied"}`}
                          onClick={() => {
                            if (bed.status === "occupied") {
                              setSelectedBed(bed);
                              setShowDischargeModal(true);
                            }
                          }}
                        >
                          <div className="bed-image-container">
                            <img
                              src={getBedImage(bed)}
                              alt={`Bed ${bed.bedId}`}
                              className="bed-image"
                            />
                            <div className="bed-status-badge">
                              {bed.status === "available"
                                ? "🟢 Available"
                                : "🔴 Occupied"}
                            </div>
                          </div>
                          <div className="bed-info">
                            <div className="bed-id">{bed.bedId}</div>
                            <div className="bed-room">
                              Room {bed.roomNumber}
                            </div>
                            <div className="bed-floor">Floor {bed.floor}</div>
                            {bed.status === "occupied" && bed.patientName && (
                              <div className="patient-info">
                                <div className="patient-name">
                                  {bed.patientName}
                                </div>
                                <div className="patient-age">
                                  {bed.patientAge}yrs
                                </div>
                                {bed.priority && (
                                  <div className="patient-priority">
                                    Priority: {bed.priority}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {bed.status === "occupied" && (
                            <div className="bed-actions">
                              <button
                                className="relocate-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBed(bed);
                                  const availableBeds = beds.filter(
                                    (b) =>
                                      b.status === "available" &&
                                      b.id !== bed.id,
                                  );
                                  if (availableBeds.length > 0) {
                                    setTargetBed(availableBeds[0]);
                                    setShowRelocateModal(true);
                                  } else {
                                    showNotification(
                                      "No available beds for relocation",
                                      "warning",
                                    );
                                  }
                                }}
                                title="Relocate Patient"
                              >
                                🔄
                              </button>
                              <button
                                className="discharge-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBed(bed);
                                  setShowDischargeModal(true);
                                }}
                                title="Discharge Patient"
                              >
                                🚪
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {beds.length === 0 && (
            <div className="no-beds">
              <div className="empty-state-icon">🛏️</div>
              <h3>No Beds Configured</h3>
              <p>Click "Bulk Create Beds" to start configuring beds</p>
              <button
                className="submit-btn"
                onClick={() => setShowBulkForm(true)}
              >
                Create First Beds
              </button>
            </div>
          )}
        </div>

        {/* Right side - Controls */}
        <div className="filter-box">
          <div className="filter-header">
            <h2>🏥 {hospitalName}</h2>
            <div className="overall-stats">
              <div className="overall-stat">
                <span className="stat-label">Total Beds</span>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="overall-stat">
                <span className="stat-label">Available</span>
                <span className="stat-value available">{stats.available}</span>
              </div>
              <div className="overall-stat">
                <span className="stat-label">Occupied</span>
                <span className="stat-value occupied">{stats.occupied}</span>
              </div>
              <div className="overall-stat">
                <span className="stat-label">Utilization</span>
                <span className="stat-value">
                  {stats.total > 0
                    ? Math.round((stats.occupied / stats.total) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Floor Summary */}
          {uniqueFloors.length > 0 && (
            <div
              className="floor-summary"
              style={{
                marginBottom: "20px",
                padding: "15px",
                background: "#f8fafc",
                borderRadius: "12px",
              }}
            >
              <h3 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
                🏢 Floor Summary
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "10px",
                }}
              >
                {uniqueFloors.map((floor) => {
                  const bedsOnFloor = beds.filter((b) => b.floor === floor);
                  const availableOnFloor = bedsOnFloor.filter(
                    (b) => b.status === "available",
                  ).length;
                  const totalOnFloor = bedsOnFloor.length;
                  return (
                    <div
                      key={floor}
                      style={{
                        background: "white",
                        padding: "8px 12px",
                        borderRadius: "8px",
                      }}
                    >
                      <strong>Floor {floor}</strong>
                      <div>
                        {availableOnFloor}/{totalOnFloor} beds available
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Queue Summary */}
          {waitingQueue.length > 0 && (
            <div
              className="queue-summary"
              onClick={() => setShowQueueModal(true)}
              style={{
                background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                borderRadius: "12px",
                padding: "15px",
                marginBottom: "20px",
                cursor: "pointer",
                transition: "transform 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px" }}>
                    ⏳ Waiting Queue
                  </h3>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: "#92400e",
                    }}
                  >
                    {waitingQueue.length} patient(s)
                  </div>
                </div>
                <div style={{ fontSize: "32px" }}>👥</div>
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "12px",
                  color: "#b45309",
                }}
              >
                Highest priority: {waitingQueue[0]?.name} (Score:{" "}
                {waitingQueue[0]?.priority})
              </div>
              <div
                style={{ fontSize: "11px", marginTop: "8px", color: "#92400e" }}
              >
                Click to view full queue
              </div>
            </div>
          )}

          {/* Prediction Quick Card */}
          {bedPredictions.length > 0 && (
            <div
              className="prediction-summary"
              onClick={() => {
                predictBedAvailability();
                setShowPredictionsModal(true);
              }}
              style={{
                background: "linear-gradient(135deg, #f3e8ff, #e9d5ff)",
                borderRadius: "12px",
                padding: "15px",
                marginBottom: "20px",
                cursor: "pointer",
                transition: "transform 0.2s ease",
                border: "1px solid #c4b5fd",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px", color: "#7c3aed" }}>
                    🔮 Bed Predictions
                  </h3>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: "#6d28d9",
                    }}
                  >
                    {bedPredictions.length} bed
                    {bedPredictions.length !== 1 ? "s" : ""} soon
                  </div>
                </div>
                <div style={{ fontSize: "32px" }}>📊</div>
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "12px",
                  color: "#5b21b6",
                }}
              >
                {bedPredictions[0]?.type} bed free in{" "}
                {bedPredictions[0]?.hoursRemaining} hours
              </div>
              <div
                style={{ fontSize: "11px", marginTop: "8px", color: "#7c3aed" }}
              >
                Click for detailed predictions
              </div>
            </div>
          )}

          {/* AI Status */}
          <div className="ai-status">
            <h3>🤖 AI System Status</h3>
            <div className="status-items">
              <div className="status-item">
                <span
                  className={`status-dot ${autoAllocate ? "active" : ""}`}
                ></span>
                <span>
                  Auto-Allocation: {autoAllocate ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="status-item">
                <span className="status-dot active"></span>
                <span>Queue Monitoring: Active</span>
              </div>
              <div className="status-item">
                <span className="status-dot active"></span>
                <span>Real-time Sync: Active</span>
              </div>
              <div className="status-item">
                <span
                  className={`status-dot ${bedPredictions.length > 0 ? "active" : ""}`}
                ></span>
                <span>
                  Prediction Engine:{" "}
                  {bedPredictions.length > 0
                    ? `${bedPredictions.length} predictions`
                    : "Idle"}
                </span>
              </div>
              {isAllocating && (
                <div className="status-item">
                  <span className="status-dot"></span>
                  <span>Allocating in progress...</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <h3>⚡ Quick Actions</h3>
            <button
              onClick={() => setShowAiForm(true)}
              className="quick-action-btn"
            >
              <span>🤖</span> New Admission
            </button>
            <button
              onClick={() => setShowBulkForm(true)}
              className="quick-action-btn"
            >
              <span>🏗️</span> Bulk Create Beds
            </button>
            <button
              onClick={() => {
                predictBedAvailability();
                setShowPredictionsModal(true);
              }}
              className="quick-action-btn"
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                color: "white",
              }}
            >
              <span>🔮</span> Predict Bed Availability
              {bedPredictions.filter((p) => p.daysRemaining <= 1).length >
                0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "white",
                    color: "#7c3aed",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "11px",
                  }}
                >
                  {bedPredictions.filter((p) => p.daysRemaining <= 1).length}{" "}
                  soon
                </span>
              )}
            </button>
            {waitingQueue.length > 0 && (
              <button
                onClick={() => autoAllocateFromQueue()}
                className="quick-action-btn"
                style={{ background: "#10b981", color: "white" }}
              >
                <span>⚡</span> Force Allocate Now
              </button>
            )}
            <button
              onClick={() => setShowQueueModal(true)}
              className="quick-action-btn"
            >
              <span>👥</span> View Full Queue ({waitingQueue.length})
            </button>
          </div>

          {/* Bed Type Statistics */}
          {stats.total > 0 && (
            <div className="current-stats">
              <h3>📊 Statistics by Type</h3>
              <div className="stats-grid">
                {Object.entries(stats.byType).map(([type, data]) => (
                  <div key={type} className="stat-card">
                    <div className="stat-card-header">
                      <span className="category-icon">
                        {getBedTypeIcon(type)}
                      </span>
                      <span className="category-name">{type}</span>
                    </div>
                    <div className="stat-card-body">
                      <div className="stat-item">
                        <span>Total</span>
                        <span className="stat-value">{data.total}</span>
                      </div>
                      <div className="stat-item">
                        <span>Available</span>
                        <span className="stat-value available">
                          {data.available}
                        </span>
                      </div>
                      <div className="stat-item">
                        <span>Occupied</span>
                        <span className="stat-value occupied">
                          {data.occupied}
                        </span>
                      </div>
                      <div className="occupancy-rate">
                        <div className="occupancy-bar">
                          <div
                            className="occupancy-fill"
                            style={{
                              width: `${data.total > 0 ? (data.occupied / data.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="occupancy-text">
                          {data.total > 0
                            ? Math.round((data.occupied / data.total) * 100)
                            : 0}
                          % Occupied
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};;;

export default BedManagement;