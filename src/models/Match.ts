import { Team, Division, TeamsMap } from './Team';

export interface MatchData {
  team1: string;
  team2: string;
  timeSlot: number;
  field: string;
  division: string;
  refereeTeam: string | null;
}

/**
 * Match class represents a match between two teams
 */
export class Match {
  team1: Team;
  team2: Team;
  timeSlot: number; // Integer representing the order/time slot
  field: string;
  division: Division;
  refereeTeam: Team | null; // Team assigned to referee this match

  constructor(team1: Team, team2: Team, timeSlot: number, field: string, division: Division, refereeTeam: Team | null = null) {
    this.team1 = team1;
    this.team2 = team2;
    this.timeSlot = timeSlot;
    this.field = field;
    this.division = division;
    this.refereeTeam = refereeTeam;
  }

  /**
   * Create matches from imported schedule data
   */
  static createMatchesFromSchedule(scheduleData: string[][], teamsMap: TeamsMap): Match[] {
    // Assuming scheduleData has format:
    // [timeSlot, division, field, team1, team2, refereeTeam]
    return scheduleData.map(row => {
      const timeSlot = parseInt(row[0]);
      const division = row[1] as Division;
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

  toObject(): MatchData {
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