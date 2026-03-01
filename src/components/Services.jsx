import React, { useState,useEffect  } from 'react';
import './Services.css';

const Services = () => {
  const services = [
    {
      id: 1,
      title: "Telemedicine",
      description: "Get expert consultations and prescriptions online.",
      icon: "/images/telemed-removebg-preview.png"
    },
    {
      id: 2,
      title: "Financial Aid",
      description: "Apply for assistance to cover your healthcare costs.",
      icon: "/images/aid.png"
    },
    {
      id: 3,
      title: "Lab test",
      description: "Facilitate at-home collection of samples and deliver test results digitally.",
      icon: "/images/labtest.png"
    },
    {
      id: 4,
      title: "Government Scheme",
      description: "Helps users navigate government health schemes, insurance, or subsidies for treatment.",
      icon: "/images/scheme.png"
    },
    {
      id: 5,
      title: "Integrated NGO'S",
      description: "Integration with NGOs to organize health camps.",
      icon: "/images/ngo (2).png"
    }
  ];

  const [activeCard, setActiveCard] = useState(null);
  const [loadedImages, setLoadedImages] = useState({});
  const [imagesPreloaded, setImagesPreloaded] = useState(false);

  // Preload images on component mount
  useEffect(() => {
    const preloadImages = () => {
      const imagePromises = services.map(service => {
        return new Promise((resolve, reject) => {
          if (!service.icon || !service.icon.trim()) {
            resolve();
            return;
          }
          
          const img = new Image();
          img.src = service.icon;
          img.onload = () => {
            setLoadedImages(prev => ({ ...prev, [service.id]: true }));
            resolve();
          };
          img.onerror = () => {
            setLoadedImages(prev => ({ ...prev, [service.id]: false }));
            resolve(); // Resolve anyway to continue
          };
        });
      });

      Promise.all(imagePromises)
        .then(() => setImagesPreloaded(true))
        .catch(() => setImagesPreloaded(true));
    };

    preloadImages();
  }, []);



  const handleImageLoad = (id) => {
    setLoadedImages(prev => ({ ...prev, [id]: true }));
  };

  const handleImageError = (id) => {
    setLoadedImages(prev => ({ ...prev, [id]: false }));
  };

  return (
    <section id="services" className="services">
      <div className="services-header">
        <h2>Our Services</h2>
        <div className="header-line"></div>
      </div>
      
      <div className="services-container">
        {services.map((service, index) => (
          <div 
            className={`service-card card-${index + 1} ${activeCard === service.id ? 'active' : ''}`}
            key={service.id}
            onMouseEnter={() => setActiveCard(service.id)}
            onMouseLeave={() => setActiveCard(null)}
            style={{
              '--card-index': index
            }}
          >
            <div className="card-inner">
              <div className="card-icon">
                {service.icon && service.icon.trim() ? (
                  <>
                    <img 
                      src={service.icon}
                      alt={service.title}
                      className={`${loadedImages[service.id] ? 'loaded' : 'loading'}`}
                      onLoad={() => handleImageLoad(service.id)}
                      onError={() => handleImageError(service.id)}
                      // Only use lazy loading if images aren't preloaded
                      loading={imagesPreloaded ? "eager" : "lazy"}
                      style={{ 
                        opacity: loadedImages[service.id] ? 1 : 0,
                        transition: 'opacity 0.3s ease'
                      }}
                    />
                    {!loadedImages[service.id] && (
                      <div className="icon-placeholder">
                        {/* Optional: Add a loading spinner or skeleton */}
                        <div className="loading-spinner"></div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="icon-placeholder"></div>
                )}
              </div>
              
              <div className="card-content">
                <h3 className="card-title">{service.title}</h3>
                <p className="card-description">{service.description}</p>
              </div>
            </div>
            
            <div className="card-glow"></div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Services;