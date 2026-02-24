const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const auth = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/register-creator', authController.registerCreator);
router.post('/login', authController.login);
router.post('/google-login', authController.googleLogin);
router.post('/facebook-login', authController.facebookLogin);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-otp', authController.resendOtp);
router.put('/update-profile', auth, authController.updateProfile);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
