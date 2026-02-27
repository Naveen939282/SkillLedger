/**
 * Skill Model
 * Represents individual skills in the SkillLedger system
 * Skills are the core entities that users can possess and verify
 */

const mongoose = require('mongoose');

/**
 * Skill Schema Definition
 */
const skillSchema = new mongoose.Schema({
  // Basic skill information
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: [
      'technical', 'soft', 'business', 'creative', 'language',
      'leadership', 'analytical', 'communication', 'project-management'
    ]
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Skill metadata
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  
  // Verification requirements
  verificationMethods: [{
    type: {
      type: String,
      enum: ['challenge', 'endorsement', 'project', 'certification'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    }
  }],
  
  // Skill relationships (for graph visualization)
  relatedSkills: [{
    skill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill'
    },
    relationship: {
      type: String,
      enum: ['prerequisite', 'complementary', 'alternative', 'advanced'],
      default: 'complementary'
    },
    strength: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  }],
  
  // Popularity and usage metrics
  popularity: {
    type: Number,
    default: 0,
    min: 0
  },
  totalUsers: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Administrative fields
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Virtual field for skill URL slug
 */
skillSchema.virtual('slug').get(function() {
  return this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
});

/**
 * Index for efficient queries
 */
skillSchema.index({ name: 1 });
skillSchema.index({ category: 1 });
skillSchema.index({ difficulty: 1 });
skillSchema.index({ isActive: 1 });
skillSchema.index({ popularity: -1 });

/**
 * Pre-save middleware to update popularity
 */
skillSchema.pre('save', function(next) {
  if (this.isModified('totalUsers')) {
    // Simple popularity calculation based on users
    this.popularity = Math.min(this.totalUsers * 10, 1000);
  }
  next();
});

/**
 * Static method to find related skills
 * @param {ObjectId} skillId - The skill ID to find relations for
 * @param {Number} limit - Maximum number of related skills to return
 */
skillSchema.statics.findRelatedSkills = async function(skillId, limit = 10) {
  const skill = await this.findById(skillId);
  if (!skill) return [];
  
  const relatedSkillIds = skill.relatedSkills.map(rel => rel.skill);
  
  return this.find({
    _id: { $in: relatedSkillIds },
    isActive: true
  }).limit(limit);
};

/**
 * Static method to search skills by name or category
 * @param {String} query - Search query
 * @param {Object} filters - Additional filters
 */
skillSchema.statics.search = async function(query, filters = {}) {
  const searchRegex = new RegExp(query, 'i');
  
  const searchQuery = {
    $or: [
      { name: searchRegex },
      { description: searchRegex },
      { category: searchRegex }
    ],
    isActive: true,
    ...filters
  };
  
  return this.find(searchQuery).sort({ popularity: -1 });
};

/**
 * Method to add a related skill
 * @param {ObjectId} relatedSkillId - The related skill ID
 * @param {String} relationship - Type of relationship
 * @param {Number} strength - Strength of relationship (0-1)
 */
skillSchema.methods.addRelatedSkill = async function(relatedSkillId, relationship = 'complementary', strength = 0.5) {
  // Check if relationship already exists
  const existingRelation = this.relatedSkills.find(rel => 
    rel.skill.toString() === relatedSkillId.toString()
  );
  
  if (existingRelation) {
    existingRelation.relationship = relationship;
    existingRelation.strength = strength;
  } else {
    this.relatedSkills.push({
      skill: relatedSkillId,
      relationship,
      strength
    });
  }
  
  await this.save();
  
  // Add reciprocal relationship if complementary
  if (relationship === 'complementary') {
    const relatedSkill = await this.constructor.findById(relatedSkillId);
    if (relatedSkill) {
      await relatedSkill.addRelatedSkill(this._id, 'complementary', strength);
    }
  }
};

module.exports = mongoose.model('Skill', skillSchema);
