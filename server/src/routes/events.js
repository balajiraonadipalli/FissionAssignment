import express from "express";
import multer from "multer";
import Event from "../models/Event.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Multer setup for in-memory image uploads (to convert to base64)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// GET /api/events - list upcoming events with optional filters
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const { category, startDate, endDate, search } = req.query;
    
    let query = { dateTime: { $gte: now } };
    
    // Filter by category
    if (category && category !== "All") {
      query.category = category;
    }
    
    // Filter by date range
    if (startDate) {
      query.dateTime = { ...query.dateTime, $gte: new Date(startDate) };
    }
    if (endDate) {
      query.dateTime = { ...query.dateTime, $lte: new Date(endDate) };
    }
    
    // Search by title, description, or location
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    
    const events = await Event.find(query)
      .sort({ dateTime: 1 })
      .populate("createdBy", "name email")
      .lean();

    const withCounts = events.map((e) => ({
      ...e,
      attendeeCount: e.attendees?.length || 0,
    }));

    return res.json(withCounts);
  } catch (err) {
    console.error("List events error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/events/my-events - get events created by user (must come before /:id)
router.get("/my-events", authMiddleware, async (req, res) => {
  try {
    const events = await Event.find({ createdBy: req.user.id })
      .sort({ dateTime: 1 })
      .populate("createdBy", "name email")
      .lean();

    const withCounts = events.map((e) => ({
      ...e,
      attendeeCount: e.attendees?.length || 0,
    }));

    return res.json(withCounts);
  } catch (err) {
    console.error("Get my events error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/events/attending - get events user is attending (must come before /:id)
router.get("/attending", authMiddleware, async (req, res) => {
  try {
    const events = await Event.find({ attendees: req.user.id })
      .sort({ dateTime: 1 })
      .populate("createdBy", "name email")
      .lean();

    const withCounts = events.map((e) => ({
      ...e,
      attendeeCount: e.attendees?.length || 0,
    }));

    return res.json(withCounts);
  } catch (err) {
    console.error("Get attending events error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/events/:id - get single event
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name email")
      .lean();
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    return res.json({
      ...event,
      attendeeCount: event.attendees?.length || 0,
    });
  } catch (err) {
    console.error("Get event error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/events - create event
router.post(
  "/",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, description, dateTime, location, capacity } = req.body;
      if (!title || !description || !dateTime || !location || !capacity) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const parsedCapacity = parseInt(capacity, 10);
      if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
        return res.status(400).json({ message: "Capacity must be a positive number" });
      }

      // Convert image to base64 if provided
      let imageData = null;
      let imageContentType = null;
      if (req.file) {
        imageData = req.file.buffer.toString('base64');
        imageContentType = req.file.mimetype;
      }

      const event = await Event.create({
        title,
        description,
        dateTime: new Date(dateTime),
        location,
        capacity: parsedCapacity,
        imageData,
        imageContentType,
        createdBy: req.user.id,
        attendees: [],
      });

      return res.status(201).json(event);
    } catch (err) {
      console.error("Create event error", err);
      if (err.message === 'Only image files are allowed') {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// PUT /api/events/:id - update event (only creator)
router.put(
  "/:id",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (String(event.createdBy) !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to edit this event" });
      }

      const { title, description, dateTime, location, capacity, category } = req.body;
      if (title) event.title = title;
      if (description) event.description = description;
      if (dateTime) event.dateTime = new Date(dateTime);
      if (location) event.location = location;
      if (category) event.category = category;
      if (capacity) {
        const parsedCapacity = parseInt(capacity, 10);
        if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
          return res.status(400).json({ message: "Capacity must be a positive number" });
        }
        if (parsedCapacity < event.attendees.length) {
          return res
            .status(400)
            .json({ message: "Capacity cannot be less than current attendee count" });
        }
        event.capacity = parsedCapacity;
      }

      // Update image if new one is provided
      if (req.file) {
        event.imageData = req.file.buffer.toString('base64');
        event.imageContentType = req.file.mimetype;
      }

      await event.save();
      return res.json(event);
    } catch (err) {
      console.error("Update event error", err);
      if (err.message === 'Only image files are allowed') {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// DELETE /api/events/:id - delete event (only creator)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    if (String(event.createdBy) !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this event" });
    }

    await event.deleteOne();
    return res.json({ message: "Event deleted" });
  } catch (err) {
    console.error("Delete event error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/events/:id/rsvp - join event with capacity & concurrency control
router.post("/:id/rsvp", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.id;

    // Atomic update: only add attendee if:
    // - user is not already in attendees
    // - attendees array size is still less than capacity
    const updated = await Event.findOneAndUpdate(
      {
        _id: eventId,
        attendees: { $ne: userId },
        $expr: { $lt: [{ $size: "$attendees" }, "$capacity"] },
      },
      { $addToSet: { attendees: userId } },
      { new: true }
    ).lean();

    if (!updated) {
      const existing = await Event.findById(eventId).lean();
      if (!existing) {
        return res.status(404).json({ message: "Event not found" });
      }
      const alreadyJoined = existing.attendees?.some(
        (a) => String(a) === String(userId)
      );
      if (alreadyJoined) {
        return res.status(400).json({ message: "You have already RSVPed to this event" });
      }
      if ((existing.attendees?.length || 0) >= existing.capacity) {
        return res.status(400).json({ message: "Event is already full" });
      }
      return res.status(400).json({ message: "Unable to RSVP. Please try again." });
    }

    return res.json({
      ...updated,
      attendeeCount: updated.attendees?.length || 0,
    });
  } catch (err) {
    console.error("RSVP join error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/events/:id/unrsvp - leave event
router.post("/:id/unrsvp", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.id;

    const updated = await Event.findOneAndUpdate(
      { _id: eventId },
      { $pull: { attendees: userId } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json({
      ...updated,
      attendeeCount: updated.attendees?.length || 0,
    });
  } catch (err) {
    console.error("RSVP leave error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/events/user/my-events - get events created by user
router.get("/user/my-events", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const events = await Event.find({ createdBy: userId })
      .sort({ dateTime: 1 })
      .populate("createdBy", "name email")
      .lean();

    const withCounts = events.map((e) => ({
      ...e,
      attendeeCount: e.attendees?.length || 0,
    }));

    return res.json(withCounts);
  } catch (err) {
    console.error("Get my events error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/events/user/attending - get events user is attending
router.get("/user/attending", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const events = await Event.find({ attendees: userId })
      .sort({ dateTime: 1 })
      .populate("createdBy", "name email")
      .lean();

    const withCounts = events.map((e) => ({
      ...e,
      attendeeCount: e.attendees?.length || 0,
    }));

    return res.json(withCounts);
  } catch (err) {
    console.error("Get attending events error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/events/ai/generate-description - AI generate event description
router.post("/ai/generate-description", authMiddleware, async (req, res) => {
  try {
    const { title, location, dateTime } = req.body;

    if (!title || !location) {
      return res.status(400).json({ message: "Title and location are required" });
    }

    // Simple AI description generation using template-based approach
    // In production, you could integrate with OpenAI API, Gemini, etc.
    const date = dateTime ? new Date(dateTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }) : '';

    const description = `Join us for an exciting ${title} event${date ? ` on ${date}` : ''} at ${location}. 

This is a great opportunity to network, learn, and connect with like-minded individuals. Don't miss out on this engaging experience!

${date ? `Mark your calendar for ${date}!` : ''} We look forward to seeing you there.`;

    return res.json({ description });
  } catch (err) {
    console.error("AI description generation error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;


