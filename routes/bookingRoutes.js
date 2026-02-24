const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Route to create a new booking
router.post('/', bookingController.createBooking);

// Route to verify Razorpay payment verification
router.post('/verify-payment', bookingController.verifyPayment);

module.exports = router;
