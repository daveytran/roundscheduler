import { ScheduleHelpers } from '../lib/schedule-helpers';
import { Match } from './Match';
import { RuleViolation } from './RuleViolation';
import { ScheduleRule } from './ScheduleRule';

/**
 * Schedule class represents a tournament schedule
 * with matches and scheduling rules
 */
export class Schedule {
  matches: Match[];
  rules: ScheduleRule[];
  violations: RuleViolation[];
  score: number;
  originalScore?: number; // Score before optimization

  constructor(matches: Match[] = [], rules: ScheduleRule[] = []) {
    this.matches = matches;
    this.rules = rules;
    this.violations = [];
    this.score = 0; // Lower is better (fewer rule violations)
  }

  /**
   * Add a match to the schedule
   * @param {Match} match - Match to add
   */
  addMatch(match: Match) {
    this.matches.push(match);
  }

  /**
   * Add a scheduling rule
   * @param {ScheduleRule} rule - Rule to add
   */
  addRule(rule: ScheduleRule) {
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

    // Validate referee assignments
    this.validateRefereeAssignments();

    // Evaluate each rule
    for (const rule of this.rules) {
      const ruleViolations: RuleViolation[] = [];
      rule.evaluate(this, ruleViolations);
      this.score += ruleViolations.length * rule.priority;
      this.violations = [...this.violations, ...ruleViolations];
    }

    return this.score;
  }

  /**
   * Validate referee assignments to detect conflicts
   */
  private validateRefereeAssignments() {
    // Group matches by time slot
    const matchesByTimeSlot: Record<number, Match[]> = {};
    this.matches.forEach(match => {
      if (!matchesByTimeSlot[match.timeSlot]) {
        matchesByTimeSlot[match.timeSlot] = [];
      }
      matchesByTimeSlot[match.timeSlot].push(match);
    });

    // Check for referee conflicts in each time slot
    for (const timeSlot in matchesByTimeSlot) {
      const timeSlotMatches = matchesByTimeSlot[timeSlot];
      const refereeCount: Record<string, number> = {};

      timeSlotMatches.forEach(match => {
        if (match.refereeTeam) {
          const refName = match.refereeTeam.name;
          refereeCount[refName] = (refereeCount[refName] || 0) + 1;

          // Check if referee is also playing
          if (refName === match.team1.name || refName === match.team2.name) {
            console.warn(`REFEREE CONFLICT: ${refName} is refereeing their own match at time slot ${timeSlot}`);
            this.violations.push({
              rule: 'Referee Assignment Validation',
              description: `${refName} is refereeing their own match at time slot ${timeSlot}`,
              matches: [match],
            });
          }
        }
      });

      // Check for referees assigned to multiple matches in same time slot
      for (const refName in refereeCount) {
        if (refereeCount[refName] > 1) {
          console.warn(
            `REFEREE CONFLICT: ${refName} is refereeing ${refereeCount[refName]} matches simultaneously at time slot ${timeSlot}`
          );
          const conflictMatches = timeSlotMatches.filter(m => m.refereeTeam?.name === refName);
          this.violations.push({
            rule: 'Referee Assignment Validation',
            description: `${refName} is refereeing ${refereeCount[refName]} matches simultaneously at time slot ${timeSlot}`,
            matches: conflictMatches,
          });
        }
      }
    }
  }

