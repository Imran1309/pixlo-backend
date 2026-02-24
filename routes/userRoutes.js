const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/me', auth, userController.getMe);
router.patch('/me', auth, upload.single('profilePic'), userController.updateMe);

module.exports = router;
