import { Schedule } from '../models/Schedule';
import { Match } from '../models/Match';
import { RuleViolation } from '../models/RuleViolation';
import { ScheduleRule } from '../models/ScheduleRule';
import {
  AvoidBackToBackGames,
  AvoidFirstAndLastGame,
  AvoidReffingBeforePlaying,
  AvoidPlayingAfterSetup,
} from '../models/ScheduleRule';

// Type for optimization progress callback
export interface OptimizationProgressInfo {
  iteration: number;
  progress: number;
  currentScore: number;
  bestScore: number;
  violations: RuleViolation[];
  currentSchedule?: Schedule; // Current schedule being evaluated
  bestScheduleSnapshot?: Schedule; // Best schedule found so far
}

// Type for optimization options
interface OptimizationOptions {
  iterations?: number;
  progressCallback?: (info: OptimizationProgressInfo) => void;
}

/**
 * Get default scheduling rules
 * @returns Array of default scheduling rules with priorities
 */
export function getDefaultRules(): ScheduleRule[] {
  return [
    new AvoidPlayingAfterSetup(10), // Priority 10 (critical - highest)
    new AvoidBackToBackGames(5), // Priority 5 (high)
    new AvoidReffingBeforePlaying(3), // Priority 3 (medium)
    new AvoidFirstAndLastGame(1), // Priority 1 (lowest)
  ];
}

/**
 * Create a schedule with default rules
 * @param matches - Array of Match objects
 * @returns Object containing the schedule and default rules
 */
export function createSchedule(matches: Match[]): { schedule: Schedule; rules: ScheduleRule[] } {
  const schedule = new Schedule(matches);
  const rules = getDefaultRules();

  return { schedule, rules };
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
