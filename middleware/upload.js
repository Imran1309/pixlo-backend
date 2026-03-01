const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === "true";

let upload;

if (USE_LOCAL_STORAGE) {
  upload = require("./localUpload");
} else {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "photographer_portfolio",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
    },
  });
  upload = multer({ storage });
}

module.exports = upload;
