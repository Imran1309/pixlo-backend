const User = require('../models/User');

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -otp -otpExpires');
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.updateMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, phone, gender, country, latitude, longitude, languages } = req.body;
        let profilePic = req.body.profilePic;
        if (req.file) {
            // Cloudinary storage attaches the full URL to req.file.path
            profilePic = req.file.path;
        }

        const updates = {};
        if (name) updates.name = name;
        if (phone) updates.phone = phone;
        if (gender) updates.gender = gender;
        if (country) updates.country = country;
        if (latitude && longitude) {
            updates.location = {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
            };
        }
        if (languages) {
            // Handle if languages is sent as a single string or array
            updates.languages = Array.isArray(languages) ? languages : [languages];
        }
        if (profilePic) updates.profilePic = profilePic;

        const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select('-password');

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};
