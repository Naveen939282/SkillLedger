/**
 * User Routes
 * Handles user profile and skill management
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Skill = require('../models/Skill');
const { protect, authorize } = require('../middleware/auth');
const { updateAllSkillScores } = require('../utils/skillScoring');

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('skills.skill', 'name category description');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', protect, [
  body('profile.firstName').optional().trim().notEmpty(),
  body('profile.lastName').optional().trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { profile } = req.body;
    const user = await User.findById(req.user.id);

    // Update profile fields
    if (profile) {
      Object.keys(profile).forEach(key => {
        if (user.profile[key] !== undefined) {
          user.profile[key] = profile[key];
        }
      });
    }

    await user.save();

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/users/skills
 * @desc    Add a skill to user profile
 * @access  Private (Student)
 */
router.post('/skills', protect, authorize('student'), [
  body('skillId').notEmpty().withMessage('Skill ID is required'),
  body('proficiencyLevel').isInt({ min: 1, max: 10 }).withMessage('Proficiency level must be 1-10'),
  body('yearsOfExperience').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { skillId, proficiencyLevel, yearsOfExperience } = req.body;

    // Check if skill exists
    const skill = await Skill.findById(skillId);
    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    const user = await User.findById(req.user.id);

    // Check if user already has this skill
    const existingSkill = user.skills.find(s => s.skill.toString() === skillId);
    if (existingSkill) {
      return res.status(400).json({
        success: false,
        message: 'Skill already exists in your profile'
      });
    }

    // Add skill to user
    user.skills.push({
      skill: skillId,
      proficiencyLevel,
      yearsOfExperience: yearsOfExperience || 0,
      credibilityScore: 0,
      addedAt: Date.now(),
      lastUpdated: Date.now()
    });

    await user.save();

    // Update skill's total users count
    skill.totalUsers += 1;
    await skill.save();

    res.status(201).json({
      success: true,
      message: 'Skill added successfully',
      skills: user.skills
    });
  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   PUT /api/users/skills/:skillId
 * @desc    Update user's skill proficiency
 * @access  Private (Student)
 */
router.put('/skills/:skillId', protect, authorize('student'), [
  body('proficiencyLevel').isInt({ min: 1, max: 10 }),
  body('yearsOfExperience').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { proficiencyLevel, yearsOfExperience } = req.body;
    const user = await User.findById(req.user.id);

    // Find user's skill
    const userSkill = user.skills.find(s => s.skill.toString() === req.params.skillId);
    if (!userSkill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found in your profile'
      });
    }

    // Update skill
    userSkill.proficiencyLevel = proficiencyLevel;
    if (yearsOfExperience !== undefined) {
      userSkill.yearsOfExperience = yearsOfExperience;
    }
    userSkill.lastUpdated = Date.now();

    await user.save();

    // Recalculate credibility scores
    await updateAllSkillScores(req.user.id);

    res.json({
      success: true,
      message: 'Skill updated successfully',
      user
    });
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   DELETE /api/users/skills/:skillId
 * @desc    Remove a skill from user profile
 * @access  Private (Student)
 */
router.delete('/skills/:skillId', protect, authorize('student'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Find and remove skill
    const skillIndex = user.skills.findIndex(s => s.skill.toString() === req.params.skillId);
    if (skillIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found in your profile'
      });
    }

    user.skills.splice(skillIndex, 1);
    await user.save();

    // Recalculate scores
    await updateAllSkillScores(req.user.id);

    res.json({
      success: true,
      message: 'Skill removed successfully'
    });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/users/credibility
 * @desc    Get user's credibility score breakdown
 * @access  Private
 */
router.get('/credibility', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('skills.skill', 'name category');

    // Calculate detailed credibility breakdown
    const breakdown = {
      overallScore: user.credibilityScore,
      totalSkills: user.skills.length,
      verifiedSkills: user.skills.filter(s => s.isVerified).length,
      totalEndorsements: user.totalEndorsementsReceived,
      challengesAttempted: user.totalChallengesAttempted,
      challengesPassed: user.totalChallengesPassed,
      skills: user.skills.map(s => ({
        name: s.skill?.name,
        category: s.skill?.category,
        credibilityScore: s.credibilityScore,
        isVerified: s.isVerified,
        proficiencyLevel: s.proficiencyLevel,
        yearsOfExperience: s.yearsOfExperience,
        lastUpdated: s.lastUpdated
      }))
    };

    res.json({
      success: true,
      credibility: breakdown
    });
  } catch (error) {
    console.error('Get credibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
