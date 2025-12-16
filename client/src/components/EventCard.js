import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventsAPI } from '../services/api';
import './EventCard.css';

const EventCard = ({ event, onUpdate }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cardRef = useRef(null);
  const imageRef = useRef(null);

  const isCreator = user && String(event.createdBy?._id || event.createdBy) === String(user.id);
  const isAttending = user && event.attendees?.some(a => String(a) === String(user.id));
  const isFull = (event.attendeeCount || event.attendees?.length || 0) >= event.capacity;
  const canRSVP = user && !isCreator && !isAttending && !isFull;

  // Get image source from base64 data stored in MongoDB
  const getImageSrc = () => {
    if (event.imageData) {
      return `data:${event.imageContentType || 'image/jpeg'};base64,${event.imageData}`;
    }
    // Fallback for old imageUrl format (if any existing data)
    if (event.imageUrl) {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      return `${API_URL}${event.imageUrl}`;
    }
    return null;
  };

  const handleRSVP = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await eventsAPI.rsvp(event._id);
      onUpdate();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to RSVP');
    }
  };

  const handleUnRSVP = async () => {
    try {
      await eventsAPI.unrsvp(event._id);
      onUpdate();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to cancel RSVP');
    }
  };

  const handleEdit = () => {
    navigate(`/edit-event/${event._id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      await eventsAPI.delete(event._id);
      onUpdate();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete event');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const imageSrc = getImageSrc();

  useEffect(() => {
    if (cardRef.current) {
      // Entrance animation
      gsap.fromTo(cardRef.current,
        { opacity: 0, y: 20, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power2.out" }
      );

      // Hover animations
      const card = cardRef.current;
      const handleMouseEnter = () => {
        gsap.to(card, {
          y: -5,
          scale: 1.02,
          duration: 0.3,
          ease: "power2.out",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
        });
        if (imageRef.current) {
          gsap.to(imageRef.current, {
            scale: 1.1,
            duration: 0.3,
            ease: "power2.out"
          });
        }
      };

      const handleMouseLeave = () => {
        gsap.to(card, {
          y: 0,
          scale: 1,
          duration: 0.3,
          ease: "power2.out",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
        });
        if (imageRef.current) {
          gsap.to(imageRef.current, {
            scale: 1,
            duration: 0.3,
            ease: "power2.out"
          });
        }
      };

      card.addEventListener('mouseenter', handleMouseEnter);
      card.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        card.removeEventListener('mouseenter', handleMouseEnter);
        card.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, []);

  return (
    <div className="event-card" ref={cardRef}>
      {imageSrc && (
        <div className="event-image">
          <img src={imageSrc} alt={event.title} ref={imageRef} />
        </div>
      )}
      <div className="event-content">
        <h3 className="event-title">{event.title}</h3>
        <p className="event-description">{event.description}</p>
        <div className="event-details">
          <div className="event-detail-item">
            <span className="detail-icon">Date:</span>
            <span>{formatDate(event.dateTime)}</span>
          </div>
          <div className="event-detail-item">
            <span className="detail-icon">Location:</span>
            <span>{event.location}</span>
          </div>
          <div className="event-detail-item">
            <span className="detail-icon">Attendees:</span>
            <span>
              {event.attendeeCount || event.attendees?.length || 0} / {event.capacity}
            </span>
          </div>
        </div>
        <div className="event-actions">
          {isCreator ? (
            <>
              <button onClick={handleEdit} className="btn-edit">
                Edit
              </button>
              <button onClick={handleDelete} className="btn-delete">
                Delete
              </button>
            </>
          ) : (
            <>
              {isAttending ? (
                <button onClick={handleUnRSVP} className="btn-unrsvp">
                  Cancel RSVP
                </button>
              ) : canRSVP ? (
                <button onClick={handleRSVP} className="btn-rsvp">
                  RSVP
                </button>
              ) : isFull ? (
                <button disabled className="btn-disabled">
                  Event Full
                </button>
              ) : (
                <button onClick={() => navigate('/login')} className="btn-rsvp">
                  Login to RSVP
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCard;

