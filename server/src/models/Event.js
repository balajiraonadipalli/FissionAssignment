import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    dateTime: { type: Date, required: true, index: true },
    location: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    category: { type: String, default: "General" }, // Event category
    imageData: { type: String }, // Base64 encoded image stored in MongoDB
    imageContentType: { type: String }, // MIME type (e.g., 'image/jpeg', 'image/png')
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const Event = mongoose.model("Event", eventSchema);

export default Event;


