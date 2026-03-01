const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// GET /api/reviews
router.get('/', reviewController.getReviews);

// GET /api/reviews/photographer/:userId
router.get('/photographer/:userId', reviewController.getPhotographerReviews);

// POST /api/reviews
router.post('/', reviewController.createReview);

// PUT /api/reviews/:id
router.put('/:id', reviewController.updateReview);

// DELETE /api/reviews/:id
router.delete('/:id', reviewController.deleteReview);

module.exports = router;
