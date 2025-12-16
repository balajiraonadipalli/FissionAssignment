# EventHub - Event RSVP Platform

A full-stack MERN (MongoDB, Express.js, React.js, Node.js) web application that allows users to create, view, and RSVP to events with robust capacity management and concurrency handling.

## Features

### Core Features
- **User Authentication**: Secure sign up and login with JWT token-based authentication
- **Event Management**: 
  - Create events with title, description, date/time, location, capacity, and image upload
  - View all upcoming events in a responsive dashboard
  - Edit and delete events (only by the creator)
- **RSVP System**: 
  - Join and leave events
  - Strict capacity enforcement
  - Race condition handling for concurrent RSVPs
  - Duplicate RSVP prevention
- **Responsive Design**: Fully responsive UI that works seamlessly on Desktop, Tablet, and Mobile devices
- **Image Upload**: Users can upload event images which are stored directly in MongoDB Atlas as base64 and displayed on the frontend
- **Search Functionality**: Search events by title, description, or location

### Technical Highlights
- **Concurrency-Safe RSVP**: Atomic MongoDB operations prevent overbooking
- **JWT Authentication**: Stateless session management
- **MongoDB Image Storage**: Images are stored as base64 strings directly in MongoDB Atlas (no file system required)
- **RESTful API**: Clean API structure with proper error handling

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account (or local MongoDB instance)

## Installation & Setup

### Backend Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key
```

**Note**: AI description generation runs from the frontend (reduces server load):
- Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Add it to the `client/.env` file as `REACT_APP_GEMINI_API_KEY` (see Frontend Setup below)
- Project Information (for reference):
  - Project Name: `projects/649922376547`
  - Project Number: `649922376547`

4. Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the `client` directory:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_GEMINI_API_KEY=your_gemini_api_key
```

**Note**: The AI description generation runs directly from the frontend to reduce server load. Add your Gemini API key to the client `.env` file.

4. Start the development server:
```bash
npm start
```

The client will run on `http://localhost:3000`

## Technical Explanation: RSVP Capacity & Concurrency Handling

### Problem Statement
When multiple users attempt to RSVP simultaneously for an event that has only one remaining spot, a race condition can occur. Without proper handling, the system might allow more users to RSVP than the event capacity allows, leading to overbooking.

### Solution Strategy

The application uses **MongoDB's atomic update operations** with conditional queries to ensure thread-safe RSVP operations. Here's how it works:

#### Implementation Details

The RSVP endpoint (`POST /api/events/:id/rsvp`) uses MongoDB's `findOneAndUpdate` method with three critical conditions in a single atomic operation:

```javascript
const updated = await Event.findOneAndUpdate(
  {
    _id: eventId,
    attendees: { $ne: userId },                    // Condition 1: User not already in attendees
    $expr: { $lt: [{ $size: "$attendees" }, "$capacity"] }  // Condition 2: Capacity not exceeded
  },
  { $addToSet: { attendees: userId } },           // Atomic add operation
  { new: true }
);
```

#### How It Prevents Race Conditions

1. **Atomic Operation**: The entire check-and-update happens in a single database operation, ensuring no other process can interfere between the check and the update.

2. **Conditional Update**: The update only executes if ALL conditions are met:
   - The event exists
   - The user is not already in the attendees list
   - The current attendee count is less than capacity

3. **$addToSet Operator**: This MongoDB operator ensures that even if somehow a duplicate ID gets through, it won't be added twice.

4. **Single Query**: By combining all checks into one query, we eliminate the time window between "check capacity" and "add attendee" where another request could slip in.

#### Example Scenario

**Without Atomic Operations (Race Condition):**
```
Time    User A                    User B                    Database State
T1      Check capacity: 1 spot    -                        Capacity: 5, Attendees: 4
T2      -                        Check capacity: 1 spot    Capacity: 5, Attendees: 4
T3      Add user A                -                        Capacity: 5, Attendees: 5
T4      -                        Add user B                Capacity: 5, Attendees: 6 OVERBOOKED
```

**With Atomic Operations (Safe):**
```
Time    User A                    User B                    Database State
T1      Atomic: Check & Add       -                        Capacity: 5, Attendees: 4
T2      Success (5 attendees)  -                        Capacity: 5, Attendees: 5
T3      -                        Atomic: Check & Add       Capacity: 5, Attendees: 5
T4      -                        Fails (capacity full)  Capacity: 5, Attendees: 5 SAFE
```

#### Error Handling

If the atomic update fails (returns `null`), the code performs additional checks to provide meaningful error messages:
- Event not found
- User already RSVPed
- Event is full

This ensures users receive clear feedback about why their RSVP failed.

### Why This Approach?

