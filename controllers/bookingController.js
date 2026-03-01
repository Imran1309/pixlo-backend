const Razorpay = require("razorpay");
const Booking = require("../models/Booking");
const crypto = require("crypto");

// Initialize Razorpay with env keys
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_Qi1InUYyVMLZdY",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "gXk2oKq1WpM2O5jF0V5E7fK1",
});

// Create Booking and Razorpay Order
exports.createBooking = async (req, res) => {
    try {
        const {
            customerId,
            photographerId,
            serviceId,
            eventDate,
            eventTime,
            durationHours,
            location,
            amount,
        } = req.body;

        if (!customerId || !photographerId || !eventDate || !eventTime || !location || !amount) {
            return res.status(400).json({ success: false, message: "Missing required booking fields" });
        }

        // Create Razorpay Order
        const options = {
            amount: Math.round(amount * 100), // Razorpay takes amount in paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        let order;
        try {
            order = await razorpayInstance.orders.create(options);
        } catch (razorpayErr) {
            console.error("Razorpay Order Error:", razorpayErr.message);
            return res.status(500).json({ success: false, message: "Failed to create payment order. Check Razorpay keys." });
        }

        if (!order) {
            return res.status(500).json({ success: false, message: "Error creating order" });
        }

        // Save booking to DB as pending (only confirmed after payment verification)
        const newBooking = new Booking({
            customerId,
            photographerId,
            serviceId: serviceId || new require("mongoose").Types.ObjectId(),
            eventDate,
            eventTime,
            durationHours: durationHours || 1,
            location,
            amount,
            orderId: order.id,
            status: "pending",
        });

        await newBooking.save();

        res.status(200).json({
            success: true,
            message: "Order created successfully",
            order,
            booking: newBooking,
        });
    } catch (err) {
        console.error("Booking Creation Error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// Verify Payment and Confirm Booking
exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
            return res.status(400).json({ success: false, message: "Missing payment verification fields" });
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET || "gXk2oKq1WpM2O5jF0V5E7fK1";
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", keySecret)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Payment verified — update booking to confirmed
            const updatedBooking = await Booking.findByIdAndUpdate(
                bookingId,
                {
                    status: "confirmed",
                    paymentId: razorpay_payment_id,
                    paymentSignature: razorpay_signature,
                },
                { new: true }
            );

            if (!updatedBooking) {
                return res.status(404).json({ success: false, message: "Booking not found" });
            }

            return res.status(200).json({
                success: true,
                message: "Payment verified and booking confirmed!",
                booking: updatedBooking,
            });
        } else {
            return res.status(400).json({ success: false, message: "Invalid payment signature — payment not verified" });
        }
    } catch (error) {
        console.error("Payment Verification Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get bookings for a customer
exports.getMyBookings = async (req, res) => {
    try {
        const { customerId } = req.query;

        if (!customerId) {
            return res.status(400).json({ success: false, message: "customerId is required" });
        }

        const bookings = await Booking.find({ customerId })
            .populate({
                path: "photographerId",
                populate: { path: "userId", select: "name email profilePic" },
            })
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, bookings });
    } catch (error) {
        console.error("Get My Bookings Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get bookings for a photographer
exports.getPhotographerBookings = async (req, res) => {
    try {
        const { photographerId } = req.query;

        if (!photographerId) {
            return res.status(400).json({ success: false, message: "photographerId is required" });
        }

        const bookings = await Booking.find({ photographerId })
            .populate("customerId", "name email profilePic phone")
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, bookings });
    } catch (error) {
        console.error("Get Photographer Bookings Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get Razorpay key (for frontend)
exports.getRazorpayKey = async (req, res) => {
    res.status(200).json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID || "rzp_test_Qi1InUYyVMLZdY",
    });
};
