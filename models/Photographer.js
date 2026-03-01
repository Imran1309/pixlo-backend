const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
  serviceName: { type: String, required: true },
  description: { type: String },
  priceINR: { type: Number, required: true },
  durationHours: { type: Number },
  deliverables: { type: String },
});

const VideoSchema = new Schema({
  videoLink: { type: String, required: true },
  title: { type: String },
  description: { type: String },
});

const PhotographerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    introduction: { type: String },
    typeOfWork: { type: String }, // e.g. "Photographer", "Videographer", "Both"
    yearsOfExperience: { type: Number, default: 0 },
    specialization: { type: [String], default: [] },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
    },
    availability: {
      monday: { type: [String], default: [] },
      tuesday: { type: [String], default: [] },
      wednesday: { type: [String], default: [] },
      thursday: { type: [String], default: [] },
      friday: { type: [String], default: [] },
      saturday: { type: [String], default: [] },
      sunday: { type: [String], default: [] },
    },
    services: [ServiceSchema],
    portfolioImages: [
      {
        url: String,
        public_id: String,
      },
    ],
    portfolioVideos: [VideoSchema],
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    startingPrice: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index for geolocation
PhotographerSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Photographer", PhotographerSchema);
