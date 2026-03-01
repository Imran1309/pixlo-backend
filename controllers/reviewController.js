const Review = require("../models/Review");
const Photographer = require("../models/Photographer");

// Calculate and update average rating for a photographer
const updatePhotographerRating = async (photographerId) => {
    const allReviews = await Review.find({ photographerId });
    const avgRating = allReviews.length > 0
        ? allReviews.reduce((sum, rev) => sum + rev.rating, 0) / allReviews.length
        : 0;

    await Photographer.findByIdAndUpdate(photographerId, {
        rating: avgRating.toFixed(1),
        reviewCount: allReviews.length,
    });
};

// @desc    Create a new review
// @route   POST /api/reviews
exports.createReview = async (req, res) => {
    try {
        const { customerId, photographerId, bookingId, rating, comment } = req.body;

        if (!customerId || !photographerId || !rating || !comment) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const newReview = new Review({
            customerId,
            photographerId,
            bookingId,
            rating,
            comment,
        });

        await newReview.save();
        await updatePhotographerRating(photographerId);

        res.status(201).json({ success: true, message: "Review added", review: newReview });
    } catch (error) {
        console.error("Create review error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// @desc    Update an existing review
// @route   PUT /api/reviews/:id
exports.updateReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const review = await Review.findById(req.params.id);

        if (!review) return res.status(404).json({ success: false, message: "Review not found" });

        review.rating = rating || review.rating;
        review.comment = comment || review.comment;
        await review.save();

        await updatePhotographerRating(review.photographerId);

        res.json({ success: true, message: "Review updated successfully", review });
    } catch (error) {
        console.error("Update review error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ success: false, message: "Review not found" });

        const photographerId = review.photographerId;
        await Review.findByIdAndDelete(req.params.id);

        await updatePhotographerRating(photographerId);

        res.json({ success: true, message: "Review deleted successfully" });
    } catch (error) {
        console.error("Delete review error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// @desc    Get reviews by query (customer and booking)
// @route   GET /api/reviews
exports.getReviews = async (req, res) => {
    try {
        const { customerId, bookingId } = req.query;
        let query = {};
        if (customerId) query.customerId = customerId;
        if (bookingId) query.bookingId = bookingId;

        const reviews = await Review.find(query).populate("photographerId", "userId");
        res.json({ success: true, reviews });
    } catch (error) {
        console.error("Get reviews error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// @desc    Get photographer reviews by User ID
// @route   GET /api/reviews/photographer/:userId
exports.getPhotographerReviews = async (req, res) => {
    try {
        // 1. Find the Photographer document using the userId from params
        const photographer = await Photographer.findOne({ userId: req.params.userId });

        if (!photographer) {
            return res.status(404).json({ success: false, message: "Photographer profile not found for this user" });
        }

        // 2. Fetch reviews using the Photographer's _id
        const reviews = await Review.find({ photographerId: photographer._id })
            .populate("customerId", "name profilePic")
            .populate("bookingId", "eventDate eventTime location")
            .sort({ createdAt: -1 });

        res.json({ success: true, reviews });
    } catch (error) {
        console.error("Get photographer reviews error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
