const Photographer = require("../models/Photographer");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const Review = require("../models/Review");
const axios = require("axios");

/* =====================================================
   GET ALL PHOTOGRAPHERS
===================================================== */
exports.getAllPhotographers = async (req, res) => {
  try {
    const photographers = await Photographer.find().populate(
      "userId",
      "name email profilePic"
    );
    res.json({ photographers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET NEARBY PHOTOGRAPHERS (with real distance in KM)
===================================================== */
exports.getNearbyPhotographers = async (req, res) => {
  try {
    const { lat, lng, distance = 100000 } = req.query; // distance in meters, default 100km

    if (!lat || !lng) {
      return res
        .status(400)
        .json({ message: "Latitude and Longitude are required" });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    let photographers = [];
    let usedGeoNear = false;

    // Try $geoNear aggregation first (requires 2dsphere index and valid coords)
    try {
      photographers = await Photographer.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [userLng, userLat],
            },
            distanceField: "distanceMeters",
            maxDistance: parseInt(distance),
            spherical: true,
            query: {
              "location.coordinates": { $ne: [0, 0] }, // Skip photographers with default 0,0 coords
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userId",
          },
        },
        {
          $unwind: {
            path: "$userId",
            preserveNullAndEmpty: true,
          },
        },
        {
          $addFields: {
            distanceKm: {
              $round: [{ $divide: ["$distanceMeters", 1000] }, 1],
            },
          },
        },
      ]);
      usedGeoNear = true;
    } catch (geoErr) {
      console.warn("$geoNear failed, falling back to all photographers:", geoErr.message);
    }

    // Fallback: fetch all photographers and compute distance with Haversine in JS
    if (!usedGeoNear || photographers.length === 0) {
      const allPhotographers = await Photographer.find().populate(
        "userId",
        "name email profilePic"
      );

      photographers = allPhotographers.map((p) => {
        const pObj = p.toObject();
        const pLng = pObj.location?.coordinates?.[0];
        const pLat = pObj.location?.coordinates?.[1];

        if (pLat && pLng && !(pLat === 0 && pLng === 0)) {
          const R = 6371;
          const dLat = ((pLat - userLat) * Math.PI) / 180;
          const dLng = ((pLng - userLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((userLat * Math.PI) / 180) *
            Math.cos((pLat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distKm = Math.round(R * c * 10) / 10;
          pObj.distanceKm = distKm;
        }
        return pObj;
      });

      // Sort by distance
      photographers.sort((a, b) => {
        if (a.distanceKm !== undefined && b.distanceKm !== undefined)
          return a.distanceKm - b.distanceKm;
        return 0;
      });
    }

    res.json({ photographers });
  } catch (err) {
    console.error("getNearbyPhotographers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET PHOTOGRAPHER BY ID OR USER ID
===================================================== */
exports.getPhotographerById = async (req, res) => {
  try {
    const { id } = req.params;

    let photographer = await Photographer.findOne({ userId: id }).populate(
      "userId",
      "-password"
    );

    if (!photographer) {
      photographer = await Photographer.findById(id).populate(
        "userId",
        "-password"
      );
    }

    if (!photographer) {
      return res.status(404).json({ message: "Photographer not found" });
    }

    res.json({ photographer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET SERVICES
===================================================== */
exports.getServices = async (req, res) => {
  try {
    const { id } = req.params;
    const photographer = await Photographer.findById(id).select("services");

    if (!photographer) {
      return res.status(404).json({ message: "Photographer not found" });
    }

    res.json({ services: photographer.services });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   UPDATE PROFILE (with geocoding for city name)
===================================================== */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = { ...req.body };

    // If location is a string (city name), geocode it
    if (updates.location && typeof updates.location === "string") {
      try {
        const geoRes = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(updates.location)}&limit=1`,
          { headers: { "User-Agent": "Pixlo App" } }
        );
        if (geoRes.data && geoRes.data.length > 0) {
          const { lat, lon } = geoRes.data[0];
          updates.location = {
            type: "Point",
            coordinates: [parseFloat(lon), parseFloat(lat)],
          };
        }
      } catch (geoErr) {
        console.warn("Geocoding failed, skipping location update:", geoErr.message);
        delete updates.location; // Don't overwrite with bad data
      }
    }

    const photographer = await Photographer.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }
    );

    res.json({ photographer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   UPDATE SERVICES
===================================================== */
exports.updateServices = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.body.userId;
    const { services } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!Array.isArray(services)) {
      return res.status(400).json({ message: "services must be an array" });
    }

    // Calculate starting price
    const startingPrice =
      services.length > 0
        ? Math.min(...services.map((s) => Number(s.priceINR || s.price || 0)))
        : 0;

    const photographer = await Photographer.findOneAndUpdate(
      { userId },
      {
        $set: {
          services: services.map((s) => ({
            serviceName: s.serviceName || s.name || "",
            description: s.description || "",
            priceINR: Number(s.priceINR || s.price || 0),
            durationHours: Number(s.durationHours || s.duration || 1),
            deliverables: s.deliverables || "",
          })),
          startingPrice,
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Services updated successfully",
      photographer,
    });
  } catch (err) {
    console.error("Update services error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   UPDATE AVAILABILITY
===================================================== */
exports.updateAvailability = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.body.userId;
    const { availability } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!availability) {
      return res.status(400).json({ message: "availability data is required" });
    }

    // Convert boolean arrays to time-slot string arrays for storage
    // Frontend sends: { morning: [bool x7], afternoon: [bool x7], evening: [bool x7] }
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

    const availabilityUpdate = {};
    days.forEach((day, i) => {
      const slots = [];
      if (availability.morning && availability.morning[i]) slots.push("morning");
      if (availability.afternoon && availability.afternoon[i]) slots.push("afternoon");
      if (availability.evening && availability.evening[i]) slots.push("evening");
      availabilityUpdate[`availability.${day}`] = slots;
    });

    const photographer = await Photographer.findOneAndUpdate(
      { userId },
      { $set: availabilityUpdate },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      photographer,
    });
  } catch (err) {
    console.error("Update availability error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   REVIEWS
===================================================== */
exports.getReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const reviews = await Review.find({ photographerId: id })
      .populate("customerId", "name profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, reviews });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, rating, comment } = req.body;

    if (!customerId || !rating || !comment) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const newReview = new Review({
      photographerId: id,
      customerId,
      rating,
      comment,
    });

    await newReview.save();

    const allReviews = await Review.find({ photographerId: id });
    const avgRating =
      allReviews.reduce((sum, rev) => sum + rev.rating, 0) / allReviews.length;

    await Photographer.findByIdAndUpdate(id, {
      rating: avgRating.toFixed(1),
      reviewCount: allReviews.length,
    });

    const populatedReview = await Review.findById(newReview._id).populate(
      "customerId",
      "name profilePic"
    );

    res.status(201).json({
      success: true,
      message: "Review added",
      review: populatedReview,
    });
  } catch (error) {
    console.error("Add review error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* =====================================================
   PORTFOLIO VIDEOS
===================================================== */
exports.addPortfolioVideo = async (req, res) => {
  try {
    const { userId, videoLink, title, description } = req.body;

    if (!userId || !videoLink || !title) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const photographer = await Photographer.findOne({ userId });

    if (!photographer) {
      return res.status(404).json({ message: "Photographer not found" });
    }

    photographer.portfolioVideos.push({ videoLink, title, description });
    await photographer.save();

    res.status(200).json({
      message: "Video added successfully",
      photographer,
    });
  } catch (err) {
    console.error("Add video error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.editPortfolioVideo = async (req, res) => {
  try {
    const { userId, videoId, updatedVideo } = req.body;

    if (!userId || !videoId) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const photographer = await Photographer.findOne({ userId });

    if (!photographer) {
      return res.status(404).json({ message: "Photographer not found" });
    }

    const video = photographer.portfolioVideos.id(videoId);

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    video.videoLink = updatedVideo.videoLink;
    video.title = updatedVideo.title;
    video.description = updatedVideo.description;

    await photographer.save();

    res.status(200).json({
      message: "Video updated successfully",
      photographer,
    });
  } catch (err) {
    console.error("Edit video error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deletePortfolioVideo = async (req, res) => {
  try {
    const { userId, videoId } = req.body;

    if (!userId || !videoId) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const photographer = await Photographer.findOne({ userId });

    if (!photographer) {
      return res.status(404).json({ message: "Photographer not found" });
    }

    photographer.portfolioVideos = photographer.portfolioVideos.filter(
      (video) => video._id.toString() !== videoId
    );

    await photographer.save();

    res.status(200).json({
      message: "Video deleted successfully",
      photographer,
    });
  } catch (err) {
    console.error("Delete video error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   PORTFOLIO IMAGES
===================================================== */
exports.uploadPortfolioImages = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const photographer = await Photographer.findOne({ userId });

    if (!photographer) {
      return res.status(404).json({ message: "Photographer not found" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    const uploadedImages = req.files.map((file) => ({
      url: file.path,
      public_id: file.filename,
    }));

    photographer.portfolioImages.push(...uploadedImages);
    await photographer.save();

    return res.status(200).json({
      message: "Images uploaded successfully",
      photographer,
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deletePortfolioImage = async (req, res) => {
  try {
    const { userId, public_id } = req.body;

    if (!userId || !public_id) {
      return res.status(400).json({ message: "userId and public_id are required" });
    }

    const photographer = await Photographer.findOne({ userId });

    if (!photographer) {
      return res.status(404).json({ message: "Photographer not found" });
    }

    await cloudinary.uploader.destroy(public_id);

    photographer.portfolioImages = photographer.portfolioImages.filter(
      (img) => img.public_id !== public_id
    );

    await photographer.save();

    return res.status(200).json({
      message: "Image deleted successfully",
      photographer,
    });
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
