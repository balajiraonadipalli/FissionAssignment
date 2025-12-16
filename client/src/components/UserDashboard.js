import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useAuth } from '../context/AuthContext';
import { eventsAPI } from '../services/api';
import EventCard from './EventCard';
import LoadingSpinner from './LoadingSpinner';
import './UserDashboard.css';

const UserDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('attending'); // 'attending' or 'created'
  const [attendingEvents, setAttendingEvents] = useState([]);
  const [createdEvents, setCreatedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const headerRef = useRef(null);
  const tabsRef = useRef(null);
  const eventsGridRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const [attending, created] = await Promise.all([
        eventsAPI.getAttending(),
        eventsAPI.getMyEvents(),
      ]);
      setAttendingEvents(attending.data);
      setCreatedEvents(created.data);
      setError('');
      
      // Animate events after loading
      if (eventsGridRef.current) {
        const cards = eventsGridRef.current.children;
        gsap.fromTo(cards,
          { opacity: 0, y: 30, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: "power2.out" }
        );
      }
    } catch (err) {
      setError('Failed to load events. Please try again.');
      console.error('Error fetching user events:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshEvents = () => {
    fetchEvents();
  };

  useEffect(() => {
    if (!loading && headerRef.current && tabsRef.current) {
      gsap.fromTo(headerRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }
      );
      gsap.fromTo(tabsRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.2, ease: "power2.out" }
      );
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="user-dashboard-container">
        <LoadingSpinner message="Loading your events..." />
      </div>
    );
  }

  const currentEvents = activeTab === 'attending' ? attendingEvents : createdEvents;

  return (
    <div className="user-dashboard-container">
      <div className="dashboard-header" ref={headerRef}>
        <h1>My Dashboard</h1>
        <p className="welcome-text">Welcome back, {user?.name}!</p>
      </div>

      <div className="tabs" ref={tabsRef}>
        <button
          className={`tab ${activeTab === 'attending' ? 'active' : ''}`}
          onClick={() => setActiveTab('attending')}
        >
          Events I'm Attending ({attendingEvents.length})
        </button>
        <button
          className={`tab ${activeTab === 'created' ? 'active' : ''}`}
          onClick={() => setActiveTab('created')}
        >
          Events I Created ({createdEvents.length})
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {currentEvents.length === 0 ? (
        <div className="empty-state">
          {activeTab === 'attending' ? (
            <div>
              <p>You're not attending any events yet.</p>
              <p>Browse events and RSVP to join!</p>
            </div>
          ) : (
            <div>
              <p>You haven't created any events yet.</p>
              <p>Create your first event to get started!</p>
            </div>
          )}
        </div>
      ) : (
        <div className="events-grid" ref={eventsGridRef}>
          {currentEvents.map((event) => (
            <EventCard key={event._id} event={event} onUpdate={refreshEvents} />
          ))}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
