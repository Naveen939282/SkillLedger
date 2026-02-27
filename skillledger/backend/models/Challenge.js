/**
 * Challenge Model
 * Represents micro skill challenges that users can attempt
 * Challenges are the primary method for skill verification
 */

const mongoose = require('mongoose');

/**
 * Challenge Schema Definition
 */
const challengeSchema = new mongoose.Schema({
  // Challenge basic information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  instructions: {
    type: String,
    required: true,
    maxlength: 5000
  },
  
  // Skill association
  skill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: true
  },
  
  // Challenge metadata
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    required: true
  },
  category: {
    type: String,
    enum: ['coding', 'design', 'analysis', 'writing', 'presentation', 'problem-solving'],
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Challenge content and requirements
  content: {
    type: mongoose.Schema.Types.Mixed, // Flexible for different challenge types
    required: true
  },
  timeLimit: {
    type: Number, // in minutes
    default: 60
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  passingScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 70
  },
  
  // Scoring
  maxScore: {
    type: Number,
    default: 100
  },
  points: {
    type: Number,
    default: 10,
    min: 1
  },
  
  // Verification criteria
  verificationCriteria: [{
    criterion: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    },
    autoVerify: {
      type: Boolean,
      default: false
    }
  }],
  
  // Submission requirements
  submissionFormat: {
    type: String,
    enum: ['code', 'file', 'text', 'url', 'json'],
    default: 'text'
  },
  allowedLanguages: [{
    type: String
  }],
  
  // Challenge status
  isActive: {
    type: Boolean,
    default: true
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  
  // Creator information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Statistics
  totalAttempts: {
    type: Number,
    default: 0
  },
  successRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  averageScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Virtual field for difficulty color (for UI)
 */
challengeSchema.virtual('difficultyColor').get(function() {
  const colors = {
    'easy': '#22c55e',
    'medium': '#f59e0b',
    'hard': '#ef4444',
    'expert': '#8b5cf6'
  };
  return colors[this.difficulty] || '#6b7280';
});

/**
 * Index for efficient queries
 */
challengeSchema.index({ skill: 1 });
challengeSchema.index({ difficulty: 1 });
challengeSchema.index({ category: 1 });
challengeSchema.index({ isActive: 1 });
challengeSchema.index({ createdBy: 1 });
challengeSchema.index({ tags: 1 });
challengeSchema.index({ createdAt: -1 });

/**
 * Pre-save middleware to update statistics
 */
challengeSchema.pre('save', function(next) {
  if (this.isModified('totalAttempts') && this.totalAttempts > 0) {
    // Calculate average score would be updated separately
  }
  next();
});

/**
 * Static method to find challenges by skill
 * @param {ObjectId} skillId - The skill ID
 * @param {Object} filters - Additional filters
 */
challengeSchema.statics.findBySkill = async function(skillId, filters = {}) {
  return this.find({
    skill: skillId,
    isActive: true,
    ...filters
  }).sort({ difficulty: 1, createdAt: -1 });
};

/**
 * Static method to find challenges by difficulty
 * @param {String} difficulty - The difficulty level
 * @param {Number} limit - Maximum results
 */
challengeSchema.statics.findByDifficulty = async function(difficulty, limit = 20) {
  return this.find({
    difficulty,
    isActive: true
  })
    .populate('skill', 'name category')
    .populate('createdBy', 'profile.firstName profile.lastName')
    .sort({ successRate: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Challenge', challengeSchema);
