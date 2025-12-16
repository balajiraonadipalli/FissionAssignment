import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gsap } from 'gsap';
import { eventsAPI } from '../services/api';
import EventCard from './EventCard';
import LoadingSpinner from './LoadingSpinner';
import './Dashboard.css';

const Dashboard = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const categories = ['All', 'General', 'Technology', 'Business', 'Education', 'Entertainment', 'Sports', 'Networking', 'Other'];
  const headerRef = useRef(null);
  const filtersRef = useRef(null);
  const eventsGridRef = useRef(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (searchTerm) filters.search = searchTerm;
      if (category && category !== 'All') filters.category = category;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      const response = await eventsAPI.getAll(filters);
      setEvents(response.data);
      setError('');
      
      // Animate events grid after data loads
      if (eventsGridRef.current) {
        const cards = eventsGridRef.current.children;
        gsap.fromTo(cards, 
          { 
            opacity: 0, 
            y: 30,
            scale: 0.9
          },
          { 
            opacity: 1, 
            y: 0,
            scale: 1,
            duration: 0.5,
            stagger: 0.1,
            ease: "power2.out"
          }
        );
      }
    } catch (err) {
      setError('Failed to load events. Please try again.');
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }, [category, startDate, endDate, searchTerm]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchEvents();
    }, searchTerm ? 500 : 0); // Debounce search only, immediate for other filters

    return () => clearTimeout(timeoutId);
  }, [fetchEvents]);

  // Initial page load animations
  useEffect(() => {
    if (!loading && headerRef.current && filtersRef.current) {
      gsap.fromTo(headerRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }
      );
      gsap.fromTo(filtersRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.2, ease: "power2.out" }
      );
    }
  }, [loading]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setCategory('All');
    setStartDate('');
    setEndDate('');
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <LoadingSpinner message="Loading events..." />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header" ref={headerRef}>
        <h1>Upcoming Events</h1>
        <div className="filters-section" ref={filtersRef}>
          <div className="search-container">
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-row">
            <div className="filter-group">
              <label>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="filter-select"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="filter-input"
              />
            </div>

            <div className="filter-group">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="filter-input"
              />
            </div>

            <button onClick={handleClearFilters} className="btn-clear-filters">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {events.length === 0 ? (
        <div className="empty-state">
          {searchTerm || category !== 'All' || startDate || endDate ? (
            <p>No events found matching your filters.</p>
          ) : (
            <p>No upcoming events. Be the first to create one!</p>
          )}
        </div>
      ) : (
        <div className="events-grid" ref={eventsGridRef}>
          {events.map((event) => (
            <EventCard key={event._id} event={event} onUpdate={fetchEvents} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
