import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

// Events API
export const eventsAPI = {
  getAll: (filters) => {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'All') params.append('category', filters.category);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.search) params.append('search', filters.search);
    const queryString = params.toString();
    return api.get(`/events${queryString ? `?${queryString}` : ''}`);
  },
  getById: (id) => api.get(`/events/${id}`),
  getMyEvents: () => api.get('/events/my-events'),
  getAttending: () => api.get('/events/attending'),
  create: (formData) => {
    // Get token and add to headers
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    // Don't set Content-Type - let axios set it with boundary for FormData
    return api.post('/events', formData, { headers });
  },
  update: (id, formData) => {
    // Get token and add to headers
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    // Don't set Content-Type - let axios set it with boundary for FormData
    return api.put(`/events/${id}`, formData, { headers });
  },
  delete: (id) => api.delete(`/events/${id}`),
  rsvp: (id) => api.post(`/events/${id}/rsvp`),
  unrsvp: (id) => api.post(`/events/${id}/unrsvp`),
};

// AI API - Direct call to Gemini from frontend
export const aiAPI = {
  generateDescription: async (data) => {
    const { title, category, location, dateTime } = data;
    const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
    
    // Debug: Check if API key is loaded (remove in production)
    console.log('API Key loaded:', API_KEY ? 'Yes (length: ' + API_KEY.length + ')' : 'No');
    
    if (!API_KEY) {
      throw new Error('Gemini API key not configured. Please restart the React development server after adding REACT_APP_GEMINI_API_KEY to .env');
    }

    if (!title) {
      throw new Error('Title is required');
    }

    // Prepare the prompt
    const dateText = dateTime ? new Date(dateTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }) : "";

    const prompt = `Generate a compelling and engaging event description for the following event:

Title: ${title}
${category ? `Category: ${category}` : ''}
${location ? `Location: ${location}` : ''}
${dateText ? `Date & Time: ${dateText}` : ''}

Please create a professional, engaging event description that:
- Is between 100-200 words
- Highlights the key aspects of the event
- Makes it appealing to potential attendees
- Includes relevant details about what attendees can expect
- Uses an enthusiastic but professional tone

Generate only the description text, without any additional formatting or labels.`;

    // Try multiple models in order
    const modelsToTry = [
      "gemini-flash-latest",
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-pro-latest"
    ];

    for (const modelName of modelsToTry) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }]
          })
        });

        const result = await response.json();

        if (response.ok) {
          const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            return { data: { description: generatedText.trim() } };
          }
        } else {
          // If quota exceeded, try next model
          if (result.error?.message?.includes("quota") || result.error?.message?.includes("Quota exceeded")) {
            console.log(`Quota exceeded for ${modelName}, trying next model...`);
            continue;
          }
          // For other errors, throw immediately
          throw new Error(result.error?.message || 'Failed to generate description');
        }
      } catch (error) {
        if (error.message.includes('quota') || error.message.includes('Quota exceeded')) {
          continue; // Try next model
        }
        throw error;
      }
    }

    throw new Error('All models failed. API quota may be exceeded.');
  },
};

export default api;

