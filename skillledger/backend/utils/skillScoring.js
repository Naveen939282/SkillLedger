/**
 * Skill Scoring Algorithm
 * Core algorithm logic for calculating skill credibility scores
 * 
 * This module implements a weighted scoring system that combines:
 * - Challenge completion scores
 * - Peer endorsement scores
 * - Skill proficiency levels
 * - Time-based decay factors
 */

const Submission = require('../models/Submission');
const Endorsement = require('../models/Endorsement');
const User = require('../models/User');

/**
 * Configuration weights for scoring components
 */
const SCORING_WEIGHTS = {
  challenge: {
    passed: 40,    // Weight for passing a challenge
    score: 30,     // Weight for score achieved
    recency: 20,   // Weight for recency of completion
    difficulty: 10 // Weight bonus for harder challenges
  },
  endorsement: {
    level: 50,     // Weight for endorsement level
    weight: 30,    // Weight for endorser's credibility
    count: 20      // Weight for number of endorsements
  },
  proficiency: {
    base: 25,      // Base score for having skill
    level: 50,     // Weight for proficiency level
    experience: 25 // Weight for years of experience
  }
};

/**
 * Level numeric values for calculations
 */
const LEVEL_VALUES = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4
};

const DIFFICULTY_MULTIPLIERS = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  expert: 3
};

/**
 * Calculate skill credibility score for a user
 * @param {ObjectId} userId - The user's ID
 * @param {ObjectId} skillId - The skill's ID
 * @returns {Object} Score breakdown and total score
 */
async function calculateSkillCredibility(userId, skillId) {
  try {
    // Get all components
    const challengeScore = await calculateChallengeScore(userId, skillId);
    const endorsementScore = await calculateEndorsementScore(userId, skillId);
    const proficiencyScore = await calculateProficiencyScore(userId, skillId);
    
    // Apply time decay
    const decayFactor = await calculateTimeDecay(userId, skillId);
    
    // Calculate weighted total
    const totalScore = Math.round(
      (challengeScore * 0.4 + endorsementScore * 0.35 + proficiencyScore * 0.25) * decayFactor
    );
    
    return {
      totalScore: Math.min(totalScore, 100),
      breakdown: {
        challengeScore,
        endorsementScore,
        proficiencyScore,
        decayFactor
      },
      isVerified: challengeScore >= 30 || endorsementScore >= 40
    };
  } catch (error) {
    console.error('Error calculating skill credibility:', error);
    return {
      totalScore: 0,
      breakdown: {
        challengeScore: 0,
        endorsementScore: 0,
        proficiencyScore: 0,
        decayFactor: 1
      },
      isVerified: false,
      error: error.message
    };
  }
}

/**
 * Calculate score from challenge completions
 * @param {ObjectId} userId - The user's ID
 * @param {ObjectId} skillId - The skill's ID
 * @returns {Number} Challenge score (0-100)
 */
async function calculateChallengeScore(userId, skillId) {
  const submissions = await Submission.find({
    user: userId,
    isVerified: true,
    isPassed: true
  }).populate('challenge');
  
  if (submissions.length === 0) return 0;
  
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  for (const submission of submissions) {
    // Check if submission is for this skill
    if (submission.challenge.skill.toString() !== skillId.toString()) continue;
    
    const difficulty = submission.challenge.difficulty;
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1;
    
    // Base score from challenge pass
    let score = SCORING_WEIGHTS.challenge.passed;
    
    // Add score based on achieved score
    score += (submission.score / 100) * SCORING_WEIGHTS.challenge.score;
    
    // Add difficulty bonus
    score *= difficultyMultiplier;
    
    // Calculate recency factor (more recent = higher)
    const daysSinceSubmission = (Date.now() - submission.submittedAt) / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.max(0, 1 - (daysSinceSubmission / 365)); // Decay over 1 year
    score += recencyFactor * SCORING_WEIGHTS.challenge.recency;
    
    totalScore += score;
    maxPossibleScore += 100 * difficultyMultiplier;
  }
  
  return maxPossibleScore > 0 ? Math.min((totalScore / maxPossibleScore) * 100, 100) : 0;
}

/**
 * Calculate score from endorsements
 * @param {ObjectId} userId - The user's ID
 * @param {ObjectId} skillId - The skill's ID
 * @returns {Number} Endorsement score (0-100)
 */
