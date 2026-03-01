const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: { type: String, required: true }, // For basic signup
    firstName: { type: String }, // For creator signup
    lastName: { type: String },  // For creator signup
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'photographer', 'admin'], default: 'customer' },
    phone: { type: String },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dob: { type: Date },
    address: {
        country: String,
        city: String,
        zipCode: String
    },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    profilePic: { type: String, default: "" },
    portfolio: { type: [String], default: [] }, // Array of portfolio image URLs
    bio: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    languages: { type: [String], default: [] },
    googleId: { type: String, unique: true, sparse: true },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    }
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
