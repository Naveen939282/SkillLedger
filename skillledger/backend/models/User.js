/**
 * User Model
 * Represents users in the SkillLedger system
 * Supports three roles: Student, Recruiter, Admin
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema Definition
 */
const userSchema = new mongoose.Schema({
  // Basic authentication fields
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false // Don't include in queries by default
  },
  
  // Role-based access control
  role: {
    type: String,
    enum: ['student', 'recruiter', 'admin'],
    default: 'student'
  },
  
  // Profile information
  profile: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    avatar: {
      type: String,
      default: null
    },
    title: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: ''
    },
    location: {
      type: String,
      default: ''
    },
    website: {
      type: String,
      default: null
    },
    linkedIn: {
      type: String,
      default: null
    },
    github: {
      type: String,
      default: null
    }
  },
  
  // Skill management - array of user skills
  skills: [{
    skill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill'
    },
    proficiencyLevel: {
      type: Number,
      min: 1,
      max: 10,
      default: 1
    },
    yearsOfExperience: {
      type: Number,
      default: 0
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    credibilityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Overall credibility score (0-100)
  credibilityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Verification status
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationLevel: {
    type: String,
    enum: ['none', 'basic', 'advanced', 'gold'],
    default: 'none'
  },
  
  // Activity tracking
  totalChallengesAttempted: {
    type: Number,
    default: 0
  },
  totalChallengesPassed: {
    type: Number,
    default: 0
  },
  totalEndorsementsReceived: {
    type: Number,
    default: 0
  },
  
  // Recruiter specific - saved candidates
  savedCandidates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true, // Auto-add createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Virtual field for full name
 */
userSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

/**
 * Index for efficient queries
 */
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'skills.skill': 1 });
userSchema.index({ credibilityScore: -1 });
userSchema.index({ createdAt: -1 });

/**
 * Password Hashing
 * Hash password before saving
 */
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare Password Method
 * @param {string} candidatePassword - Password to compare
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Update Credibility Score
 * Recalculates the overall credibility based on skills and endorsements
 */
userSchema.methods.updateCredibilityScore = async function() {
  if (this.skills.length === 0) {
    this.credibilityScore = 0;
    await this.save();
    return;
  }
  
  // Calculate weighted average of skill credibility scores
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const userSkill of this.skills) {
    const weight = userSkill.proficiencyLevel * userSkill.yearsOfExperience + 1;
    weightedSum += userSkill.credibilityScore * weight;
    totalWeight += weight;
  }
  
  this.credibilityScore = Math.round(weightedSum / totalWeight);
  await this.save();
};

/**
 * Static method to find students by skill
 * @param {Array} skillIds - Array of skill IDs
 * @param {Number} minScore - Minimum credibility score
 */
userSchema.statics.findBySkills = async function(skillIds, minScore = 0) {
  return this.find({
    role: 'student',
    'skills.skill': { $in: skillIds },
    credibilityScore: { $gte: minScore },
    isActive: true
  }).sort({ credibilityScore: -1 });
};

module.exports = mongoose.model('User', userSchema);
