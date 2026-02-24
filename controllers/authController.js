const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.googleLogin = async (req, res) => {
    try {
        const { access_token, role } = req.body;

        // specific to Node 18+ fetch
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        if (!response.ok) {
            return res.status(400).json({ message: 'Invalid Google Token' });
        }

        const data = await response.json();
        const { email, name, picture, sub } = data;

        let user = await User.findOne({ email });

        if (!user) {
            // Create a new user if not exists
            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

            // Name splitting safely
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || name;
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
            const finalRole = role && role === 'photographer' ? 'photographer' : 'customer';

            user = new User({
                name,
                email,
                firstName,
                lastName,
                profilePic: picture,
                password: randomPassword,
                role: finalRole,
                isVerified: true, // Google emails are verified
                googleId: sub
            });
            await user.save();

            if (finalRole === 'photographer') {
                const Photographer = require('../models/Photographer');
                const photographer = new Photographer({
                    userId: user._id,
                    startingPrice: 0,
                });
                await photographer.save();
            }
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePic: user.profilePic
            }
        });

    } catch (err) {
        console.error('Google Login Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.facebookLogin = async (req, res) => {
    try {
        const { access_token, role } = req.body;

        // Verify with Facebook Graph API
        const response = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${access_token}`);

        if (!response.ok) {
            return res.status(400).json({ message: 'Invalid Facebook Token' });
        }

        const data = await response.json();
        const { email, name, id } = data;
        let picture = '';
        if (data.picture && data.picture.data && data.picture.data.url) {
            picture = data.picture.data.url;
        }

        if (!email) {
            return res.status(400).json({ message: 'Facebook account must have an email attached' });
        }

        let user = await User.findOne({ email });

        if (!user) {
            // Create a new user if not exists
            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

            // Name splitting safely
            const nameParts = name ? name.split(' ') : ['User'];
            const firstName = nameParts[0] || name;
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
            const finalRole = role && role === 'photographer' ? 'photographer' : 'customer';

            user = new User({
                name: name || 'Facebook User',
                email,
                firstName,
                lastName,
                profilePic: picture,
                password: randomPassword,
                role: finalRole,
                isVerified: true, // Facebook emails are verified
                // Note: could add facebookId to schema if desired
            });
            await user.save();

            if (finalRole === 'photographer') {
                const Photographer = require('../models/Photographer');
                const photographer = new Photographer({
                    userId: user._id,
                    startingPrice: 0,
                });
                await photographer.save();
            }
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePic: user.profilePic
            }
        });

    } catch (err) {
        console.error('Facebook Login Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.register = async (req, res) => {
    try {
        let { name, email, password, role, phone, gender, dob, address, country, city, zipCode, profilePic, portfolio, bio, firstName, lastName } = req.body;
        email = email ? email.trim().toLowerCase() : email;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        const validRoles = ['customer', 'photographer'];
        const userRole = validRoles.includes(role) ? role : 'customer';

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        // Construct address if flattened
        let userAddress = address;
        if (!userAddress && (country || city || zipCode)) {
            userAddress = { country, city, zipCode };
        }

        user = new User({
            name,
            email,
            password,
            role: userRole,
            phone,
            gender,
            dob,
            address: userAddress,
            profilePic: profilePic || "",
            portfolio: portfolio || [],
            bio: bio || "",
            firstName,
            lastName,
            otp,
            otpExpires
        });

        await user.save();

        await transporter.sendMail({
            to: email,
            subject: 'Pixalo Email Verification',
            text: `Your OTP is ${otp}`
        });

        res.status(201).json({ message: 'User registered. Please verify email.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.registerCreator = async (req, res) => {
    try {
        let { firstName, lastName, gender, phone, email, dob, country, city, zipCode, password, profilePic, portfolio, bio } = req.body;
        email = email ? email.trim().toLowerCase() : email;

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        const userPayload = {
            name: `${firstName} ${lastName}`,
            firstName,
            lastName,
            email,
            password,
            gender,
            phone,
            dob,
            address: { country, city, zipCode },
            profilePic: profilePic || "",
            portfolio: portfolio || [],
            bio: bio || "",
            role: 'photographer',
            isVerified: true // Auto-verify creators for now as per requirement for ease
        };

        user = new User(userPayload);
        await user.save();

        if (req.body.role === 'photographer' || userPayload.role === 'photographer') {
            const Photographer = require('../models/Photographer');
            const photographer = new Photographer({
                userId: user._id,
                startingPrice: 0,
                // Initialize other defaults if needed
            });
            await photographer.save();
        }

        res.status(201).json({ message: 'Creator registered successfully. You can now login.' });
    } catch (err) {
        console.error("Creator Registration Error:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Email verified successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const searchVal = email ? email.trim() : "";
        const escapedSearchVal = searchVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const user = await User.findOne({
            $or: [
                { email: { $regex: `^${escapedSearchVal}$`, $options: 'i' } },
                { name: { $regex: `^${escapedSearchVal}$`, $options: 'i' } }
            ]
        });

        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        // if (!user.isVerified) return res.status(400).json({ message: 'Please verify your email first' });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                gender: user.gender,
                dob: user.dob,
                address: user.address,
                profilePic: user.profilePic,
                portfolio: user.portfolio,
                bio: user.bio,
                isVerified: user.isVerified,
                rating: user.rating,
                reviewCount: user.reviewCount
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.resendOtp = async (req, res) => {
    // Implementation for resending OTP
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await User.updateOne({ _id: user._id }, { $set: { otp, otpExpires } });

        await transporter.sendMail({
            to: email,
            subject: 'Pixalo Email Verification (Resend)',
            text: `Your OTP is ${otp}`
        });

        res.json({ message: "OTP resent" });
    } catch (err) {

        res.status(500).json({ message: "Error resending OTP" });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, firstName, lastName, phone, gender, dob, address, country, city, zipCode, profilePic, portfolio, bio } = req.body;

        let user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (name) user.name = name;
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;
        if (gender) user.gender = gender;
        if (dob) user.dob = dob;

        // Handle address update
        if (country || city || zipCode) {
            user.address = {
                country: country || user.address?.country,
                city: city || user.address?.city,
                zipCode: zipCode || user.address?.zipCode
            };
        } else if (address) {
            user.address = address;
        }

        if (profilePic) user.profilePic = profilePic;
        if (portfolio) user.portfolio = portfolio;
        if (bio) user.bio = bio;

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                gender: user.gender,
                dob: user.dob,
                address: user.address,
                profilePic: user.profilePic,
                portfolio: user.portfolio,
                bio: user.bio,
                isVerified: user.isVerified,
                rating: user.rating,
                reviewCount: user.reviewCount
            }
        });
    } catch (err) {
        console.error("Profile Update Error:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await User.updateOne({ _id: user._id }, { $set: { otp, otpExpires } });

        await transporter.sendMail({
            to: email,
            subject: 'Pixalo Password Reset OTP',
            text: `Your OTP for password reset is ${otp}`
        });

        res.json({ message: "OTP sent to email" });
    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ message: "Error sending OTP", error: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if OTP is valid and not expired
        if (user.otp !== otp || (user.otpExpires && user.otpExpires < Date.now())) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Hash new password manually since we bypass pre('save') hook
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.updateOne({ _id: user._id }, {
            $set: { password: hashedPassword },
            $unset: { otp: 1, otpExpires: 1 }
        });

        res.json({ message: "Password reset successfully. Please login." });
    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({ message: "Error resetting password", error: err.message });
    }
};
