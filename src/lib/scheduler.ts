import { Schedule } from '../models/Schedule';
import { Match } from '../models/Match';
import { RuleViolation } from '../models/RuleViolation';
import {
  AvoidBackToBackGames,
  AvoidFirstAndLastGame,
  AvoidReffingBeforePlaying,
  AvoidPlayingAfterSetup,
} from '../models/ScheduleRule';

// Type for optimization progress callback
interface OptimizationProgressInfo {
  iteration: number;
  progress: number;
  currentScore: number;
  bestScore: number;
  temperature: number;
  violations: RuleViolation[];
}

// Type for optimization options
interface OptimizationOptions {
  iterations?: number;
  progressCallback?: (info: OptimizationProgressInfo) => void;
}

/**
 * Create a schedule with default rules
 * @param matches - Array of Match objects
 * @returns New schedule with default rules
 */
export function createSchedule(matches: Match[]): Schedule {
  const schedule = new Schedule(matches);

  // Add default rules with priorities
  schedule.addRule(new AvoidPlayingAfterSetup(10)); // Priority 10 (critical - highest)
  schedule.addRule(new AvoidBackToBackGames(5)); // Priority 5 (high)
  schedule.addRule(new AvoidReffingBeforePlaying(3)); // Priority 3 (medium)
  schedule.addRule(new AvoidFirstAndLastGame(1)); // Priority 1 (lowest)

  return schedule;
}

/**
 * Optimize a schedule to minimize rule violations
 * @param schedule - Schedule to optimize
 * @param options - Optimization options
 * @returns Optimized schedule
 */
export async function optimizeSchedule(schedule: Schedule, options: OptimizationOptions = {}): Promise<Schedule> {
  const iterations = options.iterations || 10000;
  const progressCallback = options.progressCallback || (() => {});

  // Initial evaluation
  schedule.evaluate();
  const originalScore = schedule.score;

  // Helper function to create deep copies of matches
  const copyMatches = (matches: Match[]): Match[] => {
    return matches.map(
      match => new Match(match.team1, match.team2, match.timeSlot, match.field, match.division, match.refereeTeam)
    );
  };

  // Create initial copies for optimization - ensuring we have separate instances with deep copied matches
  let currentSchedule = new Schedule(copyMatches(schedule.matches), [...schedule.rules]);
  currentSchedule.evaluate();

  let bestSchedule = new Schedule(copyMatches(schedule.matches), [...schedule.rules]);
  bestSchedule.evaluate();
  let bestScore = bestSchedule.score;

  // Store the original score in the best schedule
  bestSchedule.originalScore = originalScore;

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
        bestScore: bestScore,
        temperature,
        violations: bestSchedule.violations,
      });
    }

    // Create a new candidate solution
    const newSchedule = currentSchedule.randomize();
    newSchedule.evaluate();

    // Calculate acceptance probability
    const acceptanceProbability = getAcceptanceProbability(currentSchedule.score, newSchedule.score, temperature);

    // Decide whether to accept the new solution
    if (Math.random() < acceptanceProbability) {
      currentSchedule = newSchedule;

      // Update best schedule if needed
      if (newSchedule.score < bestScore) {
        bestSchedule = new Schedule(copyMatches(newSchedule.matches), [...newSchedule.rules]);
        bestSchedule.evaluate();
        bestSchedule.originalScore = originalScore; // Preserve original score
        bestScore = bestSchedule.score;
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
    bestScore: bestScore,
    temperature,
    violations: bestSchedule.violations,
  });

  return bestSchedule;
}

/**
 * Calculate acceptance probability for simulated annealing
 * @param currentScore - Current solution score
 * @param newScore - New solution score
 * @param temperature - Current temperature
 * @returns Probability of accepting the new solution
 */
function getAcceptanceProbability(currentScore: number, newScore: number, temperature: number): number {
  // Always accept better solutions
  if (newScore < currentScore) {
    return 1.0;
  }

  // Calculate probability of accepting worse solutions
  return Math.exp((currentScore - newScore) / temperature);
}

/**
 * Create a block schedule format by division
 * @param matches - Array of Match objects
 * @param divisionOrder - Order of divisions, comma-separated
 * @returns Rearranged matches with updated time slots
 */
export function createDivisionBlocks(matches: Match[], divisionOrder: string): Match[] {
  // Parse division order
  const divisions = divisionOrder.split(',').map(d => d.trim());

  // Group matches by division
  const matchesByDivision: Record<string, Match[]> = {};
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
  const newMatches: Match[] = [];
  let currentTimeSlot = 1;

  divisions.forEach(division => {
    const divMatches = matchesByDivision[division];

    divMatches.forEach(match => {
      // Create a new match object with updated time slot
      const newMatch = new Match(
        match.team1,
        match.team2,
        currentTimeSlot,
        match.field,
        match.division,
        match.refereeTeam
      );
      newMatches.push(newMatch);
      currentTimeSlot++;
    });
  });

  return newMatches;
}
