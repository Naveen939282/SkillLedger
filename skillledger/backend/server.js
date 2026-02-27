/**
 * SkillLedger Backend Server
 * Dynamic & Verifiable Human Skill Graph System
 * 
 * Main entry point for the Express server
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const skillRoutes = require('./routes/skills');
const challengeRoutes = require('./routes/challenges');
const endorsementRoutes = require('./routes/endorsements');
const searchRoutes = require('./routes/search');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * Middleware Configuration
 */
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'SkillLedger API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/endorsements', endorsementRoutes);
app.use('/api/search', searchRoutes);

/**
 * Error Handling Middleware
 */
app.use(notFound);
app.use(errorHandler);

/**
 * Database Connection & Server Start
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillledger';
    await mongoose.connect(mongoURI);
    console.log('✓ Connected to MongoDB');

    // Start server
    app.listen(PORT, () => {
      console.log(`✓ SkillLedger API running on port ${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  // Close server & exit process
  // server.close(() => process.exit(1));
});

startServer();

module.exports = app;
