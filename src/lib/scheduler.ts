import { Schedule } from '../models/Schedule';
import { 
  AvoidBackToBackGames,
  AvoidFirstAndLastGame,
  AvoidReffingBeforePlaying
} from '../models/ScheduleRule';

/**
 * Create a schedule with default rules
 * @param {Array} matches - Array of Match objects
 * @returns {Schedule} New schedule with default rules
 */
export function createSchedule(matches) {
  const schedule = new Schedule(matches);
  
  // Add default rules with priorities
  schedule.addRule(new AvoidBackToBackGames(5)); // Priority 5 (highest)
  schedule.addRule(new AvoidReffingBeforePlaying(3)); // Priority 3 (medium)
  schedule.addRule(new AvoidFirstAndLastGame(1)); // Priority 1 (lowest)
  
  return schedule;
}

/**
 * Optimize a schedule to minimize rule violations
 * @param {Schedule} schedule - Schedule to optimize
 * @param {Object} options - Optimization options
 * @param {number} options.iterations - Number of iterations (default: 10000)
 * @param {Function} options.progressCallback - Callback for progress updates
 * @returns {Schedule} Optimized schedule
 */
export async function optimizeSchedule(schedule, options = {}) {
  const iterations = options.iterations || 10000;
  const progressCallback = options.progressCallback || (() => {});
  
  // Initial evaluation
  schedule.evaluate();
  
  // Setup for optimization
  let currentSchedule = schedule;
  let bestSchedule = schedule;
  let bestScore = schedule.score;
  
  const initialTemperature = 100;
  const coolingRate = 0.995;
  let temperature = initialTemperature;
  
  // Optimization loop
  for (let i = 0; i < iterations; i++) {
    // Allow for progress updates and cancellation
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      progressCallback({
        iteration: i,
        progress: i / iterations,
        currentScore: currentSchedule.score,
        bestScore,
        temperature,
        violations: bestSchedule.violations
      });
    }
    
    // Create a new candidate solution
    const newSchedule = currentSchedule.randomize();
    newSchedule.evaluate();
    
    // Calculate acceptance probability
    const acceptanceProbability = getAcceptanceProbability(
      currentSchedule.score,
      newSchedule.score,
      temperature
    );
    
    // Decide whether to accept the new solution
    if (Math.random() < acceptanceProbability) {
      currentSchedule = newSchedule;
      
      // Update best schedule if needed
      if (newSchedule.score < bestScore) {
        bestSchedule = newSchedule;
        bestScore = newSchedule.score;
      }
    }
    
    // Cool down
    temperature *= coolingRate;
  }
  
  // Final progress update
  progressCallback({
    iteration: iterations,
    progress: 1,
    currentScore: currentSchedule.score,
    bestScore,
    temperature,
    violations: bestSchedule.violations
  });
  
  return bestSchedule;
}

/**
 * Calculate acceptance probability for simulated annealing
 * @param {number} currentScore - Current solution score
 * @param {number} newScore - New solution score
 * @param {number} temperature - Current temperature
 * @returns {number} Probability of accepting the new solution
 */
function getAcceptanceProbability(currentScore, newScore, temperature) {
  // Always accept better solutions
  if (newScore < currentScore) {
    return 1.0;
  }
  
  // Calculate probability of accepting worse solutions
  return Math.exp((currentScore - newScore) / temperature);
}

/**
 * Create a block schedule format by division
 * @param {Array} matches - Array of Match objects
 * @param {string} divisionOrder - Order of divisions, comma-separated
 * @returns {Array} Rearranged matches with updated time slots
 */
export function createDivisionBlocks(matches, divisionOrder) {
  // Parse division order
  const divisions = divisionOrder.split(',').map(d => d.trim());
  
  // Group matches by division
  const matchesByDivision = {};
  divisions.forEach(div => {
    matchesByDivision[div] = [];
  });
  
  // Add matches to their respective divisions
  matches.forEach(match => {
    if (matchesByDivision[match.division]) {
      matchesByDivision[match.division].push(match);
    }
  });
  
  // Create new array of matches with updated time slots
  const newMatches = [];
  let currentTimeSlot = 1;
  
  divisions.forEach(division => {
    const divMatches = matchesByDivision[division];
    
    divMatches.forEach(match => {
      // Create a new match object with updated time slot
      const newMatch = { ...match, timeSlot: currentTimeSlot };
      newMatches.push(newMatch);
      currentTimeSlot++;
    });
  });
  
  return newMatches;
}