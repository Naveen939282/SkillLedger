/**
 * Skills Routes
 * Handles skill management and discovery
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Skill = require('../models/Skill');
const { protect, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/skills
 * @desc    Get all skills with filters
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    let query = { isActive: true };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const skills = await Skill.find(query)
      .select('name category description totalUsers avgCredibility')
      .sort({ totalUsers: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Skill.countDocuments(query);

    res.json({
      success: true,
      skills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
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
 * @route   GET /api/skills/categories
 * @desc    Get all skill categories
 * @access  Public
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await Skill.distinct('category', { isActive: true });
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/skills/:skillId
 * @desc    Get skill details
 * @access  Public
 */
router.get('/:skillId', async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.skillId);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    res.json({
      success: true,
      skill
    });
  } catch (error) {
    console.error('Get skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/skills
 * @desc    Create a new skill
 * @access  Private (Admin)
 */
router.post('/', protect, authorize('admin'), [
  body('name').notEmpty().withMessage('Name is required'),
  body('category').notEmpty().withMessage('Category is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, category, description, relatedSkills } = req.body;

    // Check if skill already exists
    const existingSkill = await Skill.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      category 
    });

    if (existingSkill) {
      return res.status(400).json({
        success: false,
        message: 'Skill already exists in this category'
      });
    }

    const skill = await Skill.create({
      name,
      category,
      description,
      relatedSkills: relatedSkills || [],
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      skill
    });
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/skills/:skillId/users
 * @desc    Get users with a specific skill
 * @access  Public
 */
router.get('/:skillId/users', async (req, res) => {
  try {
    const { minCredibility, minProficiency, page = 1, limit = 10 } = req.query;

    const User = require('../models/User');
    
    let query = { 
      role: 'student',
      isActive: true,
      'skills.skill': req.params.skillId
    };

    if (minCredibility) {
      query['skills.$.credibilityScore'] = { $gte: parseInt(minCredibility) };
    }

    if (minProficiency) {
      query['skills.$.proficiencyLevel'] = { $gte: parseInt(minProficiency) };
    }

    const users = await User.find(query)
      .select('profile credibilityScore skills')
      .populate('skills.skill', 'name')
      .sort({ 'skills.$.credibilityScore': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
    console.error('Get skill users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
