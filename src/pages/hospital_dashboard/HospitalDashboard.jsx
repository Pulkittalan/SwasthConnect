import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebase/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { Line, Bar, Pie, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import "./HospitalDashboard.css";
import BedRequestManagement from "../bedrequest/BedRequestManagement";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
);

const HospitalDashboard = () => {
  const { hospitalId } = useParams();
  const navigate = useNavigate();
  const [hospitalData, setHospitalData] = useState(null);
  const [bedData, setBedData] = useState({});
  const [bedsList, setBedsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("table");
  const [logoError, setLogoError] = useState(false);
  const [floatingLogoError, setFloatingLogoError] = useState(false);
  const [loadingLogoError, setLoadingLogoError] = useState(false);

  // State for different sections
  const [activeSection, setActiveSection] = useState("dashboard");
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [bedRequests, setBedRequests] = useState([]);
  const [loadingSection, setLoadingSection] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState("week"); // week, month, year

  // AI Insights State
  const [aiInsights, setAiInsights] = useState({
    loading: false,
    predictions: [],
    recommendations: [],
    alerts: [],
  });

  // Form states
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // New patient form data
  const [newPatient, setNewPatient] = useState({
    name: "",
    age: "",
    gender: "",
    contact: "",
    address: "",
    bloodGroup: "",
    emergencyContact: "",
    medicalHistory: "",
    admissionDate: new Date().toISOString().split("T")[0],
    status: "admitted",
    bedType: "",
    bedId: "",
    doctorAssigned: "",
    doctorId: "",
    patientId: "",
  });

  // New doctor form data
  const [newDoctor, setNewDoctor] = useState({
    name: "",
    specialization: "",
    qualification: "",
    experience: "",
    contact: "",
    email: "",
    availability: "available",
    consultationFee: "",
    department: "",
    joiningDate: new Date().toISOString().split("T")[0],
    address: "",
    doctorId: "",
  });

  // New appointment form data
  const [newAppointment, setNewAppointment] = useState({
    patientName: "",
    patientId: "",
    doctorName: "",
    doctorId: "",
    date: new Date().toISOString().split("T")[0],
    time: "",
    type: "consultation",
    status: "scheduled",
    notes: "",
  });

  // Helper function to format Firestore timestamps
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";

    if (timestamp && typeof timestamp === "object" && "seconds" in timestamp) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }

    if (timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleString();
    }

    if (typeof timestamp === "string" || typeof timestamp === "number") {
      return new Date(timestamp).toLocaleString();
    }

    return "N/A";
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";

    if (timestamp && typeof timestamp === "object" && "seconds" in timestamp) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }

    if (timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleDateString();
    }

    if (typeof timestamp === "string" || typeof timestamp === "number") {
      return new Date(timestamp).toLocaleDateString();
    }

    return "N/A";
  };

  const calculateBedStats = () => {
    let total = 0;
    let available = 0;

    Object.values(bedData).forEach((category) => {
      total += category.totalBeds || 0;
      available += category.availableBeds || 0;
    });

    return { total, available, occupied: total - available };
  };

  // Calculate weekly growth
  const calculateWeeklyGrowth = () => {
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);

    const lastWeekPatients = patients.filter((p) => {
      const admissionDate = p.admissionDate;
      if (!admissionDate) return false;
      const date = new Date(admissionDate);
      return date >= oneWeekAgo && date <= today;
    }).length;

    const previousWeekPatients = patients.filter((p) => {
      const admissionDate = p.admissionDate;
      if (!admissionDate) return false;
      const date = new Date(admissionDate);
      return date >= twoWeeksAgo && date < oneWeekAgo;
    }).length;

    if (previousWeekPatients === 0) return 0;
    return (
      ((lastWeekPatients - previousWeekPatients) / previousWeekPatients) * 100
    );
  };

  // Generate AI Insights based on data
  const generateAIInsights = useMemo(() => {
    const insights = {
      predictions: [],
      recommendations: [],
      alerts: [],
    };

    // Bed Utilization Analysis
    const { total, available, occupied } = calculateBedStats();
    const utilizationRate = total > 0 ? (occupied / total) * 100 : 0;

    if (utilizationRate > 85) {
      insights.alerts.push({
        type: "critical",
        message: `⚠️ Bed utilization is at ${utilizationRate.toFixed(1)}%. Consider adding more beds or optimizing allocation.`,
        icon: "🛏️",
      });
    } else if (utilizationRate > 70) {
      insights.alerts.push({
        type: "warning",
        message: `📊 Bed utilization at ${utilizationRate.toFixed(1)}%. Monitor closely as we approach peak capacity.`,
        icon: "⚠️",
      });
    }

    // Patient Trend Analysis
    const last30DaysPatients = patients.filter((p) => {
      const admissionDate = p.admissionDate;
      if (!admissionDate) return false;
      const date = new Date(admissionDate);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date >= thirtyDaysAgo;
    }).length;

    const avgPatientsPerDay = (last30DaysPatients / 30).toFixed(1);
    insights.predictions.push({
      title: "Patient Admission Trend",
      value: `${avgPatientsPerDay} patients/day`,
      description: `Based on last 30 days data. Projected monthly admissions: ${Math.round(avgPatientsPerDay * 30)}`,
    });

    // Bed Category Analysis
    const bedCategories = Object.entries(bedData);
    const criticalCategories = bedCategories.filter(([_, data]) => {
      const occupancy =
        data.totalBeds > 0
          ? ((data.totalBeds - data.availableBeds) / data.totalBeds) * 100
          : 0;
      return occupancy > 80;
    });

    if (criticalCategories.length > 0) {
      insights.recommendations.push({
        title: "Bed Capacity Alert",
        message: `${criticalCategories.map(([cat]) => cat).join(", ")} ${criticalCategories.length === 1 ? "is" : "are"} at critical capacity. Consider reallocation.`,
        action: "Review bed allocation",
      });
    }

    // Doctor-Patient Ratio Analysis
    const doctorPatientRatio =
      doctors.length > 0 ? (patients.length / doctors.length).toFixed(1) : 0;
    if (doctorPatientRatio > 20) {
      insights.recommendations.push({
        title: "Doctor Workload Alert",
        message: `Current doctor-patient ratio is 1:${doctorPatientRatio}. Consider hiring additional staff.`,
        action: "Hire more doctors",
      });
    }

    // Appointment Analysis
    const upcomingAppointments = appointments.filter((a) => {
      const appointmentDate = new Date(a.date);
      const today = new Date();
      return appointmentDate >= today && a.status === "scheduled";
    }).length;

    if (upcomingAppointments > 50) {
      insights.recommendations.push({
        title: "High Appointment Volume",
        message: `${upcomingAppointments} upcoming appointments. Ensure adequate staff availability.`,
        action: "Schedule staff accordingly",
      });
    }

    // Predictive Analytics
    const weeklyGrowth = calculateWeeklyGrowth();
    if (weeklyGrowth > 10) {
      insights.predictions.push({
        title: "Growth Trend Alert",
        value: `${weeklyGrowth.toFixed(1)}% increase`,
        description: `Patient admissions have increased by ${weeklyGrowth.toFixed(1)}% this week compared to last week.`,
      });
    }

    return insights;
  }, [patients, doctors, appointments, bedData]);

  

  // Chart Data for Bed Utilization
  const bedUtilizationData = useMemo(() => {
    const categories = Object.keys(bedData);
    const totalBeds = categories.map((cat) => bedData[cat]?.totalBeds || 0);
    const occupiedBeds = categories.map(
      (cat) =>
        (bedData[cat]?.totalBeds || 0) - (bedData[cat]?.availableBeds || 0),
    );

    return {
      labels: categories,
      datasets: [
        {
          label: "Total Beds",
          data: totalBeds,
          backgroundColor: "rgba(13, 148, 136, 0.5)",
          borderColor: "rgb(13, 148, 136)",
          borderWidth: 2,
        },
        {
          label: "Occupied Beds",
          data: occupiedBeds,
          backgroundColor: "rgba(239, 68, 68, 0.5)",
          borderColor: "rgb(239, 68, 68)",
          borderWidth: 2,
        },
      ],
    };
  }, [bedData]);

  // Chart Data for Patient Admissions (Last 7 days)
  const patientAdmissionData = useMemo(() => {
    const last7Days = [];
    const admissionCounts = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      last7Days.push(dateStr);

      const count = patients.filter((p) => {
        const admissionDate = p.admissionDate;
        if (!admissionDate) return false;
        const pDate = new Date(admissionDate);
        return pDate.toDateString() === date.toDateString();
      }).length;

      admissionCounts.push(count);
    }

    return {
      labels: last7Days,
      datasets: [
        {
          label: "New Admissions",
          data: admissionCounts,
          fill: true,
          backgroundColor: "rgba(13, 148, 136, 0.1)",
          borderColor: "rgb(13, 148, 136)",
          tension: 0.4,
          pointBackgroundColor: "rgb(13, 148, 136)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [patients]);

  // Chart Data for Bed Occupancy by Category (Pie Chart)
  const bedOccupancyPieData = useMemo(() => {
    const categories = Object.keys(bedData);
    const occupiedBeds = categories.map(
      (cat) =>
        (bedData[cat]?.totalBeds || 0) - (bedData[cat]?.availableBeds || 0),
    );

    return {
      labels: categories,
      datasets: [
        {
          label: "Occupied Beds",
          data: occupiedBeds,
          backgroundColor: [
            "rgba(239, 68, 68, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(59, 130, 246, 0.8)",
            "rgba(139, 92, 246, 0.8)",
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [bedData]);

  // Chart Data for Appointment Status Distribution
  const appointmentStatusData = useMemo(() => {
    const statuses = {
      scheduled: appointments.filter((a) => a.status === "scheduled").length,
      confirmed: appointments.filter((a) => a.status === "confirmed").length,
      completed: appointments.filter((a) => a.status === "completed").length,
      cancelled: appointments.filter((a) => a.status === "cancelled").length,
    };

    return {
      labels: ["Scheduled", "Confirmed", "Completed", "Cancelled"],
      datasets: [
        {
          data: [
            statuses.scheduled,
            statuses.confirmed,
            statuses.completed,
            statuses.cancelled,
          ],
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(107, 114, 128, 0.8)",
            "rgba(239, 68, 68, 0.8)",
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [appointments]);

  // Chart Data for Doctor Workload
  const doctorWorkloadData = useMemo(() => {
    const topDoctors = doctors.slice(0, 6);
    const doctorNames = topDoctors.map((d) => d.name.split(" ")[1] || d.name);
    const patientCounts = topDoctors.map((d) => {
      return patients.filter((p) => p.doctorAssigned === d.name).length;
    });

    return {
      labels: doctorNames,
      datasets: [
        {
          label: "Patients Assigned",
          data: patientCounts,
          backgroundColor: "rgba(13, 148, 136, 0.6)",
          borderColor: "rgb(13, 148, 136)",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    };
  }, [doctors, patients]);

  // Logo URLs
  const logoUrl = "./logo.png";
  const fallbackLogoText = "SS";

  // Real-time subscription to beds
  useEffect(() => {
    if (!hospitalId) return;

    const bedsRef = collection(db, "hospitals", hospitalId, "beds");
    const unsubscribe = onSnapshot(bedsRef, (snapshot) => {
      const beds = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBedsList(beds);

      const transformedBedData = {};
      beds.forEach((bed) => {
        if (!transformedBedData[bed.type]) {
          transformedBedData[bed.type] = {
            totalBeds: 0,
            availableBeds: 0,
            floors: {},
          };
        }
        transformedBedData[bed.type].totalBeds++;
        if (bed.status === "available") {
          transformedBedData[bed.type].availableBeds++;
        }

        const floor = bed.floor || "1";
        if (!transformedBedData[bed.type].floors[floor]) {
          transformedBedData[bed.type].floors[floor] = {
            total: 0,
            available: 0,
          };
        }
        transformedBedData[bed.type].floors[floor].total++;
        if (bed.status === "available") {
          transformedBedData[bed.type].floors[floor].available++;
        }
      });

      setBedData(transformedBedData);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [hospitalId]);

  useEffect(() => {
    const fetchHospitalData = async () => {
      try {
        const docRef = doc(db, "hospitals", hospitalId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setHospitalData(data);

          await fetchPatients(hospitalId);
          await fetchDoctors(hospitalId);
          await fetchAppointments(hospitalId);
          await fetchBedRequests(hospitalId);
        } else {
          console.error("Hospital not found");
          setFormError("Hospital not found");
        }
      } catch (error) {
        console.error("Error fetching hospital data:", error);
        setFormError("Error loading hospital data");
      } finally {
        setLoading(false);
      }
    };

    if (hospitalId) {
      fetchHospitalData();
    }
  }, [hospitalId]);

  const fetchPatients = async (hospitalId) => {
    try {
      const patientsRef = collection(db, "hospitals", hospitalId, "patients");
      const patientsSnap = await getDocs(patientsRef);
      const patientsList = patientsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPatients(patientsList);
    } catch (error) {
      console.error("Error fetching patients:", error);
      setPatients(getMockPatients());
    }
  };

  const fetchDoctors = async (hospitalId) => {
    try {
      const doctorsRef = collection(db, "hospitals", hospitalId, "doctors");
      const doctorsSnap = await getDocs(doctorsRef);
      const doctorsList = doctorsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDoctors(doctorsList);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      setDoctors(getMockDoctors());
    }
  };

  const fetchAppointments = async (hospitalId) => {
    try {
      const appointmentsRef = collection(
        db,
        "hospitals",
        hospitalId,
        "appointments",
      );
      const appointmentsSnap = await getDocs(appointmentsRef);
      const appointmentsList = appointmentsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAppointments(appointmentsList);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      setAppointments(getMockAppointments());
    }
  };

  const fetchBedRequests = async (hospitalId) => {
    try {
      if (!hospitalId) {
        console.error("No hospital ID provided");
        return;
      }

      const requestsRef = collection(
        db,
        "hospitals",
        hospitalId,
        "bedRequests",
      );
      const q = query(requestsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      const requestsList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setBedRequests(requestsList);
    } catch (error) {
      console.error("Error fetching bed requests:", error);
      setBedRequests([]);
    }
  };

  const getMockPatients = () => [
    {
      id: "P001",
      name: "Rahul Sharma",
      age: 45,
      gender: "Male",
      bloodGroup: "O+",
      contact: "+91 98765 43210",
      admissionDate: "2026-03-01",
      bedType: "ICU",
      doctorAssigned: "Dr. Priya Singh",
      doctorId: "D001",
      status: "admitted",
      address: "Delhi",
      emergencyContact: "+91 98765 43211",
      patientId: "P001",
    },
    {
      id: "P002",
      name: "Priya Patel",
      age: 32,
      gender: "Female",
      bloodGroup: "A+",
      contact: "+91 98765 43212",
      admissionDate: "2026-03-02",
      bedType: "General Ward",
      doctorAssigned: "Dr. Amit Kumar",
      doctorId: "D002",
      status: "admitted",
      address: "Mumbai",
      emergencyContact: "+91 98765 43213",
      patientId: "P002",
    },
    {
      id: "P003",
      name: "Amit Singh",
      age: 28,
      gender: "Male",
      bloodGroup: "B+",
      contact: "+91 98765 43214",
      admissionDate: "2026-03-03",
      bedType: "Emergency",
      doctorAssigned: "Dr. Priya Singh",
      doctorId: "D001",
      status: "admitted",
      address: "Bangalore",
      emergencyContact: "+91 98765 43215",
      patientId: "P003",
    },
  ];

  const getMockDoctors = () => [
    {
      id: "D001",
      name: "Dr. Priya Singh",
      specialization: "Cardiologist",
      qualification: "MD, DM Cardiology",
      experience: 12,
      contact: "+91 98765 43220",
      email: "priya.singh@hospital.com",
      availability: "available",
      consultationFee: 800,
      patientsCount: 45,
      rating: 4.8,
      address: "Greater Noida",
      department: "Cardiology",
      doctorId: "D001",
      joiningDate: "2024-01-15",
    },
    {
      id: "D002",
      name: "Dr. Amit Kumar",
      specialization: "Neurologist",
      qualification: "MD, DM Neurology",
      experience: 8,
      contact: "+91 98765 43221",
      email: "amit.kumar@hospital.com",
      availability: "busy",
      consultationFee: 1000,
      patientsCount: 32,
      rating: 4.6,
      address: "Delhi",
      department: "Neurology",
      doctorId: "D002",
      joiningDate: "2024-03-10",
    },
  ];

  const getMockAppointments = () => [
    {
      id: "A001",
      patientName: "Rahul Sharma",
      patientId: "P001",
      doctorName: "Dr. Priya Singh",
      doctorId: "D001",
      date: "2026-03-05",
      time: "10:00 AM",
      type: "Follow-up",
      status: "scheduled",
    },
    {
      id: "A002",
      patientName: "Priya Patel",
      patientId: "P002",
      doctorName: "Dr. Amit Kumar",
      doctorId: "D002",
      date: "2026-03-06",
      time: "11:30 AM",
      type: "Consultation",
      status: "confirmed",
    },
  ];

  const handleLogoClick = () => {
    navigate("/");
  };

  const generateEncryptedBedUrl = () => {
    if (!hospitalData) return "#";

    const currentHospitalId =
      hospitalId || hospitalData.id || hospitalData.hospitalId;

    if (!currentHospitalId) {
      console.error("No hospital ID available");
      return "#";
    }

    const timestamp = Date.now();
    const dataToEncrypt = JSON.stringify({
      hospitalId: currentHospitalId,
      hospitalName: hospitalData.name,
      timestamp,
      bedData: bedData,
    });

    const encrypted = btoa(encodeURIComponent(dataToEncrypt));

    return `#/bed-management?token=${encrypted}&h=${currentHospitalId}&t=${timestamp}`;
  };

  

  const getUtilizationColor = (total, occupied) => {
    const utilization = total > 0 ? (occupied / total) * 100 : 0;
    if (utilization >= 80) return "utilization-high";
    if (utilization >= 50) return "utilization-medium";
    return "utilization-low";
  };

  const getCategoryIcon = (category) => {
    const icons = {
      ICU: "💙",
      Emergency: "🚨",
      Surgical: "💚",
      "General Ward": "🛏️",
      "Private Room": "🏠",
    };
    return icons[category] || "🛏️";
  };

  const getStatusLabel = (available) => {
    if (available > 10) return { label: "High", color: "#10b981" };
    if (available > 5) return { label: "Moderate", color: "#f59e0b" };
    if (available > 0) return { label: "Low", color: "#ef4444" };
    return { label: "Full", color: "#dc2626" };
  };

  const generateId = (prefix) => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `${prefix}${timestamp}${random}`;
  };

  const handleAddPatient = async () => {
    if (
      !newPatient.name ||
      !newPatient.age ||
      !newPatient.gender ||
      !newPatient.contact
    ) {
      setFormError("Please fill in all required fields");
      return;
    }

    setFormSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
      const patientId = newPatient.patientId || generateId("P");

      let selectedBed = null;
      if (newPatient.bedId) {
        selectedBed = bedsList.find((b) => b.id === newPatient.bedId);
      }

      const patientData = {
        patientId: patientId,
        name: newPatient.name,
        age: parseInt(newPatient.age) || 0,
        gender: newPatient.gender,
        contact: newPatient.contact,
        address: newPatient.address || "",
        bloodGroup: newPatient.bloodGroup || "",
        emergencyContact: newPatient.emergencyContact || "",
        medicalHistory: newPatient.medicalHistory || "",
        admissionDate:
          newPatient.admissionDate || new Date().toISOString().split("T")[0],
        status: newPatient.status || "admitted",
        bedType: newPatient.bedType || "",
        bedId: newPatient.bedId || "",
        bedNumber: selectedBed?.bedId || "",
        doctorAssigned: newPatient.doctorAssigned || "",
        doctorId: newPatient.doctorId || "",
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        hospitalId: hospitalId,
        city: hospitalData?.city || "",
        state: hospitalData?.state || "",
      };

      const patientsRef = collection(db, "hospitals", hospitalId, "patients");
      const docRef = await addDoc(patientsRef, patientData);

      if (selectedBed && selectedBed.status === "available") {
        const bedRef = doc(db, "hospitals", hospitalId, "beds", selectedBed.id);
        await updateDoc(bedRef, {
          status: "occupied",
          patientId: patientId,
          patientName: newPatient.name,
          patientAge: parseInt(newPatient.age),
          patientCondition: "admitted",
          admissionDate: serverTimestamp(),
        });
      }

      const newPatientWithId = {
        id: docRef.id,
        ...patientData,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      setPatients((prev) => [...prev, newPatientWithId]);
      setFormSuccess("Patient added successfully!");

      setNewPatient({
        name: "",
        age: "",
        gender: "",
        contact: "",
        address: "",
        bloodGroup: "",
        emergencyContact: "",
        medicalHistory: "",
        admissionDate: new Date().toISOString().split("T")[0],
        status: "admitted",
        bedType: "",
        bedId: "",
        doctorAssigned: "",
        doctorId: "",
        patientId: "",
      });

      setTimeout(() => {
        setShowPatientForm(false);
        setFormSuccess("");
      }, 2000);
    } catch (error) {
      console.error("Error adding patient:", error);
      setFormError("Failed to add patient: " + error.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleAddDoctor = async () => {
    if (!newDoctor.name || !newDoctor.specialization || !newDoctor.contact) {
      setFormError("Please fill in all required fields");
      return;
    }

    setFormSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
      const doctorId = newDoctor.doctorId || generateId("D");

      const doctorData = {
        doctorId: doctorId,
        name: newDoctor.name,
        specialization: newDoctor.specialization,
        qualification: newDoctor.qualification || "",
        experience: parseInt(newDoctor.experience) || 0,
        contact: newDoctor.contact,
        email: newDoctor.email || "",
        availability: newDoctor.availability || "available",
        consultationFee: parseFloat(newDoctor.consultationFee) || 0,
        department: newDoctor.department || "",
        joiningDate:
          newDoctor.joiningDate || new Date().toISOString().split("T")[0],
        address: newDoctor.address || "",
        patientsCount: 0,
        rating: 4.5,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        hospitalId: hospitalId,
        city: hospitalData?.city || "",
        state: hospitalData?.state || "",
        status: "active",
      };

      const doctorsRef = collection(db, "hospitals", hospitalId, "doctors");
      const docRef = await addDoc(doctorsRef, doctorData);

      const newDoctorWithId = {
        id: docRef.id,
        ...doctorData,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      setDoctors((prev) => [...prev, newDoctorWithId]);
      setFormSuccess("Doctor added successfully!");

      setNewDoctor({
        name: "",
        specialization: "",
        qualification: "",
        experience: "",
        contact: "",
        email: "",
        availability: "available",
        consultationFee: "",
        department: "",
        joiningDate: new Date().toISOString().split("T")[0],
        address: "",
        doctorId: "",
      });

      setTimeout(() => {
        setShowDoctorForm(false);
        setFormSuccess("");
      }, 2000);
    } catch (error) {
      console.error("Error adding doctor:", error);
      setFormError("Failed to add doctor: " + error.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleAddAppointment = async () => {
    if (
      !newAppointment.patientName ||
      !newAppointment.doctorName ||
      !newAppointment.date ||
      !newAppointment.time
    ) {
      setFormError("Please fill in all required fields");
      return;
    }

    setFormSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
      const appointmentId = generateId("A");

      const appointmentData = {
        appointmentId: appointmentId,
        patientName: newAppointment.patientName,
        patientId: newAppointment.patientId || "",
        doctorName: newAppointment.doctorName,
        doctorId: newAppointment.doctorId || "",
        date: newAppointment.date,
        time: newAppointment.time,
        type: newAppointment.type || "consultation",
        status: newAppointment.status || "scheduled",
        notes: newAppointment.notes || "",
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        hospitalId: hospitalId,
      };

      const appointmentsRef = collection(
        db,
        "hospitals",
        hospitalId,
        "appointments",
      );
      const docRef = await addDoc(appointmentsRef, appointmentData);

      const newAppointmentWithId = {
        id: docRef.id,
        ...appointmentData,
        createdAt: new Date().toISOString(),
      };

      setAppointments((prev) => [...prev, newAppointmentWithId]);
      setFormSuccess("Appointment scheduled successfully!");

      setNewAppointment({
        patientName: "",
        patientId: "",
        doctorName: "",
        doctorId: "",
        date: new Date().toISOString().split("T")[0],
        time: "",
        type: "consultation",
        status: "scheduled",
        notes: "",
      });

      setTimeout(() => {
        setShowAppointmentForm(false);
        setFormSuccess("");
      }, 2000);
    } catch (error) {
      console.error("Error adding appointment:", error);
      setFormError("Failed to schedule appointment: " + error.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handlePatientInputChange = (e) => {
    const { name, value } = e.target;
    setNewPatient((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "doctorAssigned") {
      const selectedDoctor = doctors.find((d) => d.name === value);
      if (selectedDoctor) {
        setNewPatient((prev) => ({
          ...prev,
          doctorId: selectedDoctor.doctorId || selectedDoctor.id,
        }));
      }
    }
  };

  const handleDoctorInputChange = (e) => {
    const { name, value } = e.target;
    setNewDoctor((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAppointmentInputChange = (e) => {
    const { name, value } = e.target;
    setNewAppointment((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "patientName") {
      const selectedPatient = patients.find((p) => p.name === value);
      if (selectedPatient) {
        setNewAppointment((prev) => ({
          ...prev,
          patientId: selectedPatient.patientId || selectedPatient.id,
        }));
      }
    }

    if (name === "doctorName") {
      const selectedDoctor = doctors.find((d) => d.name === value);
      if (selectedDoctor) {
        setNewAppointment((prev) => ({
          ...prev,
          doctorId: selectedDoctor.doctorId || selectedDoctor.id,
        }));
      }
    }
  };

  const handleBedUpdate = (updatedBedData) => {
    const bedsRef = collection(db, "hospitals", hospitalId, "beds");
    const unsubscribe = onSnapshot(bedsRef, (snapshot) => {
      const beds = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBedsList(beds);

      const transformedBedData = {};
      beds.forEach((bed) => {
        if (!transformedBedData[bed.type]) {
          transformedBedData[bed.type] = {
            totalBeds: 0,
            availableBeds: 0,
            floors: {},
          };
        }
        transformedBedData[bed.type].totalBeds++;
        if (bed.status === "available") {
          transformedBedData[bed.type].availableBeds++;
        }

        const floor = bed.floor || "1";
        if (!transformedBedData[bed.type].floors[floor]) {
          transformedBedData[bed.type].floors[floor] = {
            total: 0,
            available: 0,
          };
        }
        transformedBedData[bed.type].floors[floor].total++;
        if (bed.status === "available") {
          transformedBedData[bed.type].floors[floor].available++;
        }
      });

      setBedData(transformedBedData);
    });

    fetchBedRequests(hospitalId);
  };

  const { total, available, occupied } = calculateBedStats();

  const LogoComponent = ({
    isFloating = false,
    isLarge = false,
    onError = null,
  }) => {
    const width = isLarge ? "80px" : isFloating ? "80px" : "60px";
    const height = isLarge ? "80px" : isFloating ? "80px" : "60px";
    const hasError = isFloating
      ? floatingLogoError
      : isLarge
        ? loadingLogoError
        : logoError;
    const errorHandler = isFloating
      ? setFloatingLogoError
      : isLarge
        ? setLoadingLogoError
        : setLogoError;

    const handleClick = () => {
      handleLogoClick();
    };

    const handleImageError = (e) => {
      errorHandler(true);
      e.target.style.display = "none";
      if (onError) onError();
    };

    return (
      <div
        className={
          isFloating
            ? "floating-logo"
            : isLarge
              ? "loading-logo-image"
              : "logo-image"
        }
        onClick={handleClick}
        style={{
          width,
          height,
          cursor: "pointer",
        }}
      >
        {hasError ? (
          <div
            className="logo-fallback"
            style={{ width: "100%", height: "100%" }}
          >
            {fallbackLogoText}
          </div>
        ) : (
          <img
            src={logoUrl}
            alt="Swasthya Setu Logo"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              objectFit: "cover",
            }}
            onError={handleImageError}
          />
        )}
      </div>
    );
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "patients", label: "Patients", icon: "👥", badge: patients.length },
    { id: "doctors", label: "Doctors", icon: "👨‍⚕️", badge: doctors.length },
    {
      id: "appointments",
      label: "Appointments",
      icon: "📅",
      badge: appointments.length,
    },
    {
      id: "bed-requests",
      label: "Bed Requests",
      icon: "🤖",
      badge: bedRequests.filter((r) => r.status === "pending").length,
    },
    { id: "beds", label: "Bed Management", icon: "🛏️" },
  ];

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-logo">
          <LogoComponent isLarge={true} />
          <div
            style={{
              fontSize: "2.5em",
              background: "linear-gradient(135deg, #0d9488, #7c3aed)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: "800",
              letterSpacing: "-1px",
              textAlign: "center",
              marginTop: "10px",
            }}
          >
            SwasthConnect
          </div>
          <p
            style={{ color: "#64748b", marginTop: "5px", textAlign: "center" }}
          >
            Connecting Healthcare...
          </p>
        </div>
        <div className="loading-spinner"></div>
        <p style={{ color: "#64748b", fontSize: "1.1em", marginTop: "20px" }}>
          Loading hospital dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="hospital-dashboard">
      <div className="floating-elements">
        <div className="floating-element">⚕️</div>
        <div className="floating-element">🩺</div>
        <div className="floating-element">❤️</div>
        <div className="floating-element">🛏️</div>
        <div className="floating-element">💊</div>
      </div>

      <div className="dashboard-with-sidebar">
        <div className="dashboard-sidebar">
          <div
            className="sidebar-header"
            style={{ textAlign: "center", marginBottom: "20px" }}
          >
            <LogoComponent />
            <h3 style={{ margin: "10px 0 5px", color: "#0d9488" }}>
              SwasthConnect
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b" }}>
              {hospitalData?.name}
            </p>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeSection === item.id ? "active" : ""}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </button>
            ))}
          </nav>

          <div
            className="sidebar-footer"
            style={{ marginTop: "auto", paddingTop: "20px" }}
          >
            <button className="nav-item" onClick={() => navigate("/settings")}>
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Settings</span>
            </button>
            <button className="nav-item" onClick={() => navigate("/logout")}>
              <span className="nav-icon">🚪</span>
              <span className="nav-label">Logout</span>
            </button>
          </div>
        </div>

        <div className="dashboard-main-content">
          <header className="dashboard-header">
            <div className="header-content">
              <div className="header-logo" onClick={handleLogoClick}>
                <LogoComponent />
                <div className="logo-text">
                  <h1>SwasthConnect</h1>
                  <span>Healthcare Bridge System</span>
                </div>
              </div>

              <h1 style={{ marginTop: "10px" }}>
                🏥 {hospitalData?.name || "Hospital Dashboard"}
              </h1>
              <p>📍 {hospitalData?.address || "No address available"}</p>
              <p>📞 {hospitalData?.contact || "No contact available"}</p>

              <div className="hospital-badge">
                <span style={{ fontSize: "1.2em" }}>🏥</span>
                <span>Hospital ID: {hospitalId}</span>
              </div>
            </div>
          </header>

          <div className="section-content">
            {activeSection === "dashboard" && (
              <div>
                <div className="stats-cards">
                  <div className="stat-card">
                    <div className="stat-card-icon">🛏️</div>
                    <h3>Total Beds</h3>
                    <p>{total}</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">✅</div>
                    <h3>Available Beds</h3>
                    <p>{available}</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">⏳</div>
                    <h3>Occupied Beds</h3>
                    <p>{occupied}</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">📊</div>
                    <h3>Utilization Rate</h3>
                    <p>
                      {total > 0 ? Math.round((occupied / total) * 100) : 0}%
                    </p>
                    <div className="utilization-progress">
                      <div
                        className={`utilization-fill ${getUtilizationColor(total, occupied)}`}
                        style={{
                          width: `${total > 0 ? (occupied / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {bedRequests.filter((r) => r.status === "pending").length >
                  0 && (
                  <div
                    className="alert-card"
                    style={{
                      background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                      borderRadius: "12px",
                      padding: "15px",
                      marginBottom: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "15px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span style={{ fontSize: "1.5rem" }}>🤖</span>
                      <div>
                        <strong style={{ color: "#92400e" }}>
                          {
                            bedRequests.filter((r) => r.status === "pending")
                              .length
                          }{" "}
                          Pending Bed Request(s)
                        </strong>
                        <p
                          style={{
                            margin: "0",
                            fontSize: "0.85rem",
                            color: "#b45309",
                          }}
                        >
                          AI recommendations available for allocation
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveSection("bed-requests")}
                      style={{
                        background: "#f59e0b",
                        border: "none",
                        padding: "8px 20px",
                        borderRadius: "8px",
                        color: "white",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      View Requests →
                    </button>
                  </div>
                )}

                <div className="action-section">
                  <button
                    className="edit-beds-btn"
                    onClick={() => {
                      const url = generateEncryptedBedUrl();
                      if (url.startsWith("#")) {
                        window.open(
                          window.location.origin +
                            window.location.pathname +
                            url,
                          "_blank",
                        );
                      } else {
                        window.open(url, "_blank");
                      }
                    }}
                  >
                    <span style={{ fontSize: "1.2em" }}>✏️</span>
                    <span>Edit Beds Management</span>
                  </button>

                  <div className="view-toggle">
                    <button
                      className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                      onClick={() => setViewMode("table")}
                    >
                      <span>📋</span>
                      <span>Table View</span>
                    </button>
                    <button
                      className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
                      onClick={() => setViewMode("cards")}
                    >
                      <span>🃏</span>
                      <span>Cards View</span>
                    </button>
                  </div>
                </div>

                <div className="hospital-details-section">
                  <div className="hospital-info-card">
                    <h2>🏥 Hospital Details</h2>
                    <div className="info-grid">
                      <div className="info-item">
                        <strong>Hospital ID</strong>
                        <span
                          style={{
                            fontSize: "1.1em",
                            fontWeight: "600",
                            color: "#0d9488",
                          }}
                        >
                          {hospitalId}
                        </span>
                      </div>
                      <div className="info-item">
                        <strong>Email Address</strong>
                        <span>{hospitalData?.email || "N/A"}</span>
                      </div>
                      <div className="info-item">
                        <strong>Emergency Contact</strong>
                        <span style={{ color: "#ef4444", fontWeight: "600" }}>
                          {hospitalData?.emergency_phone ||
                            hospitalData?.contact ||
                            "N/A"}
                        </span>
                      </div>
                      <div className="info-item">
                        <strong>Status</strong>
                        <span
                          style={{
                            color: "#10b981",
                            fontWeight: "600",
                            background: "#d1fae5",
                            padding: "4px 12px",
                            borderRadius: "12px",
                            fontSize: "0.9em",
                          }}
                        >
                          🟢 {hospitalData?.status || "Operational"}
                        </span>
                      </div>
                      <div className="info-item">
                        <strong>City</strong>
                        <span>{hospitalData?.city || "N/A"}</span>
                      </div>
                      <div className="info-item">
                        <strong>State</strong>
                        <span>{hospitalData?.state || "N/A"}</span>
                      </div>
                      <div className="info-item">
                        <strong>Pincode</strong>
                        <span>{hospitalData?.pincode || "N/A"}</span>
                      </div>
                      <div className="info-item">
                        <strong>Type</strong>
                        <span>{hospitalData?.type || "N/A"}</span>
                      </div>
                      <div className="info-item full-width">
                        <strong>Facilities</strong>
                        <div className="facilities-grid">
                          {hospitalData?.facilities?.map((facility, index) => (
                            <span key={index} className="facility-tag">
                              {facility}
                            </span>
                          )) || <span>No facilities listed</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bed-summary-card">
                    <div className="card-header">
                      <h2>
                        <span>🛏️</span>
                        <span>Bed Categories</span>
                      </h2>
                      <div className="category-count">
                        {Object.keys(bedData).length} Categories
                      </div>
                    </div>

                    {Object.keys(bedData).length > 0 ? (
                      viewMode === "table" ? (
                        <div className="table-container">
                          <table className="bed-categories-table">
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th>Total</th>
                                <th>Available</th>
                                <th>Occupied</th>
                                <th>Utilization</th>
                                <th>Floor-wise Availability</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(bedData).map(
                                ([category, data]) => {
                                  const totalBeds = data.totalBeds || 0;
                                  const availableBeds = data.availableBeds || 0;
                                  const occupiedBeds =
                                    totalBeds - availableBeds;
                                  const utilization =
                                    totalBeds > 0
                                      ? (occupiedBeds / totalBeds) * 100
                                      : 0;
                                  const status = getStatusLabel(availableBeds);

                                  return (
                                    <tr key={category}>
                                      <td style={{ textAlign: "left" }}>
                                        <span className="bed-category-icon">
                                          {getCategoryIcon(category)}
                                        </span>
                                        <span style={{ marginLeft: "8px" }}>
                                          {category}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: "center" }}>
                                        <span className="status-badge status-total">
                                          {totalBeds}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: "center" }}>
                                        <span className="status-badge status-available">
                                          {availableBeds}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: "center" }}>
                                        <span className="status-badge status-occupied">
                                          {occupiedBeds}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: "center" }}>
                                        <div
                                          style={{
                                            fontWeight: "600",
                                            color: "#1e293b",
                                          }}
                                        >
                                          {Math.round(utilization)}%
                                        </div>
                                        <div className="utilization-progress">
                                          <div
                                            className={`utilization-fill ${getUtilizationColor(totalBeds, occupiedBeds)}`}
                                            style={{ width: `${utilization}%` }}
                                          />
                                        </div>
                                      </td>
                                      <td>
                                        {data.floors &&
                                          Object.entries(data.floors).map(
                                            ([floor, floorData]) => (
                                              <div
                                                key={floor}
                                                style={{
                                                  fontSize: "0.85rem",
                                                  marginBottom: "4px",
                                                }}
                                              >
                                                Floor {floor}:{" "}
                                                {floorData.available}/
                                                {floorData.total} available
                                              </div>
                                            ),
                                          )}
                                      </td>
                                    </tr>
                                  );
                                },
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bed-cards-view">
                          {Object.entries(bedData).map(([category, data]) => {
                            const totalBeds = data.totalBeds || 0;
                            const availableBeds = data.availableBeds || 0;
                            const occupiedBeds = totalBeds - availableBeds;
                            const utilization =
                              totalBeds > 0
                                ? (occupiedBeds / totalBeds) * 100
                                : 0;
                            const status = getStatusLabel(availableBeds);

                            return (
                              <div key={category} className="bed-category-card">
                                <div className="bed-category-header">
                                  <h4>
                                    <span className="bed-category-icon">
                                      {getCategoryIcon(category)}
                                    </span>
                                    {category}
                                  </h4>
                                  <span
                                    style={{
                                      fontSize: "0.85em",
                                      padding: "6px 15px",
                                      borderRadius: "15px",
                                      background: `${status.color}15`,
                                      color: status.color,
                                      fontWeight: "600",
                                      border: `1px solid ${status.color}30`,
                                    }}
                                  >
                                    {status.label} Availability
                                  </span>
                                </div>

                                <div className="bed-stats-grid">
                                  <div className="stat-item">
                                    <div className="label">Total</div>
                                    <div
                                      className="value"
                                      style={{ color: "#1e40af" }}
                                    >
                                      {totalBeds}
                                    </div>
                                  </div>
                                  <div className="stat-item">
                                    <div className="label">Available</div>
                                    <div
                                      className="value"
                                      style={{ color: "#10b981" }}
                                    >
                                      {availableBeds}
                                    </div>
                                  </div>
                                  <div className="stat-item">
                                    <div className="label">Occupied</div>
                                    <div
                                      className="value"
                                      style={{ color: "#ef4444" }}
                                    >
                                      {occupiedBeds}
                                    </div>
                                  </div>
                                </div>

                                {data.floors && (
                                  <div
                                    style={{
                                      marginTop: "15px",
                                      paddingTop: "10px",
                                      borderTop: "1px solid #e2e8f0",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "0.8rem",
                                        fontWeight: "600",
                                        marginBottom: "8px",
                                        color: "#64748b",
                                      }}
                                    >
                                      Floor-wise Availability:
                                    </div>
                                    {Object.entries(data.floors).map(
                                      ([floor, floorData]) => (
                                        <div
                                          key={floor}
                                          style={{
                                            fontSize: "0.75rem",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            marginBottom: "4px",
                                          }}
                                        >
                                          <span>Floor {floor}:</span>
                                          <span
                                            style={{
                                              fontWeight: "600",
                                              color:
                                                floorData.available > 0
                                                  ? "#10b981"
                                                  : "#ef4444",
                                            }}
                                          >
                                            {floorData.available}/
                                            {floorData.total} available
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}

                                <div
                                  style={{
                                    marginTop: "20px",
                                    paddingTop: "15px",
                                    borderTop: "1px solid #e2e8f0",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.9em",
                                        color: "#64748b",
                                        fontWeight: "500",
                                      }}
                                    >
                                      Utilization:
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: "700",
                                        color: "#1e293b",
                                      }}
                                    >
                                      {Math.round(utilization)}%
                                    </span>
                                  </div>
                                  <div className="utilization-progress">
                                    <div
                                      className={`utilization-fill ${getUtilizationColor(totalBeds, occupiedBeds)}`}
                                      style={{ width: `${utilization}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="empty-state">
                        <div className="empty-state-icon">🛏️</div>
                        <h3>No Bed Data Available</h3>
                        <p>
                          Start by adding bed categories and their availability
                          to manage hospital resources effectively.
                        </p>
                        <button
                          className="edit-beds-btn"
                          onClick={() =>
                            window.open(generateEncryptedBedUrl(), "_blank")
                          }
                          style={{ padding: "15px 40px", fontSize: "16px" }}
                        >
                          <span>➕</span>
                          <span>Add Bed Categories</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === "analytics" && (
              <div>
                <div className="section-header">
                  <h2>
                    <span>📈</span> Advanced Analytics & AI Insights
                  </h2>
                  <div className="section-actions">
                    <select
                      className="view-btn"
                      value={selectedTimeRange}
                      onChange={(e) => setSelectedTimeRange(e.target.value)}
                      style={{ padding: "8px 16px" }}
                    >
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                      <option value="year">Last Year</option>
                    </select>
                    <button
                      className="edit-beds-btn"
                      onClick={() => window.location.reload()}
                    >
                      <span>🔄</span>
                      <span>Refresh Data</span>
                    </button>
                  </div>
                </div>

                {/* AI Insights Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
                    gap: "20px",
                    marginBottom: "30px",
                  }}
                >
                  {/* Predictions Card */}
                  <div
                    className="hospital-info-card"
                    style={{ padding: "20px" }}
                  >
                    <h3
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "15px",
                      }}
                    >
                      <span>🤖</span> AI Predictions
                    </h3>
                    {aiInsights.predictions.map((prediction, idx) => (
                      <div
                        key={idx}
                        style={{
                          marginBottom: "15px",
                          padding: "12px",
                          background:
                            "linear-gradient(135deg, #f0f9ff, #e0f2fe)",
                          borderRadius: "12px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            color: "#0d9488",
                            marginBottom: "5px",
                          }}
                        >
                          {prediction.title}
                        </div>
                        <div
                          style={{
                            fontSize: "1.2rem",
                            fontWeight: "bold",
                            marginBottom: "5px",
                          }}
                        >
                          {prediction.value}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                          {prediction.description}
                        </div>
                      </div>
                    ))}
                    {aiInsights.predictions.length === 0 && (
                      <div
                        style={{
                          color: "#64748b",
                          textAlign: "center",
                          padding: "20px",
                        }}
                      >
                        No predictions available at this time
                      </div>
                    )}
                  </div>

                  {/* Recommendations Card */}
                  <div
                    className="hospital-info-card"
                    style={{ padding: "20px" }}
                  >
                    <h3
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "15px",
                      }}
                    >
                      <span>💡</span> AI Recommendations
                    </h3>
                    {aiInsights.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        style={{
                          marginBottom: "15px",
                          padding: "12px",
                          background:
                            "linear-gradient(135deg, #fef3c7, #fde68a)",
                          borderRadius: "12px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            color: "#92400e",
                            marginBottom: "5px",
                          }}
                        >
                          {rec.title}
                        </div>
                        <div
                          style={{ fontSize: "0.9rem", marginBottom: "8px" }}
                        >
                          {rec.message}
                        </div>
                        <button
                          onClick={() => alert(rec.action)}
                          style={{
                            background: "#f59e0b",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            color: "white",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                          }}
                        >
                          {rec.action} →
                        </button>
                      </div>
                    ))}
                    {aiInsights.recommendations.length === 0 && (
                      <div
                        style={{
                          color: "#64748b",
                          textAlign: "center",
                          padding: "20px",
                        }}
                      >
                        All metrics look good! No recommendations needed.
                      </div>
                    )}
                  </div>

                  {/* Alerts Card */}
                  <div
                    className="hospital-info-card"
                    style={{ padding: "20px" }}
                  >
                    <h3
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "15px",
                      }}
                    >
                      <span>⚠️</span> Critical Alerts
                    </h3>
                    {aiInsights.alerts.map((alert, idx) => (
                      <div
                        key={idx}
                        style={{
                          marginBottom: "15px",
                          padding: "12px",
                          background:
                            alert.type === "critical" ? "#fee2e2" : "#fff3cd",
                          borderRadius: "12px",
                          borderLeft: `4px solid ${alert.type === "critical" ? "#ef4444" : "#f59e0b"}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "5px",
                          }}
                        >
                          <span>{alert.icon}</span>
                          <span
                            style={{
                              fontWeight: "bold",
                              color:
                                alert.type === "critical"
                                  ? "#991b1b"
                                  : "#856404",
                            }}
                          >
                            {alert.type === "critical" ? "Critical" : "Warning"}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.9rem" }}>
                          {alert.message}
                        </div>
                      </div>
                    ))}
                    {aiInsights.alerts.length === 0 && (
                      <div
                        style={{
                          color: "#10b981",
                          textAlign: "center",
                          padding: "20px",
                        }}
                      >
                        ✓ No critical alerts. System operating normally.
                      </div>
                    )}
                  </div>
                </div>

                {/* Charts Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
                    gap: "25px",
                    marginBottom: "30px",
                  }}
                >
                  {/* Bed Utilization Bar Chart */}
                  <div
                    className="hospital-info-card"
                    style={{ padding: "20px" }}
                  >
                    <h3 style={{ marginBottom: "20px" }}>
                      🛏️ Bed Utilization by Category
                    </h3>
                    {Object.keys(bedData).length > 0 ? (
                      <Bar
                        data={bedUtilizationData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { position: "top" },
                            title: { display: false },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: { display: true, text: "Number of Beds" },
                            },
                          },
                        }}
                      />
                    ) : (
                      <div className="empty-state" style={{ padding: "40px" }}>
                        <p>Add bed data to see utilization charts</p>
                      </div>
                    )}
                  </div>

                  {/* Patient Admission Trend Line Chart */}
                  <div
                    className="hospital-info-card"
                    style={{ padding: "20px" }}
                  >
                    <h3 style={{ marginBottom: "20px" }}>
                      📈 Patient Admission Trend (Last 7 Days)
                    </h3>
                    {patients.length > 0 ? (
                      <Line
                        data={patientAdmissionData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { position: "top" },
                            tooltip: { mode: "index", intersect: false },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: "Number of Admissions",
                              },
                              ticks: { stepSize: 1 },
                            },
                          },
                        }}
                      />
                    ) : (
                      <div className="empty-state" style={{ padding: "40px" }}>
                        <p>No patient admission data available</p>
                      </div>
                    )}
                  </div>

                  {/* Bed Occupancy Pie Chart */}
                  <div
                    className="hospital-info-card"
                    style={{ padding: "20px" }}
                  >
                    <h3 style={{ marginBottom: "20px" }}>
                      🥧 Bed Occupancy Distribution
                    </h3>
                    {Object.keys(bedData).length > 0 ? (
                      <div style={{ maxWidth: "400px", margin: "0 auto" }}>
                        <Doughnut
                          data={bedOccupancyPieData}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { position: "bottom" },
                              tooltip: {
                                callbacks: {
                                  label: (context) => {
                                    const label = context.label || "";
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce(
                                      (a, b) => a + b,
                                      0,
                                    );
                                    const percentage =
                                      total > 0
                                        ? ((value / total) * 100).toFixed(1)
                                        : 0;
                                    return `${label}: ${value} beds (${percentage}%)`;
                                  },
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: "40px" }}>
                        <p>No bed data available</p>
                      </div>
                    )}
                  </div>

                  {/* Appointment Status Pie Chart */}
                  <div
                    className="hospital-info-card"
                    style={{ padding: "20px" }}
                  >
                    <h3 style={{ marginBottom: "20px" }}>
                      📅 Appointment Status Distribution
                    </h3>
                    {appointments.length > 0 ? (
                      <div style={{ maxWidth: "400px", margin: "0 auto" }}>
                        <Pie
                          data={appointmentStatusData}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { position: "bottom" },
                              tooltip: {
                                callbacks: {
                                  label: (context) => {
                                    const label = context.label || "";
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce(
                                      (a, b) => a + b,
                                      0,
                                    );
                                    const percentage =
                                      total > 0
                                        ? ((value / total) * 100).toFixed(1)
                                        : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                  },
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: "40px" }}>
                        <p>No appointment data available</p>
                      </div>
                    )}
                  </div>

                  {/* Doctor Workload Bar Chart */}
                  <div
                    className="hospital-info-card"
                    style={{ padding: "20px", gridColumn: "span 2" }}
                  >
                    <h3 style={{ marginBottom: "20px" }}>
                      👨‍⚕️ Doctor Workload Distribution
                    </h3>
                    {doctors.length > 0 ? (
                      <Bar
                        data={doctorWorkloadData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { position: "top" },
                            title: { display: false },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: "Number of Patients Assigned",
                              },
                              ticks: { stepSize: 1 },
                            },
                          },
                        }}
                      />
                    ) : (
                      <div className="empty-state" style={{ padding: "40px" }}>
                        <p>No doctor data available</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Metrics Summary */}
                <div className="hospital-info-card" style={{ padding: "20px" }}>
                  <h3 style={{ marginBottom: "20px" }}>
                    📊 Key Performance Indicators
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "20px",
                    }}
                  >
                    <div className="info-item">
                      <strong>Bed Occupancy Rate</strong>
                      <span
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: "bold",
                          color: "#0d9488",
                        }}
                      >
                        {total > 0 ? ((occupied / total) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="info-item">
                      <strong>Doctor-Patient Ratio</strong>
                      <span
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: "bold",
                          color: "#0d9488",
                        }}
                      >
                        1:
                        {doctors.length > 0
                          ? (patients.length / doctors.length).toFixed(1)
                          : 0}
                      </span>
                    </div>
                    <div className="info-item">
                      <strong>Average Daily Admissions</strong>
                      <span
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: "bold",
                          color: "#0d9488",
                        }}
                      >
                        {(patients.length / 30).toFixed(1)}/day
                      </span>
                    </div>
                    <div className="info-item">
                      <strong>Appointment Completion Rate</strong>
                      <span
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: "bold",
                          color: "#0d9488",
                        }}
                      >
                        {appointments.length > 0
                          ? (
                              (appointments.filter(
                                (a) => a.status === "completed",
                              ).length /
                                appointments.length) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "bed-requests" && (
              <div>
                <div className="section-header">
                  <h2>
                    <span>🤖</span>
                    AI-Powered Bed Request Management
                  </h2>
                  <div className="section-actions">
                    <button
                      className="edit-beds-btn"
                      onClick={() => {
                        fetchBedRequests(hospitalId);
                      }}
                    >
                      <span>🔄</span>
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>
                <BedRequestManagement
                  hospitalId={hospitalId}
                  bedData={bedData}
                  onBedUpdate={handleBedUpdate}
                />
              </div>
            )}

            {activeSection === "patients" && (
              <div>
                <div className="section-header">
                  <h2>
                    <span>👥</span> Patient Management
                  </h2>
                  <div className="section-actions">
                    <button
                      className="edit-beds-btn"
                      onClick={() => {
                        setShowPatientForm(!showPatientForm);
                        setFormError("");
                        setFormSuccess("");
                      }}
                    >
                      <span>➕</span>
                      <span>
                        {showPatientForm ? "Cancel" : "Add New Patient"}
                      </span>
                    </button>
                  </div>
                </div>

                {showPatientForm && (
                  <div className="patient-form-container">
                    <h3 style={{ marginBottom: "20px", color: "#0d9488" }}>
                      Add New Patient
                    </h3>

                    {formError && (
                      <div
                        style={{
                          background: "#fee2e2",
                          color: "#991b1b",
                          padding: "12px",
                          borderRadius: "8px",
                          marginBottom: "20px",
                        }}
                      >
                        {typeof formError === "string"
                          ? formError
                          : "An error occurred"}
                      </div>
                    )}

                    {formSuccess && (
                      <div
                        style={{
                          background: "#d1fae5",
                          color: "#065f46",
                          padding: "12px",
                          borderRadius: "8px",
                          marginBottom: "20px",
                        }}
                      >
                        {typeof formSuccess === "string"
                          ? formSuccess
                          : "Success"}
                      </div>
                    )}

                    <div className="form-grid">
                      <div className="form-group">
                        <label>Patient Name *</label>
                        <input
                          type="text"
                          name="name"
                          value={newPatient.name}
                          onChange={handlePatientInputChange}
                          placeholder="Enter patient name"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Age *</label>
                        <input
                          type="number"
                          name="age"
                          value={newPatient.age}
                          onChange={handlePatientInputChange}
                          placeholder="Enter age"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Gender *</label>
                        <select
                          name="gender"
                          value={newPatient.gender}
                          onChange={handlePatientInputChange}
                          required
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Blood Group</label>
                        <select
                          name="bloodGroup"
                          value={newPatient.bloodGroup}
                          onChange={handlePatientInputChange}
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
                        <label>Contact Number *</label>
                        <input
                          type="text"
                          name="contact"
                          value={newPatient.contact}
                          onChange={handlePatientInputChange}
                          placeholder="Enter contact number"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Emergency Contact</label>
                        <input
                          type="text"
                          name="emergencyContact"
                          value={newPatient.emergencyContact}
                          onChange={handlePatientInputChange}
                          placeholder="Enter emergency contact"
                        />
                      </div>
                      <div className="form-group">
                        <label>Address</label>
                        <input
                          type="text"
                          name="address"
                          value={newPatient.address}
                          onChange={handlePatientInputChange}
                          placeholder="Enter address"
                        />
                      </div>
                      <div className="form-group">
                        <label>Bed Type</label>
                        <select
                          name="bedType"
                          value={newPatient.bedType}
                          onChange={handlePatientInputChange}
                        >
                          <option value="">Select Bed Type</option>
                          {Object.keys(bedData).map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Bed ID (Optional)</label>
                        <select
                          name="bedId"
                          value={newPatient.bedId}
                          onChange={handlePatientInputChange}
                          disabled={!newPatient.bedType}
                        >
                          <option value="">Select Specific Bed</option>
                          {bedsList
                            .filter(
                              (bed) =>
                                bed.type === newPatient.bedType &&
                                bed.status === "available",
                            )
                            .map((bed) => (
                              <option key={bed.id} value={bed.id}>
                                {bed.bedId} (Room {bed.roomNumber}, Floor{" "}
                                {bed.floor})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Assign Doctor</label>
                        <select
                          name="doctorAssigned"
                          value={newPatient.doctorAssigned}
                          onChange={handlePatientInputChange}
                        >
                          <option value="">Select Doctor</option>
                          {doctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.name}>
                              {doctor.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Admission Date</label>
                        <input
                          type="date"
                          name="admissionDate"
                          value={newPatient.admissionDate}
                          onChange={handlePatientInputChange}
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Medical History</label>
                        <textarea
                          name="medicalHistory"
                          value={newPatient.medicalHistory}
                          onChange={handlePatientInputChange}
                          placeholder="Enter medical history, allergies, current medications..."
                          rows="3"
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button
                        className="cancel-btn"
                        onClick={() => setShowPatientForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="submit-btn"
                        onClick={handleAddPatient}
                        disabled={formSubmitting}
                      >
                        {formSubmitting ? "Adding..." : "Add Patient"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="patients-grid">
                  {patients.map((patient) => (
                    <div key={patient.id} className="patient-card">
                      <div className="patient-header">
                        <div className="patient-avatar">
                          {patient.name?.charAt(0) || "P"}
                        </div>
                        <div className="patient-info">
                          <h3>{patient.name}</h3>
                          <p>
                            <span>🆔 {patient.patientId || patient.id}</span> |
                            <span>
                              {" "}
                              {patient.age} yrs | {patient.gender}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="patient-details">
                        <div className="patient-detail-item">
                          <span className="label">Blood Group</span>
                          <span
                            className="value"
                            style={{ color: "#ef4444", fontWeight: "bold" }}
                          >
                            {patient.bloodGroup || "N/A"}
                          </span>
                        </div>
                        <div className="patient-detail-item">
                          <span className="label">Contact</span>
                          <span className="value">
                            {patient.contact || "N/A"}
                          </span>
                        </div>
                        <div className="patient-detail-item">
                          <span className="label">Admission</span>
                          <span className="value">
                            {patient.admissionDate
                              ? formatDate(patient.admissionDate)
                              : "N/A"}
                          </span>
                        </div>
                        <div className="patient-detail-item">
                          <span className="label">Bed</span>
                          <span className="value" style={{ fontWeight: "600" }}>
                            {patient.bedNumber ||
                              patient.bedType ||
                              "Not assigned"}
                          </span>
                        </div>
                        <div className="patient-detail-item full-width">
                          <span className="label">Doctor</span>
                          <span className="value" style={{ color: "#0d9488" }}>
                            {patient.doctorAssigned || "Not assigned"}
                          </span>
                        </div>
                      </div>

                      <div className="patient-actions">
                        <button className="patient-action-btn view-btn">
                          <span>👁️</span> View
                        </button>
                        <button className="patient-action-btn edit-btn">
                          <span>✏️</span> Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "doctors" && (
              <div>
                <div className="section-header">
                  <h2>
                    <span>👨‍⚕️</span> Doctor Management
                  </h2>
                  <div className="section-actions">
                    <button
                      className="edit-beds-btn"
                      onClick={() => {
                        setShowDoctorForm(!showDoctorForm);
                        setFormError("");
                        setFormSuccess("");
                      }}
                    >
                      <span>➕</span>
                      <span>
                        {showDoctorForm ? "Cancel" : "Add New Doctor"}
                      </span>
                    </button>
                  </div>
                </div>

                {showDoctorForm && (
                  <div className="doctor-form-container">
                    <h3 style={{ marginBottom: "20px", color: "#0d9488" }}>
                      Add New Doctor
                    </h3>

                    {formError && (
                      <div
                        style={{
                          background: "#fee2e2",
                          color: "#991b1b",
                          padding: "12px",
                          borderRadius: "8px",
                          marginBottom: "20px",
                        }}
                      >
                        {typeof formError === "string"
                          ? formError
                          : "An error occurred"}
                      </div>
                    )}

                    {formSuccess && (
                      <div
                        style={{
                          background: "#d1fae5",
                          color: "#065f46",
                          padding: "12px",
                          borderRadius: "8px",
                          marginBottom: "20px",
                        }}
                      >
                        {typeof formSuccess === "string"
                          ? formSuccess
                          : "Success"}
                      </div>
                    )}

                    <div className="form-grid">
                      <div className="form-group">
                        <label>Doctor Name *</label>
                        <input
                          type="text"
                          name="name"
                          value={newDoctor.name}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter doctor name"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Specialization *</label>
                        <input
                          type="text"
                          name="specialization"
                          value={newDoctor.specialization}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter specialization"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Qualification</label>
                        <input
                          type="text"
                          name="qualification"
                          value={newDoctor.qualification}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter qualification"
                        />
                      </div>
                      <div className="form-group">
                        <label>Experience (years)</label>
                        <input
                          type="number"
                          name="experience"
                          value={newDoctor.experience}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter experience"
                        />
                      </div>
                      <div className="form-group">
                        <label>Contact Number *</label>
                        <input
                          type="text"
                          name="contact"
                          value={newDoctor.contact}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter contact number"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          name="email"
                          value={newDoctor.email}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter email"
                        />
                      </div>
                      <div className="form-group">
                        <label>Address</label>
                        <input
                          type="text"
                          name="address"
                          value={newDoctor.address}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter address"
                        />
                      </div>
                      <div className="form-group">
                        <label>Department</label>
                        <input
                          type="text"
                          name="department"
                          value={newDoctor.department}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter department"
                        />
                      </div>
                      <div className="form-group">
                        <label>Consultation Fee (₹)</label>
                        <input
                          type="number"
                          name="consultationFee"
                          value={newDoctor.consultationFee}
                          onChange={handleDoctorInputChange}
                          placeholder="Enter consultation fee"
                        />
                      </div>
                      <div className="form-group">
                        <label>Availability</label>
                        <select
                          name="availability"
                          value={newDoctor.availability}
                          onChange={handleDoctorInputChange}
                        >
                          <option value="available">Available</option>
                          <option value="busy">Busy</option>
                          <option value="on-leave">On Leave</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Joining Date</label>
                        <input
                          type="date"
                          name="joiningDate"
                          value={newDoctor.joiningDate}
                          onChange={handleDoctorInputChange}
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button
                        className="cancel-btn"
                        onClick={() => setShowDoctorForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="submit-btn"
                        onClick={handleAddDoctor}
                        disabled={formSubmitting}
                      >
                        {formSubmitting ? "Adding..." : "Add Doctor"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="doctors-grid">
                  {doctors.map((doctor) => (
                    <div key={doctor.id} className="doctor-card">
                      <div className="doctor-avatar">
                        {doctor.name?.split(" ")[1]?.charAt(0) ||
                          doctor.name?.charAt(0) ||
                          "D"}
                      </div>
                      <h3>{doctor.name}</h3>
                      <div className="doctor-specialty">
                        {doctor.specialization}
                      </div>

                      <div className="doctor-stats">
                        <div className="doctor-stat">
                          <div className="number">{doctor.experience}</div>
                          <div className="label">Years Exp</div>
                        </div>
                        <div className="doctor-stat">
                          <div className="number">
                            {doctor.patientsCount || 0}
                          </div>
                          <div className="label">Patients</div>
                        </div>
                        <div className="doctor-stat">
                          <div className="number">{doctor.rating || "4.5"}</div>
                          <div className="label">Rating</div>
                        </div>
                      </div>

                      <div className="doctor-contact">
                        <div className="doctor-contact-item">
                          <span>📞</span> {doctor.contact}
                        </div>
                        <div className="doctor-contact-item">
                          <span>✉️</span> {doctor.email}
                        </div>
                        <div className="doctor-contact-item">
                          <span>💰</span> ₹{doctor.consultationFee}/-
                        </div>
                        {doctor.joiningDate && (
                          <div className="doctor-contact-item">
                            <span>📅</span> Joined:{" "}
                            {formatDate(doctor.joiningDate)}
                          </div>
                        )}
                      </div>

                      <div
                        className={`doctor-availability availability-${doctor.availability}`}
                      >
                        {doctor.availability === "available" && "🟢 Available"}
                        {doctor.availability === "busy" && "🟡 Busy"}
                        {doctor.availability === "on-leave" && "🔴 On Leave"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "appointments" && (
              <div>
                <div className="section-header">
                  <h2>
                    <span>📅</span> Appointment Management
                  </h2>
                  <div className="section-actions">
                    <button
                      className="edit-beds-btn"
                      onClick={() => {
                        setShowAppointmentForm(!showAppointmentForm);
                        setFormError("");
                        setFormSuccess("");
                      }}
                    >
                      <span>➕</span>
                      <span>
                        {showAppointmentForm ? "Cancel" : "New Appointment"}
                      </span>
                    </button>
                  </div>
                </div>

                {showAppointmentForm && (
                  <div className="appointment-form-container">
                    <h3 style={{ marginBottom: "20px", color: "#0d9488" }}>
                      Schedule New Appointment
                    </h3>

                    {formError && (
                      <div
                        style={{
                          background: "#fee2e2",
                          color: "#991b1b",
                          padding: "12px",
                          borderRadius: "8px",
                          marginBottom: "20px",
                        }}
                      >
                        {typeof formError === "string"
                          ? formError
                          : "An error occurred"}
                      </div>
                    )}

                    {formSuccess && (
                      <div
                        style={{
                          background: "#d1fae5",
                          color: "#065f46",
                          padding: "12px",
                          borderRadius: "8px",
                          marginBottom: "20px",
                        }}
                      >
                        {typeof formSuccess === "string"
                          ? formSuccess
                          : "Success"}
                      </div>
                    )}

                    <div className="form-grid">
                      <div className="form-group">
                        <label>Patient Name *</label>
                        <select
                          name="patientName"
                          value={newAppointment.patientName}
                          onChange={handleAppointmentInputChange}
                          required
                        >
                          <option value="">Select Patient</option>
                          {patients.map((patient) => (
                            <option key={patient.id} value={patient.name}>
                              {patient.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Doctor *</label>
                        <select
                          name="doctorName"
                          value={newAppointment.doctorName}
                          onChange={handleAppointmentInputChange}
                          required
                        >
                          <option value="">Select Doctor</option>
                          {doctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.name}>
                              {doctor.name} - {doctor.specialization}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Appointment Date *</label>
                        <input
                          type="date"
                          name="date"
                          value={newAppointment.date}
                          onChange={handleAppointmentInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Appointment Time *</label>
                        <input
                          type="time"
                          name="time"
                          value={newAppointment.time}
                          onChange={handleAppointmentInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Appointment Type</label>
                        <select
                          name="type"
                          value={newAppointment.type}
                          onChange={handleAppointmentInputChange}
                        >
                          <option value="consultation">Consultation</option>
                          <option value="follow-up">Follow-up</option>
                          <option value="surgery">Surgery</option>
                          <option value="checkup">Regular Checkup</option>
                          <option value="emergency">Emergency</option>
                        </select>
                      </div>
                      <div className="form-group full-width">
                        <label>Notes</label>
                        <textarea
                          name="notes"
                          value={newAppointment.notes}
                          onChange={handleAppointmentInputChange}
                          placeholder="Enter any special notes or requirements..."
                          rows="3"
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button
                        className="cancel-btn"
                        onClick={() => setShowAppointmentForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="submit-btn"
                        onClick={handleAddAppointment}
                        disabled={formSubmitting}
                      >
                        {formSubmitting
                          ? "Scheduling..."
                          : "Schedule Appointment"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="appointments-container">
                  <div className="appointments-filters">
                    <button className="filter-btn active">All</button>
                    <button className="filter-btn">Today</button>
                    <button className="filter-btn">Upcoming</button>
                    <button className="filter-btn">Completed</button>
                  </div>

                  <div className="table-container">
                    <table className="appointments-table">
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Doctor</th>
                          <th>Date & Time</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((appointment) => (
                          <tr key={appointment.id}>
                            <td>
                              <strong>{appointment.patientName}</strong>
                              <br />
                              <small style={{ color: "#64748b" }}>
                                ID: {appointment.patientId}
                              </small>
                            </td>
                            <td>
                              <strong>{appointment.doctorName}</strong>
                            </td>
                            <td>
                              {formatDate(appointment.date)} <br />
                              <span
                                style={{ fontWeight: "600", color: "#0d9488" }}
                              >
                                {appointment.time}
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  padding: "4px 8px",
                                  background: "#f0f9ff",
                                  borderRadius: "12px",
                                  fontSize: "0.85rem",
                                }}
                              >
                                {appointment.type}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`appointment-status status-${appointment.status}`}
                              >
                                {appointment.status}
                              </span>
                            </td>
                            <td>
                              <button
                                className="view-btn"
                                style={{
                                  padding: "6px 12px",
                                  marginRight: "5px",
                                }}
                              >
                                👁️
                              </button>
                              <button
                                className="edit-btn"
                                style={{ padding: "6px 12px" }}
                              >
                                ✏️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "beds" && (
              <div className="empty-state" style={{ padding: "60px 20px" }}>
                <div className="empty-state-icon" style={{ fontSize: "4rem" }}>
                  🛏️
                </div>
                <h3>Bed Management</h3>
                <p>Click the button below to manage bed configurations</p>
                <button
                  className="edit-beds-btn"
                  onClick={() => {
                    const url = generateEncryptedBedUrl();
                    if (url.startsWith("#")) {
                      window.open(
                        window.location.origin + window.location.pathname + url,
                        "_blank",
                      );
                    } else {
                      window.open(url, "_blank");
                    }
                  }}
                  style={{ marginTop: "20px" }}
                >
                  <span>✏️</span>
                  <span>Edit Beds</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <LogoComponent isFloating={true} />
    </div>
  );
};

export default HospitalDashboard;
