const express = require("express");
const router = express.Router();
const photographerController = require("../controllers/photographerController");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

// Public routes
router.get("/", photographerController.getAllPhotographers);
router.get("/nearby", photographerController.getNearbyPhotographers);
router.get("/profile/:id", photographerController.getPhotographerById);

// Authenticated profile routes
router.post("/profile", auth, photographerController.updateProfile);
router.patch("/profile", auth, photographerController.updateProfile);

// Reviews
router.get("/:id/reviews", photographerController.getReviews);
router.post("/:id/reviews", photographerController.addReview);

// Services
router.get("/:id/services", photographerController.getServices);
router.put("/services", auth, photographerController.updateServices);
router.post("/services", auth, photographerController.updateServices); // also allow POST

// Availability
router.put("/availability", auth, photographerController.updateAvailability);
router.post("/availability", auth, photographerController.updateAvailability); // also allow POST

// Portfolio Videos
router.post("/portfolio/video", auth, photographerController.addPortfolioVideo);
router.put("/portfolio/video/edit", auth, photographerController.editPortfolioVideo);
router.delete("/portfolio/video/delete", auth, photographerController.deletePortfolioVideo);

// Portfolio Images
router.post(
  "/portfolio/images",
  auth,
  upload.array("images", 10),
  photographerController.uploadPortfolioImages
);
router.delete("/portfolio/image/delete", auth, photographerController.deletePortfolioImage);

module.exports = router;
