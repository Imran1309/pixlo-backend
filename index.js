require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173', // Adjust based on frontend URL
    credentials: true
}));

// Route Middlewares
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const photographerRoutes = require('./routes/photographerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

// Route Middlewares
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/photographers', photographerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
// Debug environment variables
console.log('Attempting to connect to MongoDB...');
// Mask the password for logging
const uri = process.env.MONGO_URI;
if (uri) {
    const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
    console.log(`Using MONGO_URI: ${maskedUri}`);
} else {
    console.error('MONGO_URI is undefined!');
}

/* 
 * Connect to MongoDB
 * Note: generic options like useNewUrlParser and useUnifiedTopology 
 * are deprecated/default in Mongoose 6+ and can be removed.
 */
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error details:');
        console.error(`Name: ${err.name}`);
        console.error(`Message: ${err.message}`);
        console.error(err);
    });

app.get('/', (req, res) => {
    res.send('Pixalo Backend Running');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