  /**
   * Randomize the schedule while keeping divisions together
   * Games can be shuffled across blocks as long as the blocks are both for the same division
   * Referees are also shuffled to optimize referee assignments
   * @returns {Schedule} New randomized schedule
   */
  randomize() {
    // Create deep copies of matches to avoid modifying the original
    const newMatches = this.matches.map(
      match => new Match(match.team1, match.team2, match.timeSlot, match.field, match.division, match.refereeTeam)
    );

    // Group by division
    const divisionMatches = ScheduleHelpers.groupMatchesByDivision(newMatches);

    // Randomize each division's matches and referee assignments
    for (const division in divisionMatches) {
      const matches = divisionMatches[division];

      // Shuffle the matches within the division
      shuffleArray(matches);

      // Get all time slots available to this division (sorted)
      const availableTimeSlots = matches.map(m => m.timeSlot).sort((a, b) => a - b);

      // Randomly assign the shuffled time slots to any available time slot for this division
      shuffleArray(availableTimeSlots);

      // Assign the shuffled time slots to the shuffled matches
      matches.forEach((match, index) => {
        match.timeSlot = availableTimeSlots[index];
      });

      // Shuffle referee assignments within this division
      this.shuffleRefereeAssignments(matches);
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
   * Shuffle referee assignments within a division while ensuring teams don't referee themselves
   * and that referees aren't assigned to multiple matches in the same time slot
   * @param {Match[]} matches - Matches within a division to shuffle referees for
   */
  private shuffleRefereeAssignments(matches: Match[]) {
    // Collect all referee teams that were originally assigned
    const originalRefereeTeams = matches.map(match => match.refereeTeam).filter(ref => ref !== null);

    // If no referees assigned, skip shuffling
    if (originalRefereeTeams.length === 0) {
      return;
    }

    console.log(
      `Shuffling referees for ${matches.length} matches with ${originalRefereeTeams.length} original referees`
    );

    // Get all unique teams in this division that could potentially referee
    const allTeamsInDivision = new Set<string>();
    matches.forEach(match => {
      allTeamsInDivision.add(match.team1.name);
      allTeamsInDivision.add(match.team2.name);
    });

    // Convert to array and shuffle for random assignment
    const availableRefereeTeams = Array.from(new Set(originalRefereeTeams.map(ref => ref!.name)))
      .map(refName => originalRefereeTeams.find(ref => ref!.name === refName)!)
      .filter(ref => ref !== null);

    console.log(`Available referee teams: ${availableRefereeTeams.map(ref => ref!.name).join(', ')}`);
    shuffleArray(availableRefereeTeams);

    // Reset all referee assignments first
    matches.forEach(match => {
      match.refereeTeam = null;
    });

    // Group matches by time slot to handle conflicts
    const matchesByTimeSlot: Record<number, Match[]> = {};
    matches.forEach(match => {
      if (!matchesByTimeSlot[match.timeSlot]) {
        matchesByTimeSlot[match.timeSlot] = [];
      }
      matchesByTimeSlot[match.timeSlot].push(match);
    });

    console.log(`Time slots: ${Object.keys(matchesByTimeSlot).join(', ')}`);

    // Assign referees for each time slot
    const timeSlots = Object.keys(matchesByTimeSlot)
      .map(Number)
      .sort((a, b) => a - b);
    let globalRefereeIndex = 0;

    for (const timeSlot of timeSlots) {
      const timeSlotMatches = matchesByTimeSlot[timeSlot];
      const usedRefereesThisSlot = new Set<string>();

      console.log(`Assigning referees for time slot ${timeSlot} with ${timeSlotMatches.length} matches`);

      for (const match of timeSlotMatches) {
        // Find a referee that:
        // 1. Isn't playing in this match
        // 2. Isn't already refereeing another match in this time slot
        // 3. Is available
        let assignedReferee = null;
        let attempts = 0;

        while (attempts < availableRefereeTeams.length && !assignedReferee) {
          const candidateReferee = availableRefereeTeams[globalRefereeIndex % availableRefereeTeams.length];

          if (
            candidateReferee &&
            candidateReferee.name !== match.team1.name &&
            candidateReferee.name !== match.team2.name &&
            !usedRefereesThisSlot.has(candidateReferee.name)
          ) {
            assignedReferee = candidateReferee;
            usedRefereesThisSlot.add(candidateReferee.name);
            match.refereeTeam = candidateReferee;
            console.log(`  Assigned ${candidateReferee.name} to referee ${match.team1.name} vs ${match.team2.name}`);
          }

          globalRefereeIndex++;
          attempts++;
        }

        // If we couldn't find a suitable referee from the original list,
        // try any team from the division that's not playing and not already assigned
        if (!assignedReferee) {
          for (const refTeam of availableRefereeTeams) {
            if (
              refTeam &&
              refTeam.name !== match.team1.name &&
              refTeam.name !== match.team2.name &&
              !usedRefereesThisSlot.has(refTeam.name)
            ) {
              match.refereeTeam = refTeam;
              usedRefereesThisSlot.add(refTeam.name);
              console.log(`  Backup assigned ${refTeam.name} to referee ${match.team1.name} vs ${match.team2.name}`);
              break;
            }
          }
        }

        if (!match.refereeTeam) {
          console.log(
            `  WARNING: Could not assign referee for ${match.team1.name} vs ${match.team2.name} at time ${timeSlot}`
          );
        }
      }
    }

    // Final pass: for any matches still without referees, try to assign any available team
    // (this handles edge cases where we don't have enough referee teams)
    for (const match of matches) {
      if (!match.refereeTeam) {
        // Get all teams not playing in this match and not already refereeing in this time slot
        const timeSlotMatches = matchesByTimeSlot[match.timeSlot];
        const usedRefereesThisSlot = new Set(
          timeSlotMatches.filter(m => m.refereeTeam && m !== match).map(m => m.refereeTeam!.name)
        );

        const availableReferee = availableRefereeTeams.find(
          refTeam =>
            refTeam &&
            refTeam.name !== match.team1.name &&
            refTeam.name !== match.team2.name &&
            !usedRefereesThisSlot.has(refTeam.name)
        );

        if (availableReferee) {
          match.refereeTeam = availableReferee;
          console.log(
            `  Final pass assigned ${availableReferee.name} to referee ${match.team1.name} vs ${match.team2.name}`
          );
        }
      }
    }

    console.log('Referee assignment completed');
  }

  /**
   * Optimize schedule using simulated annealing
   * @param {number} iterations - Number of iterations
   * @returns {Schedule} Optimized schedule
   */
  optimize(iterations = 10000) {
    let currentSchedule: Schedule = this;
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
      const acceptanceProbability = getAcceptanceProbability(currentScore, newScore, temperature);

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
function getAcceptanceProbability(currentScore: number, newScore: number, temperature: number) {
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
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
