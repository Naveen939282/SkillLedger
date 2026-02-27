/**
 * Recruiter Routes
 * Handles recruiter-specific functionality
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Skill = require('../models/Skill');
const { protect, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/recruiters/search
 * @desc    Search users by skills and filters
 * @access  Private (Recruiter)
 */
router.get('/search', protect, authorize('recruiter'), async (req, res) => {
  try {
    const {
      skills,
      minCredibility,
      maxCredibility,
      proficiencyLevel,
      location,
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    let query = { role: 'student', isActive: true };

    // Skill filtering
    if (skills) {
      const skillIds = skills.split(',').map(id => id.trim());
      query['skills.skill'] = { $in: skillIds };
    }

    // Credibility score filtering
    if (minCredibility || maxCredibility) {
      query.credibilityScore = {};
      if (minCredibility) query.credibilityScore.$gte = parseInt(minCredibility);
      if (maxCredibility) query.credibilityScore.$lte = parseInt(maxCredibility);
    }

    // Proficiency level filtering
    if (proficiencyLevel) {
      query['skills.proficiencyLevel'] = { $gte: parseInt(proficiencyLevel) };
    }

    // Location filtering
    if (location) {
      query['profile.location'] = new RegExp(location, 'i');
    }

    // Execute search
    const users = await User.find(query)
      .populate('skills.skill', 'name category')
      .select('profile credibilityScore skills')
      .sort({ credibilityScore: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/recruiters/users/:userId
 * @desc    Get detailed user profile for recruiter
 * @access  Private (Recruiter)
 */
router.get('/users/:userId', protect, authorize('recruiter'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('skills.skill', 'name category description')
      .select('-password -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is a student
    if (user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/recruiters/skills
 * @desc    Get all available skills for filtering
 * @access  Private (Recruiter)
 */
router.get('/skills', protect, authorize('recruiter'), async (req, res) => {
  try {
    const skills = await Skill.find({ isActive: true })
      .select('name category description totalUsers')
      .sort({ totalUsers: -1 });

    res.json({
      success: true,
      skills
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/recruiters/analytics
 * @desc    Get recruiter analytics data
 * @access  Private (Recruiter)
 */
router.get('/analytics', protect, authorize('recruiter'), async (req, res) => {
  try {
    // Get skill distribution
    const skillStats = await User.aggregate([
      { $match: { role: 'student', isActive: true } },
      { $unwind: '$skills' },
      {
        $lookup: {
          from: 'skills',
          localField: 'skills.skill',
          foreignField: '_id',
          as: 'skillInfo'
        }
      },
      { $unwind: '$skillInfo' },
      {
        $group: {
          _id: '$skillInfo.name',
          count: { $sum: 1 },
          avgProficiency: { $avg: '$skills.proficiencyLevel' },
          avgCredibility: { $avg: '$skills.credibilityScore' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get credibility score distribution
    const credibilityStats = await User.aggregate([
      { $match: { role: 'student', isActive: true } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $gte: ['$credibilityScore', 80] }, then: '80-100' },
                { case: { $gte: ['$credibilityScore', 60] }, then: '60-79' },
                { case: { $gte: ['$credibilityScore', 40] }, then: '40-59' },
                { case: { $gte: ['$credibilityScore', 20] }, then: '20-39' }
              ],
              default: '0-19'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      success: true,
      analytics: {
        skillStats,
        credibilityStats
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/recruiters/export
 * @desc    Export candidate data
 * @access  Private (Recruiter)
 */
router.post('/export', protect, authorize('recruiter'), [
  body('userIds').isArray().withMessage('User IDs must be an array'),
  body('format').isIn(['json', 'csv']).withMessage('Format must be json or csv')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userIds, format } = req.body;

    // Get users data
    const users = await User.find({
      _id: { $in: userIds },
      role: 'student',
      isActive: true
    })
      .populate('skills.skill', 'name category')
      .select('profile credibilityScore skills');

    if (format === 'csv') {
      // Generate CSV
      const csvData = generateCSV(users);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=candidates.csv');
      res.send(csvData);
    } else {
      // Return JSON
      res.json({
        success: true,
        users
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Generate CSV from user data
 * @param {Array} users - Array of user objects
 * @returns {String} CSV string
 */
function generateCSV(users) {
  const headers = [
    'Name',
    'Email',
    'Location',
    'Credibility Score',
    'Skills',
    'Proficiency Levels',
    'Years of Experience'
  ];

  const rows = users.map(user => {
    const skills = user.skills.map(s => s.skill?.name || 'Unknown').join('; ');
    const proficiencies = user.skills.map(s => s.proficiencyLevel).join('; ');
    const experiences = user.skills.map(s => s.yearsOfExperience).join('; ');

    return [
      `${user.profile.firstName} ${user.profile.lastName}`,
      user.email,
      user.profile.location || '',
      user.credibilityScore,
      skills,
      proficiencies,
      experiences
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  return csvContent;
}

module.exports = router;
