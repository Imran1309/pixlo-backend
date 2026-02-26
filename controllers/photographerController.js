const Photographer = require("../models/Photographer");
const User = require("../models/User");

exports.getAllPhotographers = async (req, res) => {
  try {
    const photographers = await Photographer.find().populate(
      "userId",
      "name email profilePic rating reviewCount",
    );
    res.json({ photographers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getServices = async (req, res) => {
  try {
    const { id } = req.params;

    const photographer = await Photographer.findById(id).select("services"); // only fetch services

    if (!photographer) {
      return res.status(404).json({ message: "Photographer not found" });
    }

    res.json({ services: photographer.services });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getNearbyPhotographers = async (req, res) => {
  try {
    const { lat, lng, distance = 10000 } = req.query; // distance in meters

    if (!lat || !lng) {
      return res
        .status(400)
        .json({ message: "Latitude and Longitude are required" });
    }

    const photographers = await Photographer.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(distance),
        },
      },
    }).populate("userId", "name email profilePic rating reviewCount");

    res.json({ photographers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPhotographerById = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if id is UserID or PhotographerID
    // ViewProfile passes userId URL param. Let's assume it's the Photographer document ID first?
    // But ViewProfile says `photographer.userId?.name`. So it fetches Photographer doc.
    // Wait, ViewProfile uses `useParams().userId`.
    // If route is `/profile/by-id/:userId`, it probably means User ID.

    let photographer = await Photographer.findOne({ userId: id }).populate(
      "userId",
      "-password",
    );

    if (!photographer) {
      // Fallback: maybe id IS the photographer ID?
      photographer = await Photographer.findById(id).populate(
        "userId",
        "-password",
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

exports.updateProfile = async (req, res) => {
  try {
    // Assume auth middleware populates req.user
    const userId = req.user.id;
    const updates = req.body;

    const photographer = await Photographer.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }, // Create if not exists
    );

    res.json({ photographer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const Review = require("../models/Review");

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

    // Update photographer average rating and count
    const allReviews = await Review.find({ photographerId: id });
    const avgRating =
      allReviews.reduce((sum, rev) => sum + rev.rating, 0) / allReviews.length;

    await Photographer.findByIdAndUpdate(id, {
      rating: avgRating.toFixed(1),
      reviewCount: allReviews.length,
    });

    const populatedReview = await Review.findById(newReview._id).populate(
      "customerId",
      "name profilePic",
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
