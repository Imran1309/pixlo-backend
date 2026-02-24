const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    photographerId: { type: mongoose.Schema.Types.ObjectId, ref: "Photographer", required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    eventDate: { type: Date, required: true },
    eventTime: { type: String, required: true },
    durationHours: { type: Number, required: true },
    location: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "confirmed", "completed", "cancelled"], default: "pending" },
    paymentId: { type: String },
    orderId: { type: String },
    paymentSignature: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);
