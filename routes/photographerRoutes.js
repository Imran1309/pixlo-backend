const express = require("express");
const router = express.Router();
const photographerController = require("../controllers/photographerController");
const auth = require("../middleware/auth");

router.get("/", photographerController.getAllPhotographers);
router.get("/nearby", photographerController.getNearbyPhotographers);
router.get("/profile/:id", photographerController.getPhotographerById);
// router.get('/profile/me', auth, photographerController.getMyProfile);

router.post("/profile", auth, photographerController.updateProfile);
router.patch("/profile", auth, photographerController.updateProfile);

router.get("/:id/reviews", photographerController.getReviews);
router.post("/:id/reviews", photographerController.addReview);
router.get("/:id/services", photographerController.getServices);

module.exports = router;
