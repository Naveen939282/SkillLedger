/**
 * Submission Model
 * Represents user submissions for skill challenges
 * Tracks challenge attempts, scores, and verification status
 */

const mongoose = require('mongoose');

/**
 * Submission Schema Definition
 */
const submissionSchema = new mongoose.Schema({
  // Submission basic information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  challenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true
  },
  
  // Submission content
  content: {
    type: mongoose.Schema.Types.Mixed, // Flexible for different submission types
    required: true
  },
  submissionUrl: {
    type: String,
    default: null
  },
  
  // Grading and scoring
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  isPassed: {
    type: Boolean,
    default: false
  },
  feedback: {
    type: String,
    default: ''
  },
  
  // Verification details
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  
  // Review details
  reviewStatus: {
    type: String,
    enum: ['pending', 'in-review', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewerComments: {
    type: String,
    default: ''
  },
  
  // Attempt tracking
  attemptNumber: {
    type: Number,
    default: 1
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  
  // Auto-grading results
  autoGradingResults: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Index for efficient queries
 */
submissionSchema.index({ user: 1, challenge: 1 });
submissionSchema.index({ challenge: 1 });
submissionSchema.index({ user: 1 });
submissionSchema.index({ isVerified: 1 });
submissionSchema.index({ submittedAt: -1 });

/**
 * Pre-save middleware to check passing status
 */
submissionSchema.pre('save', function(next) {
  if (this.isModified('score') && this.challenge) {
    // Will be populated when challenge is set
    // For now, mark as passed if score >= passingScore (to be updated)
    this.isPassed = this.score >= 70; // Default, should be challenge.passingScore
  }
  next();
});

/**
 * Static method to get user's best submission for a challenge
 * @param {ObjectId} userId - The user ID
 * @param {ObjectId} challengeId - The challenge ID
 */
submissionSchema.statics.getBestSubmission = async function(userId, challengeId) {
  return this.findOne({
    user: userId,
    challenge: challengeId
  })
    .sort({ score: -1 })
    .limit(1);
};

/**
 * Static method to get user's all submissions for a challenge
 * @param {ObjectId} userId - The user ID
 * @param {ObjectId} challengeId - The challenge ID
 */
submissionSchema.statics.getUserSubmissions = async function(userId, challengeId) {
  return this.find({
    user: userId,
    challenge: challengeId
  })
    .sort({ submittedAt: -1 });
};

module.exports = mongoose.model('Submission', submissionSchema);
