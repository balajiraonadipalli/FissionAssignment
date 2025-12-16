import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, aiAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import './EventForm.css';

const EventForm = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dateTime: '',
    location: '',
    capacity: '',
    category: 'General',
    image: null,
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const formCardRef = useRef(null);
  const formFieldsRef = useRef(null);

  const categories = ['General', 'Technology', 'Business', 'Education', 'Entertainment', 'Sports', 'Networking', 'Other'];

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (isEdit) {
      fetchEvent();
    }

    // Form entrance animation
    if (formCardRef.current && formFieldsRef.current) {
      gsap.fromTo(formCardRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power2.out" }
      );
      gsap.fromTo(formFieldsRef.current.children,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.08, delay: 0.2, ease: "power2.out" }
      );
    }
  }, [id, user, navigate, isEdit]);

  const fetchEvent = async () => {
    try {
      const response = await eventsAPI.getById(id);
      const event = response.data;
      setFormData({
        title: event.title || '',
        description: event.description || '',
        dateTime: event.dateTime ? new Date(event.dateTime).toISOString().slice(0, 16) : '',
        location: event.location || '',
        capacity: event.capacity || '',
        category: event.category || 'General',
      });
      if (event.imageData) {
        setPreviewImage(`data:${event.imageContentType || 'image/jpeg'};base64,${event.imageData}`);
      } else if (event.imageUrl) {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        setPreviewImage(`${API_URL}${event.imageUrl}`);
      }
    } catch (err) {
      setError('Failed to load event');
      console.error('Error fetching event:', err);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length < 3) {
      errors.title = 'Title must be at least 3 characters';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      errors.description = 'Description must be at least 10 characters';
    }
    
    if (!formData.dateTime) {
      errors.dateTime = 'Date and time is required';
    } else {
      const selectedDate = new Date(formData.dateTime);
      const now = new Date();
      if (selectedDate < now) {
        errors.dateTime = 'Event date must be in the future';
      }
    }
    
    if (!formData.location.trim()) {
      errors.location = 'Location is required';
    }
    
    if (!formData.capacity) {
      errors.capacity = 'Capacity is required';
    } else if (parseInt(formData.capacity) < 1) {
      errors.capacity = 'Capacity must be at least 1';
    } else if (parseInt(formData.capacity) > 10000) {
      errors.capacity = 'Capacity cannot exceed 10,000';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      setFormData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleGenerateDescription = async () => {
    if (!formData.title.trim()) {
      setError('Please enter a title first to generate description');
      return;
    }

    try {
      setGeneratingDescription(true);
      setError('');
      const response = await aiAPI.generateDescription({
        title: formData.title,
        category: formData.category,
        location: formData.location,
        dateTime: formData.dateTime,
      });
      setFormData((prev) => ({ ...prev, description: response.data.description }));
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to generate description');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      setError('Please fix the validation errors');
      return;
    }

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('title', formData.title.trim());
      submitData.append('description', formData.description.trim());
      submitData.append('dateTime', formData.dateTime);
      submitData.append('location', formData.location.trim());
      submitData.append('capacity', formData.capacity);
      submitData.append('category', formData.category);
      if (formData.image) {
        submitData.append('image', formData.image);
      }

      if (isEdit) {
        await eventsAPI.update(id, submitData);
      } else {
        await eventsAPI.create(submitData);
      }

      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !isEdit) {
    return (
      <div className="form-container">
        <LoadingSpinner message={isEdit ? "Updating event..." : "Creating event..."} />
      </div>
    );
  }

  return (
    <div className="form-container">
      <div className="form-card" ref={formCardRef}>
        <h2>{isEdit ? 'Edit Event' : 'Create New Event'}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} ref={formFieldsRef}>
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Event title"
              className={validationErrors.title ? 'error' : ''}
            />
            {validationErrors.title && (
              <span className="field-error">{validationErrors.title}</span>
            )}
          </div>

          <div className="form-group">
            <label>Description *</label>
            <div className="description-group">
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="4"
                placeholder="Event description"
                className={validationErrors.description ? 'error' : ''}
              />
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={generatingDescription || !formData.title.trim()}
                className="btn-ai-generate"
                title="Generate description using AI"
              >
                {generatingDescription ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
            {validationErrors.description && (
              <span className="field-error">{validationErrors.description}</span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date & Time *</label>
              <input
                type="datetime-local"
                name="dateTime"
                value={formData.dateTime}
                onChange={handleChange}
                required
                className={validationErrors.dateTime ? 'error' : ''}
              />
              {validationErrors.dateTime && (
                <span className="field-error">{validationErrors.dateTime}</span>
              )}
            </div>

            <div className="form-group">
              <label>Capacity *</label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                required
                min="1"
                max="10000"
                placeholder="Max attendees"
                className={validationErrors.capacity ? 'error' : ''}
              />
              {validationErrors.capacity && (
                <span className="field-error">{validationErrors.capacity}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Location *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                placeholder="Event location"
                className={validationErrors.location ? 'error' : ''}
              />
              {validationErrors.location && (
                <span className="field-error">{validationErrors.location}</span>
              )}
            </div>

            <div className="form-group">
              <label>Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="filter-select"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Event Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="file-input"
            />
            {previewImage && (
              <div className="image-preview">
                <img src={previewImage} alt="Preview" />
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventForm;
