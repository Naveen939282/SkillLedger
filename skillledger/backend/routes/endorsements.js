/**
 * Endorsements Routes
 * Handles skill endorsements between users
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Endorsement = require('../models/Endorsement');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { updateAllSkillScores } = require('../utils/skillScoring');

/**
 * @route   POST /api/endorsements
 * @desc    Give an endorsement
 * @access  Private
 */
router.post('/', protect, [
  body('recipient').notEmpty().withMessage('Recipient is required'),
  body('skill').notEmpty().withMessage('Skill is required'),
  body('level').isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid level'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { recipient, skill, level, comment, weight = 1 } = req.body;

    // Check if recipient exists and is a student
    const recipientUser = await User.findById(recipient);
    if (!recipientUser || recipientUser.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found or not a student'
      });
    }

    // Check if user has the skill
    const userSkill = recipientUser.skills.find(s => s.skill.toString() === skill);
    if (!userSkill) {
      return res.status(400).json({
        success: false,
        message: 'Recipient does not have this skill'
      });
    }

    // Check if user already endorsed this skill for this recipient
    const existingEndorsement = await Endorsement.findOne({
      endorser: req.user.id,
      recipient,
      skill,
      isValid: true
    });

    if (existingEndorsement) {
      return res.status(400).json({
        success: false,
        message: 'You have already endorsed this skill for this user'
      });
    }

    // Create endorsement
    const endorsement = await Endorsement.create({
      endorser: req.user.id,
      recipient,
      skill,
      level,
      comment,
      weight
    });

    // Update recipient's endorsement count
    recipientUser.totalEndorsementsReceived += 1;
    await recipientUser.save();

    // Recalculate skill scores
    await updateAllSkillScores(recipient);

    res.status(201).json({
      success: true,
      endorsement
    });
  } catch (error) {
    console.error('Create endorsement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/endorsements/received
 * @desc    Get endorsements received by current user
 * @access  Private
 */
router.get('/received', protect, async (req, res) => {
  try {
    const endorsements = await Endorsement.find({
      recipient: req.user.id,
      isValid: true
    })
      .populate('endorser', 'profile.firstName profile.lastName credibilityScore')
      .populate('skill', 'name category')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      endorsements
    });
  } catch (error) {
    console.error('Get received endorsements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/endorsements/given
 * @desc    Get endorsements given by current user
 * @access  Private
 */
router.get('/given', protect, async (req, res) => {
  try {
    const endorsements = await Endorsement.find({
      endorser: req.user.id,
      isValid: true
    })
      .populate('recipient', 'profile.firstName profile.lastName')
      .populate('skill', 'name category')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      endorsements
    });
  } catch (error) {
    console.error('Get given endorsements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   PUT /api/endorsements/:endorsementId
 * @desc    Update an endorsement
 * @access  Private (Endorser only)
 */
router.put('/:endorsementId', protect, [
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
  body('comment').optional().isLength({ max: 500 }),
  body('weight').optional().isFloat({ min: 0, max: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const endorsement = await Endorsement.findById(req.params.endorsementId);

    if (!endorsement) {
      return res.status(404).json({
        success: false,
        message: 'Endorsement not found'
      });
    }

    // Check if user is the endorser
    if (endorsement.endorser.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this endorsement'
      });
    }

    const { level, comment, weight } = req.body;

    if (level) endorsement.level = level;
    if (comment !== undefined) endorsement.comment = comment;
    if (weight !== undefined) endorsement.weight = weight;

    await endorsement.save();

    // Recalculate scores
    await updateAllSkillScores(endorsement.recipient);

    res.json({
      success: true,
      endorsement
    });
  } catch (error) {
    console.error('Update endorsement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   DELETE /api/endorsements/:endorsementId
 * @desc    Revoke an endorsement
 * @access  Private (Endorser only)
 */
router.delete('/:endorsementId', protect, async (req, res) => {
  try {
    const endorsement = await Endorsement.findById(req.params.endorsementId);

    if (!endorsement) {
      return res.status(404).json({
        success: false,
        message: 'Endorsement not found'
      });
    }

    // Check if user is the endorser
    if (endorsement.endorser.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to revoke this endorsement'
      });
    }

    // Mark as invalid instead of deleting
    endorsement.isValid = false;
    await endorsement.save();

    // Update recipient's count
    const recipient = await User.findById(endorsement.recipient);
    if (recipient) {
      recipient.totalEndorsementsReceived = Math.max(0, recipient.totalEndorsementsReceived - 1);
      await recipient.save();
    }

    // Recalculate scores
    await updateAllSkillScores(endorsement.recipient);

    res.json({
      success: true,
      message: 'Endorsement revoked successfully'
    });
  } catch (error) {
    console.error('Delete endorsement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
