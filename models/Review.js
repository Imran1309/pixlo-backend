const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    photographerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Photographer',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true
    },
    images: {
        type: [String],
        default: []
    }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
