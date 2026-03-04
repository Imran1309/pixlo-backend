const Razorpay = require("razorpay");
const Booking = require("../models/Booking");
const crypto = require("crypto");
const Photographer = require("../models/Photographer"); 
const mongoose = require("mongoose");
const User = require("../models/User");

// ===============================
// 🟢 Create Booking + Razorpay Order
// ===============================

exports.createBooking = async (req, res) => {
  try {
    console.log("📩 Booking Request Body:", req.body);

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

    if (
      !customerId ||
      !photographerId ||
      !serviceId ||
      !eventDate ||
      !eventTime ||
      !location ||
      !amount
    ) {
      return res.status(400).json({
        success: false,
        message: "All booking fields are required",
      });
    }

    // 1️⃣ Create Booking (pending)
    const newBooking = new Booking({
      customerId,
      photographerId,
      serviceId,
      eventDate,
      eventTime,
      durationHours: durationHours || 1,
      location,
      amount,
      status: "pending",
    });

    await newBooking.save();
    console.log("✅ Booking saved in DB");

    // 2️⃣ Initialize Razorpay inside function
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: "Razorpay keys missing" });
    }

    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // 3️⃣ Create Razorpay Order
    console.log("💳 Creating Razorpay order...");
    const order = await razorpayInstance.orders.create({
      amount: Math.round(Number(amount) * 100), // convert to paise
      currency: "INR",
      receipt: `booking_${newBooking._id}`,
    });

    console.log("✅ Razorpay Order Created:", order.id);

    // 4️⃣ Save orderId in Booking
    newBooking.orderId = order.id;
    await newBooking.save();

    return res.status(200).json({
      success: true,
      message: "Order created successfully",
      order,
      booking: newBooking,
    });

  } catch (error) {
    console.error("❌ Razorpay Full Error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error?.error?.description || "Internal server error",
    });
  }
};

// ===============================
// 🟢 Verify Razorpay Payment
// ===============================
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({ success: false, message: "Missing payment verification fields" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { status: "confirmed", paymentId: razorpay_payment_id, paymentSignature: razorpay_signature },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      booking: updatedBooking,
    });

  } catch (error) {
    console.error("❌ Payment Verification Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ===============================
// 🟢 Get Razorpay Key
// ===============================
exports.getRazorpayKey = async (req, res) => {
  return res.status(200).json({ success: true, key: process.env.RAZORPAY_KEY_ID });
};

// ===============================
// 🟢 Get Customer Bookings
// ===============================
// exports.getMyBookings = async (req, res) => {
//   try {
//     const { customerId } = req.query;
//     if (!customerId) return res.status(400).json({ success: false, message: "customerId is required" });

//     const bookings = await Booking.find({ customerId }).populate("photographerId").sort({ createdAt: -1 });
//     console.log(`📋 Found ${bookings.length} bookings for customer ${customerId}`);
//     console.log("📋 Bookings Data:", bookings) ;
//     return res.status(200).json({ success: true, bookings });

//   } catch (error) {
//     console.error("Get My Bookings Error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };
exports.getMyBookings = async (req, res) => {
  const { customerId } = req.query;

  if (!customerId) {
    return res.status(400).json({ success: false, message: "CustomerId is required" });
  }

  try {
    // Fetch bookings and populate nested fields
    const bookings = await Booking.find({ customerId })
      .populate({
        path: "photographerId",         // populate photographer
        populate: { path: "userId", select: "name email" }, // nested populate for user
      })
      .populate({
        path: "serviceId", // populate service
        select: "serviceName priceINR durationHours",
      })
      .sort({ eventDate: -1 });
      console.log(bookings);
    res.json({ success: true, bookings });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===============================
// 🟢 Get Photographer Bookings
// ===============================
exports.getPhotographerBookings = async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: "UserId is required" });
  }

  try {
    // Use 'new' with ObjectId in Mongoose 7+
    const photographer = await Photographer.findOne({ userId: new mongoose.Types.ObjectId(userId) });

    if (!photographer) {
      return res.status(404).json({ success: false, message: "Photographer profile not found" });
    }

    const bookings = await Booking.find({ photographerId: photographer._id })
      .populate({ path: "customerId", select: "name email phone" })
      .populate({ path: "serviceId", select: "serviceName priceINR durationHours" })
      .sort({ eventDate: -1 });

    res.json({ success: true, bookings });
  } catch (err) {
    console.error("Error fetching photographer bookings:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};