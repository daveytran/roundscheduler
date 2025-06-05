/**
 * Match class represents a match between two teams
 */
export class Match {
  constructor(team1, team2, timeSlot, field, division, refereeTeam = null) {
    this.team1 = team1;
    this.team2 = team2;
    this.timeSlot = timeSlot; // Integer representing the order/time slot
    this.field = field;
    this.division = division;
    this.refereeTeam = refereeTeam; // Team assigned to referee this match
  }

  /**
   * Create matches from imported schedule data
   * @param {Array} scheduleData - Array of schedule rows
   * @param {Object} teamsMap - Map of team names to Team objects by division
   * @returns {Array} Array of Match objects
   */
  static createMatchesFromSchedule(scheduleData, teamsMap) {
    // Assuming scheduleData has format:
    // [timeSlot, division, field, team1, team2, refereeTeam]
    return scheduleData.map(row => {
      const timeSlot = parseInt(row[0]);
      const division = row[1];
      const field = row[2];
      const team1Name = row[3];
      const team2Name = row[4];
      const refereeTeamName = row[5] || null;

      const team1 = teamsMap[division][team1Name];
      const team2 = teamsMap[division][team2Name];
      const refereeTeam = refereeTeamName ? teamsMap[division][refereeTeamName] : null;

      if (!team1 || !team2) {
        throw new Error(`Teams not found: ${team1Name} or ${team2Name} in division ${division}`);
      }

      return new Match(team1, team2, timeSlot, field, division, refereeTeam);
    });
  }

  toObject() {
    return {
      team1: this.team1.name,
      team2: this.team2.name,
      timeSlot: this.timeSlot,
      field: this.field,
      division: this.division,
      refereeTeam: this.refereeTeam ? this.refereeTeam.name : null
    };
  }
}