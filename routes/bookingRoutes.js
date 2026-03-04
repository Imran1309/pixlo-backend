const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const auth = require("../middleware/auth");

// Create a new booking and Razorpay order
router.post("/",auth, bookingController.createBooking);

// Verify Razorpay payment and confirm booking
router.post("/verify-payment", bookingController.verifyPayment);

// Get bookings for a customer (by customerId query param)
router.get("/my-bookings",auth, bookingController.getMyBookings);

// Get bookings for a photographer (by photographerId query param)
router.get("/photographer-bookings",auth, bookingController.getPhotographerBookings);

// Get Razorpay key ID for frontend
router.get("/razorpay-key", bookingController.getRazorpayKey);

module.exports = router;
