import React from 'react';
import './VideoSection.css';

const VideoSection = () => {
  return (
    <section className="video-section">
      <h2>Learn More About Us</h2>
      <div className="video-container">
        <video controls>
          <source src="https://youtu.be/1gikvJwXueI?si=-3LYZktAMs2hlgI4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="video-description">
          <p>Watch this video to know more about SwasthyaSetu and how we are revolutionizing healthcare accessibility.</p>
        </div>
      </div>
    </section>
  );
};

export default VideoSection;