1. **Database-Level Safety**: The atomicity is guaranteed by MongoDB, not application logic
2. **Performance**: Single database query is faster than multiple queries with locks
3. **Scalability**: Works correctly even under high concurrent load
4. **No Locks Required**: No need for application-level locking mechanisms
5. **MongoDB Native**: Uses built-in MongoDB features, making it reliable and efficient

## Project Structure

```
FissionAssignment/
├── server/
│   ├── src/
│   │   ├── index.js           # Express server setup
│   │   ├── models/
│   │   │   ├── User.js        # User model
│   │   │   └── Event.js       # Event model
│   │   ├── routes/
│   │   │   ├── auth.js        # Authentication routes
│   │   │   └── events.js      # Event CRUD and RSVP routes
│   │   └── middleware/
│   │       └── auth.js        # JWT authentication middleware
│   ├── package.json
│   └── .env                   # Environment variables
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.js      # Navigation component
│   │   │   ├── Login.js       # Login page
│   │   │   ├── Register.js    # Registration page
│   │   │   ├── Dashboard.js   # Events listing page
│   │   │   ├── EventCard.js   # Individual event card
│   │   │   └── EventForm.js   # Create/Edit event form
│   │   ├── context/
│   │   │   └── AuthContext.js # Authentication context
│   │   ├── services/
│   │   │   └── api.js         # API service layer
│   │   ├── App.js             # Main app component
│   │   └── index.tsx          # Entry point
│   ├── public/
│   ├── package.json
│   └── .env                   # Environment variables
│
└── README.md
```

## Deployment

### Backend Deployment (Render/Railway)

1. Push your code to GitHub
2. Connect your repository to Render/Railway
3. Set environment variables:
   - `MONGO_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: A secure random string
   - `PORT`: Usually auto-assigned by the platform
4. Set build command: `npm install`
5. Set start command: `npm start`

**Note**: 
- Images are stored directly in MongoDB Atlas as base64 strings, so no file system or cloud storage setup is required!
- AI description generation runs from the frontend, so no backend configuration needed for AI feature.

### Frontend Deployment (Vercel/Netlify)

1. Push your code to GitHub
2. Connect your repository to Vercel/Netlify
3. Set environment variables:
   - `REACT_APP_API_URL`: Your deployed backend URL (e.g., `https://your-backend.onrender.com/api`)
4. Set build command: `npm run build`
5. Deploy

### Database Setup

1. Create a MongoDB Atlas account
2. Create a new cluster
3. Get your connection string
4. Update the `MONGO_URI` in your backend `.env` file

## Testing the Concurrency Solution

To test the concurrency handling:

1. Create an event with capacity of 1
2. Open multiple browser tabs/windows
3. Try to RSVP from multiple tabs simultaneously
4. Only one should succeed; others should receive "Event is already full" message

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Events
- `GET /api/events` - Get all upcoming events (supports query params: category, startDate, endDate, search)
- `GET /api/events/:id` - Get single event
- `GET /api/events/my-events` - Get events created by authenticated user
- `GET /api/events/attending` - Get events user is attending
- `POST /api/events` - Create event (authenticated, includes category)
- `PUT /api/events/:id` - Update event (authenticated, creator only)
- `DELETE /api/events/:id` - Delete event (authenticated, creator only)
- `POST /api/events/:id/rsvp` - RSVP to event (authenticated)
- `POST /api/events/:id/unrsvp` - Cancel RSVP (authenticated)

### AI (Frontend Implementation)
- AI description generation runs directly from the frontend using Gemini API
- No backend endpoint required (reduces server load)
- API calls are made directly from the browser to Google's Gemini API

## Features Implemented

### Core Features
- User Authentication (Sign Up & Login)
- JWT Token-based Session Management
- Event CRUD Operations
- Image Upload for Events (stored in MongoDB Atlas)
- Event Capacity Management
- RSVP System with Concurrency Handling
- Duplicate RSVP Prevention
- Responsive Design (Desktop, Tablet, Mobile)
- User Authorization (Edit/Delete own events only)

### Enhanced Features (Optional Enhancements)
- Search & Filtering: Search by title/description/location, filter by category and date range
- User Dashboard: Private page showing events user is attending and events they created
- AI Integration: Auto-generate event descriptions using Google Gemini AI
- Dark Mode Toggle: Switch between light and dark themes
- Advanced Form Validation: Real-time validation with error messages
- Event Categories: Categorize events (Technology, Business, Education, Entertainment, Sports, Networking, Other)  

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Protected routes
- Input validation
- File upload size limits
- CORS configuration

## Responsive Breakpoints

- **Desktop**: > 1024px (3-column grid)
- **Tablet**: 769px - 1024px (2-column grid)
- **Mobile**: < 768px (1-column layout)

## Contributing

This is an assignment project. For questions or improvements, please refer to the assignment guidelines.

## License

ISC

---

**Note**: Make sure to update the `REACT_APP_API_URL` in the client `.env` file to match your deployed backend URL when deploying to production.

