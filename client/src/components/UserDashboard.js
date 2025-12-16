import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { eventsAPI } from '../services/api';
import EventCard from './EventCard';
import './UserDashboard.css';

const UserDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('attending'); // 'attending' or 'created'
  const [attendingEvents, setAttendingEvents] = useState([]);
  const [createdEvents, setCreatedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <div className="user-dashboard-container">
        <div className="loading">Loading your events...</div>
      </div>
    );
  }

  const currentEvents = activeTab === 'attending' ? attendingEvents : createdEvents;

  return (
    <div className="user-dashboard-container">
      <div className="dashboard-header">
        <h1>My Dashboard</h1>
        <p className="welcome-text">Welcome back, {user?.name}!</p>
      </div>

      <div className="tabs">
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
        <div className="events-grid">
          {currentEvents.map((event) => (
            <EventCard key={event._id} event={event} onUpdate={refreshEvents} />
          ))}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
