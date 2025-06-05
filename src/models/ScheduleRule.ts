/**
 * Base class for schedule rules
 */
export class ScheduleRule {
  constructor(priority = 1) {
    this.priority = priority; // Higher priority means the rule is more important
  }
  
  /**
   * Evaluate the schedule against this rule
   * @param {Schedule} schedule - Schedule to evaluate
   * @returns {Array} Array of violation objects
   */
  evaluate(schedule) {
    // Abstract method, should be implemented by subclasses
    throw new Error("Method 'evaluate' must be implemented");
  }
}

/**
 * Rule to avoid back-to-back games for teams
 */
export class AvoidBackToBackGames extends ScheduleRule {
  constructor(priority = 3) {
    super(priority);
    this.name = "Avoid back-to-back games";
  }
  
  evaluate(schedule) {
    const violations = [];
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot);
    
    for (let i = 1; i < matches.length; i++) {
      const prevMatch = matches[i - 1];
      const currMatch = matches[i];
      
      // Check if the time slots are consecutive
      if (currMatch.timeSlot === prevMatch.timeSlot + 1) {
        // Check if any team plays in both matches
        if (
          prevMatch.team1.name === currMatch.team1.name ||
          prevMatch.team1.name === currMatch.team2.name ||
          prevMatch.team2.name === currMatch.team1.name ||
          prevMatch.team2.name === currMatch.team2.name
        ) {
          violations.push({
            rule: this.name,
            description: `Team plays back-to-back in time slots ${prevMatch.timeSlot} and ${currMatch.timeSlot}`,
            matches: [prevMatch, currMatch]
          });
        }
      }
    }
    
    return violations;
  }
}

/**
 * Rule to avoid teams having the first and last game
 */
export class AvoidFirstAndLastGame extends ScheduleRule {
  constructor(priority = 2) {
    super(priority);
    this.name = "Avoid teams having first and last game";
  }
  
  evaluate(schedule) {
    const violations = [];
    const matches = [...schedule.matches];
    
    if (matches.length === 0) return violations;
    
    // Group matches by division
    const divisionMatches = {};
    for (const match of matches) {
      if (!divisionMatches[match.division]) {
        divisionMatches[match.division] = [];
      }
      divisionMatches[match.division].push(match);
    }
    
    // Check each division
    for (const division in divisionMatches) {
      const divMatches = divisionMatches[division].sort((a, b) => a.timeSlot - b.timeSlot);
      
      if (divMatches.length < 2) continue; // Skip if not enough matches
      
      const firstMatch = divMatches[0];
      const lastMatch = divMatches[divMatches.length - 1];
      
      // Teams in first match
      const firstMatchTeams = [firstMatch.team1.name, firstMatch.team2.name];
      
      // Teams in last match
      const lastMatchTeams = [lastMatch.team1.name, lastMatch.team2.name];
      
      // Check for overlap
      const teamsWithFirstAndLast = firstMatchTeams.filter(team => 
        lastMatchTeams.includes(team)
      );
      
      if (teamsWithFirstAndLast.length > 0) {
        teamsWithFirstAndLast.forEach(team => {
          violations.push({
            rule: this.name,
            description: `Team ${team} has both first and last game in ${division} division`,
            matches: [firstMatch, lastMatch]
          });
        });
      }
    }
    
    return violations;
  }
}

/**
 * Rule to avoid teams refereeing immediately before their match
 */
export class AvoidReffingBeforePlaying extends ScheduleRule {
  constructor(priority = 4) {
    super(priority);
    this.name = "Avoid refereeing before playing";
  }
  
  evaluate(schedule) {
    const violations = [];
    const matches = [...schedule.matches].sort((a, b) => a.timeSlot - b.timeSlot);
    
    for (let i = 0; i < matches.length - 1; i++) {
      const currMatch = matches[i];
      const nextMatch = matches[i + 1];
      
      // Skip if there's no referee team assigned to current match
      if (!currMatch.refereeTeam) continue;
      
      // Check if the referee team plays in the next match
      if (
        currMatch.refereeTeam.name === nextMatch.team1.name ||
        currMatch.refereeTeam.name === nextMatch.team2.name
      ) {
        violations.push({
          rule: this.name,
          description: `Team ${currMatch.refereeTeam.name} referees in slot ${currMatch.timeSlot} and plays in slot ${nextMatch.timeSlot}`,
          matches: [currMatch, nextMatch]
        });
      }
    }
    
    return violations;
  }
}

/**
 * Custom rule to implement specific scheduling constraints
 */
export class CustomRule extends ScheduleRule {
  constructor(name, evaluateFunction, priority = 1) {
    super(priority);
    this.name = name;
    this.evaluateFunction = evaluateFunction;
  }
  
  evaluate(schedule) {
    return this.evaluateFunction(schedule);
  }
}