async function calculateEndorsementScore(userId, skillId) {
  const endorsements = await Endorsement.find({
    recipient: userId,
    skill: skillId,
    isValid: true
  }).populate('endorser');
  
  if (endorsements.length === 0) return 0;
  
  let totalLevelScore = 0;
  let totalWeightScore = 0;
  
  for (const endorsement of endorsements) {
    // Level score
    const levelValue = LEVEL_VALUES[endorsement.level] || 1;
    totalLevelScore += levelValue;
    
    // Weight score based on endorser's credibility
    const endorserCredibility = endorsement.endorser.credibilityScore || 0;
    totalWeightScore += endorserCredibility * endorsement.weight;
  }
  
  // Normalize
  const maxLevelScore = endorsements.length * 4; // Max is expert (4)
  const maxWeightScore = endorsements.length * 100;
  
  const normalizedLevel = (totalLevelScore / maxLevelScore) * SCORING_WEIGHTS.endorsement.level;
  const normalizedWeight = (totalWeightScore / maxWeightScore) * SCORING_WEIGHTS.endorsement.weight;
  
  // Count bonus (more endorsements = slightly higher score)
  const countBonus = Math.min(endorsements.length * 2, SCORING_WEIGHTS.endorsement.count);
  
  return Math.min(normalizedLevel + normalizedWeight + countBonus, 100);
}

/**
 * Calculate score from proficiency level
 * @param {ObjectId} userId - The user's ID
 * @param {ObjectId} skillId - The skill's ID
 * @returns {Number} Proficiency score (0-100)
 */
async function calculateProficiencyScore(userId, skillId) {
  const user = await User.findById(userId);
  if (!user) return 0;
  
  const userSkill = user.skills.find(s => s.skill.toString() === skillId.toString());
  if (!userSkill) return 0;
  
  // Base score for having the skill
  let score = SCORING_WEIGHTS.proficiency.base;
  
  // Level score (1-10 scale to 0-50)
  score += (userSkill.proficiencyLevel / 10) * SCORING_WEIGHTS.proficiency.level;
  
  // Experience bonus (max 10 years = 25 points)
  const experienceBonus = Math.min(userSkill.yearsOfExperience, 10) / 10 * SCORING_WEIGHTS.proficiency.experience;
  score += experienceBonus;
  
  return Math.min(score, 100);
}

/**
 * Calculate time decay factor
 * Skills that haven't been updated recently get a lower score
 * @param {ObjectId} userId - The user's ID
 * @param {ObjectId} skillId - The skill's ID
 * @returns {Number} Decay factor (0.5-1)
 */
async function calculateTimeDecay(userId, skillId) {
  const user = await User.findById(userId);
  if (!user) return 1;
  
  const userSkill = user.skills.find(s => s.skill.toString() === skillId.toString());
  if (!userSkill) return 1;
  
  const daysSinceUpdate = (Date.now() - userSkill.lastUpdated) / (1000 * 60 * 60 * 24);
  
  // Decay starts after 90 days, max decay to 0.5 after 2 years
  if (daysSinceUpdate < 90) return 1;
  
  const decay = 1 - ((daysSinceUpdate - 90) / (365 * 2));
  return Math.max(0.5, Math.min(decay, 1));
}

/**
 * Update all skill scores for a user
 * @param {ObjectId} userId - The user's ID
 */
async function updateAllSkillScores(userId) {
  const user = await User.findById(userId);
  if (!user) return;
  
  for (const userSkill of user.skills) {
    const result = await calculateSkillCredibility(userId, userSkill.skill);
    
    // Update user's skill
    userSkill.credibilityScore = result.totalScore;
    userSkill.isVerified = result.isVerified;
    userSkill.lastUpdated = Date.now();
  }
  
  // Recalculate overall credibility score
  await user.updateCredibilityScore();
  await user.save();
}

/**
 * Calculate overall user credibility score
 * @param {ObjectId} userId - The user's ID
 * @returns {Number} Overall credibility score (0-100)
 */
async function calculateOverallCredibility(userId) {
  const user = await User.findById(userId);
  if (!user || user.skills.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const userSkill of user.skills) {
    // Weight by proficiency and experience
    const weight = userSkill.proficiencyLevel * (userSkill.yearsOfExperience + 1);
    weightedSum += userSkill.credibilityScore * weight;
    totalWeight += weight;
  }
  
  return Math.round(weightedSum / totalWeight);
}

module.exports = {
  calculateSkillCredibility,
  calculateChallengeScore,
  calculateEndorsementScore,
  calculateProficiencyScore,
  calculateTimeDecay,
  updateAllSkillScores,
  calculateOverallCredibility,
  SCORING_WEIGHTS,
  LEVEL_VALUES,
  DIFFICULTY_MULTIPLIERS
};
