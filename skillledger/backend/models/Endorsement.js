/**
 * Endorsement Model
 * Represents peer endorsements for skills in the SkillLedger system
 * Endorsements are weighted based on endorser's credibility
 */

const mongoose = require('mongoose');

/**
 * Endorsement Schema Definition
 */
const endorsementSchema = new mongoose.Schema({
  // Endorsement basic information
  endorser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  skill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: true
  },
  
  // Endorsement details
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    required: true
  },
  comment: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // Verification and weighting
  isVerified: {
    type: Boolean,
    default: false
  },
  weight: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  
  // Context of endorsement
  context: {
    type: String,
    enum: ['colleague', 'manager', 'client', 'mentor', 'peer', 'team-member'],
    default: 'peer'
  },
  projectName: {
    type: String,
    maxlength: 200,
    default: ''
  },
  
  // Endorsement validity
  isValid: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  
  // Timestamps
  endorsedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Index for efficient queries
 */
endorsementSchema.index({ recipient: 1, skill: 1 });
endorsementSchema.index({ endorser: 1 });
endorsementSchema.index({ skill: 1 });
endorsementSchema.index({ endorsedAt: -1 });

/**
 * Pre-save middleware to calculate weight based on endorser's credibility
 */
endorsementSchema.pre('save', async function(next) {
  if (this.isModified('endorser') || this.isModified('weight')) {
    const endorser = await this.constructor('User').findById(this.endorser);
    if (endorser) {
      // Weight is based on endorser's credibility score
      const endorserCredibility = endorser.credibilityScore || 0;
      // Scale weight: higher credibility = higher weight
      this.weight = Math.min(0.5 + (endorserCredibility / 200), 1);
    }
  }
  next();
});

/**
 * Static method to get endorsements for a user's skill
 * @param {ObjectId} userId - The user ID
 * @param {ObjectId} skillId - The skill ID
 */
endorsementSchema.statics.getForUserSkill = async function(userId, skillId) {
  return this.find({
    recipient: userId,
    skill: skillId,
    isValid: true
  })
    .populate('endorser', 'profile.firstName profile.lastName credibilityScore')
    .sort({ weight: -1, endorsedAt: -1 });
};

/**
 * Static method to calculate weighted endorsement score
 * @param {ObjectId} userId - The user ID
 * @param {ObjectId} skillId - The skill ID
 */
endorsementSchema.statics.calculateEndorsementScore = async function(userId, skillId) {
  const endorsements = await this.find({
    recipient: userId,
    skill: skillId,
    isValid: true
  });
  
  if (endorsements.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  // Level scores
  const levelScores = {
    'beginner': 1,
    'intermediate': 2,
    'advanced': 3,
    'expert': 4
  };
  
  for (const endorsement of endorsements) {
    const levelScore = levelScores[endorsement.level] || 1;
    weightedSum += levelScore * endorsement.weight;
    totalWeight += endorsement.weight;
  }
  
  // Normalize to 0-100 scale
  const maxPossibleScore = 4 * endorsements.length;
  return Math.round((weightedSum / maxPossibleScore) * 100);
};

module.exports = mongoose.model('Endorsement', endorsementSchema);
