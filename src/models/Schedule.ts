import { Match } from './Match';

/**
 * Schedule class represents a tournament schedule
 * with matches and scheduling rules
 */
export class Schedule {
  constructor(matches = [], rules = []) {
    this.matches = matches;
    this.rules = rules;
    this.violations = [];
    this.score = 0; // Lower is better (fewer rule violations)
  }

  /**
   * Add a match to the schedule
   * @param {Match} match - Match to add
   */
  addMatch(match) {
    this.matches.push(match);
  }

  /**
   * Add a scheduling rule
   * @param {ScheduleRule} rule - Rule to add
   */
  addRule(rule) {
    this.rules.push(rule);
  }

  /**
   * Evaluate all rules and calculate score
   * @returns {number} Score (lower is better)
   */
  evaluate() {
    this.violations = [];
    this.score = 0;
    
    // Sort matches by time slot
    this.matches.sort((a, b) => a.timeSlot - b.timeSlot);
    
    // Evaluate each rule
    for (const rule of this.rules) {
      const ruleViolations = rule.evaluate(this);
      this.score += ruleViolations.length * rule.priority;
      this.violations = [...this.violations, ...ruleViolations];
    }
    
    return this.score;
  }

  /**
   * Randomize the schedule while keeping divisions together
   * @returns {Schedule} New randomized schedule
   */
  randomize() {
    // Create a copy of matches
    const newMatches = [...this.matches];
    
    // Group by division
    const divisionMatches = {};
    for (const match of newMatches) {
      if (!divisionMatches[match.division]) {
        divisionMatches[match.division] = [];
      }
      divisionMatches[match.division].push(match);
    }
    
    // Randomize each division's matches
    for (const division in divisionMatches) {
      shuffleArray(divisionMatches[division]);
      
      // Reassign time slots within the division
      const timeSlots = divisionMatches[division].map(m => m.timeSlot).sort((a, b) => a - b);
      divisionMatches[division].forEach((match, index) => {
        match.timeSlot = timeSlots[index];
      });
    }
    
    // Combine all matches back together
    const randomizedMatches = [];
    for (const division in divisionMatches) {
      randomizedMatches.push(...divisionMatches[division]);
    }
    
    // Create and return a new schedule
    return new Schedule(randomizedMatches, this.rules);
  }

  /**
   * Optimize schedule using simulated annealing
   * @param {number} iterations - Number of iterations
   * @returns {Schedule} Optimized schedule
   */
  optimize(iterations = 10000) {
    let currentSchedule = this;
    let currentScore = currentSchedule.evaluate();
    
    let bestSchedule = currentSchedule;
    let bestScore = currentScore;
    
    const initialTemperature = 100;
    const coolingRate = 0.995;
    
    let temperature = initialTemperature;
    
    for (let i = 0; i < iterations; i++) {
      // Create a new candidate solution
      const newSchedule = currentSchedule.randomize();
      const newScore = newSchedule.evaluate();
      
      // Decide whether to accept the new solution
      const acceptanceProbability = getAcceptanceProbability(
        currentScore, 
        newScore, 
        temperature
      );
      
      if (Math.random() < acceptanceProbability) {
        currentSchedule = newSchedule;
        currentScore = newScore;
        
        // Update best schedule if needed
        if (currentScore < bestScore) {
          bestSchedule = currentSchedule;
          bestScore = currentScore;
        }
      }
      
      // Cool down
      temperature *= coolingRate;
    }
    
    return bestSchedule;
  }
}

/**
 * Helper function to calculate acceptance probability
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
 * Helper function to shuffle an array in place
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}