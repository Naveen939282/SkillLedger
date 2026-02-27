/**
 * Challenge Routes
 * Handles skill challenges and submissions
 */

const express = require('express');
const router = express.Router();
const { body, validationResult, param, query } = require('express-validator');
const Challenge = require('../models/Challenge');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { calculateSkillCredibility, updateAllSkillScores } = require('../utils/skillScoring');

/**
 * @route   GET /api/challenges
 * @desc    Get all challenges with filters
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { skill, difficulty, status, page = 1, limit = 10 } = req.query;

    let query = { isActive: true };

    // Filter by skill
    if (skill) {
      query.skill = skill;
    }

    // Filter by difficulty
    if (difficulty) {
      query.difficulty = difficulty;
    }

    // Filter by status (published/draft)
    if (status) {
      query.status = status;
    }

    const challenges = await Challenge.find(query)
      .populate('skill', 'name category')
      .select('-testCases')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Challenge.countDocuments(query);

    res.json({
      success: true,
      challenges,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/challenges/:challengeId
 * @desc    Get challenge details
 * @access  Public
 */
router.get('/:challengeId', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.challengeId)
      .populate('skill', 'name category');

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }

    res.json({
      success: true,
      challenge
    });
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/challenges
 * @desc    Create a new challenge
 * @access  Private (Admin)
 */
router.post('/', protect, authorize('admin'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('skill').notEmpty().withMessage('Skill is required'),
  body('difficulty').isIn(['easy', 'medium', 'hard', 'expert']).withMessage('Invalid difficulty'),
  body('passingScore').isInt({ min: 0, max: 100 }).withMessage('Passing score must be 0-100'),
  body('testCases').isArray({ min: 1 }).withMessage('At least one test case is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      title,
      description,
      skill,
      difficulty,
      passingScore,
      testCases,
      timeLimit,
      hints,
      resources
    } = req.body;

    const challenge = await Challenge.create({
      title,
      description,
      skill,
      difficulty,
      passingScore,
      testCases,
      timeLimit,
      hints,
      resources,
      createdBy: req.user.id,
      status: 'published'
    });

    res.status(201).json({
      success: true,
      challenge
    });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/challenges/:challengeId/submit
 * @desc    Submit a challenge attempt
 * @access  Private (Student)
 */
router.post('/:challengeId/submit', protect, authorize('student'), [
  body('content').notEmpty().withMessage('Submission content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const challenge = await Challenge.findById(req.params.challengeId);
    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }

    // Check for existing submissions to count attempts
    const existingSubmissions = await Submission.countDocuments({
      user: req.user.id,
      challenge: challenge._id
    });

    const { content, submissionUrl } = req.body;

    // Create submission
    const submission = await Submission.create({
      user: req.user.id,
      challenge: challenge._id,
      content,
      submissionUrl,
      attemptNumber: existingSubmissions + 1,
      submittedAt: Date.now()
    });

    // Auto-grade if possible (basic implementation)
    // In production, this would be more sophisticated
    let score = 0;
    let autoGradingResults = null;

    if (challenge.testCases && challenge.testCases.length > 0) {
      // Simple test case evaluation
      autoGradingResults = evaluateTestCases(content, challenge.testCases);
      score = autoGradingResults.score;
    }

    // Update submission with score
    submission.score = score;
    submission.isPassed = score >= challenge.passingScore;
    submission.autoGradingResults = autoGradingResults;
    
    if (submission.isPassed) {
      submission.isVerified = true;
      submission.verifiedAt = Date.now();
    }

    await submission.save();

    // Update user stats
    const user = await User.findById(req.user.id);
    user.totalChallengesAttempted += 1;
    if (submission.isPassed) {
      user.totalChallengesPassed += 1;
    }
    await user.save();

    // Update skill credibility if passed
    if (submission.isPassed) {
      await updateAllSkillScores(req.user.id);
    }

    res.status(201).json({
      success: true,
      submission: {
        id: submission._id,
        score: submission.score,
        isPassed: submission.isPassed,
        isVerified: submission.isVerified,
        attemptNumber: submission.attemptNumber,
        submittedAt: submission.submittedAt,
        autoGradingResults
      }
    });
  } catch (error) {
    console.error('Submit challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/challenges/:challengeId/submissions
 * @desc    Get user's submissions for a challenge
 * @access  Private (Student)
 */
router.get('/:challengeId/submissions', protect, async (req, res) => {
  try {
    const submissions = await Submission.find({
      user: req.user.id,
      challenge: req.params.challengeId
    }).sort({ submittedAt: -1 });

    res.json({
      success: true,
      submissions
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/challenges/my
 * @desc    Get challenges relevant to user's skills
 * @access  Private (Student)
 */
router.get('/my/relevant', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('skills.skill');

    if (!user.skills.length) {
      return res.json({
        success: true,
        challenges: [],
        message: 'Add skills to see relevant challenges'
      });
    }

    // Get skill IDs
    const skillIds = user.skills.map(s => s.skill._id);

    // Find challenges for these skills
    const challenges = await Challenge.find({
      skill: { $in: skillIds },
      isActive: true,
      status: 'published'
    })
      .populate('skill', 'name category')
      .select('-testCases')
      .limit(20);

    res.json({
      success: true,
      challenges
    });
  } catch (error) {
    console.error('Get relevant challenges error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Helper function to evaluate test cases
 * Basic implementation - in production would be more sophisticated
 */
function evaluateTestCases(content, testCases) {
  let passedCount = 0;
  const results = [];

  // This is a placeholder - actual implementation depends on challenge type
  // For code challenges, would execute code against test cases
  // For quiz challenges, would check answers
  
  testCases.forEach((testCase, index) => {
    // Basic check - in reality would run actual tests
    const passed = true; // Placeholder
    if (passed) passedCount++;
    
    results.push({
      testCase: index + 1,
      passed,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: '...' // Would be actual output
    });
  });

  const score = Math.round((passedCount / testCases.length) * 100);

  return {
    score,
    totalTests: testCases.length,
    passedTests: passedCount,
    results
  };
}

module.exports = router;
