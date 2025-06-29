import { Team, Division, TeamsMap } from './Team';

export interface MatchData {
  team1: string;
  team2: string;
  timeSlot: number;
  field: string;
  division: string;
  refereeTeam: string | null;
  activityType?: 'SETUP' | 'PACKING_DOWN' | 'REGULAR';
  locked?: boolean;
}

/**
 * Match class represents a match between two teams or a special activity
 */
export class Match {
  team1: Team;
  team2: Team;
  timeSlot: number; // Integer representing the order/time slot
  field: string;
  division: Division;
  refereeTeam: Team | null; // Team assigned to referee this match
  activityType: 'SETUP' | 'PACKING_DOWN' | 'REGULAR'; // Type of activity
  locked: boolean; // Whether this match is locked and cannot be moved

  constructor(
    team1: Team,
    team2: Team,
    timeSlot: number,
    field: string,
    division: Division,
    refereeTeam: Team | null = null,
    activityType: 'SETUP' | 'PACKING_DOWN' | 'REGULAR' = 'REGULAR',
    locked: boolean = false
  ) {
    this.team1 = team1;
    this.team2 = team2;
    this.timeSlot = timeSlot;
    this.field = field;
    this.division = division;
    this.refereeTeam = refereeTeam;
    this.activityType = activityType;
    this.locked = locked;
  }

  /**
   * Check if this is a special activity (SETUP or PACKING DOWN)
   */
  isSpecialActivity(): boolean {
    return this.activityType === 'SETUP' || this.activityType === 'PACKING_DOWN';
  }

  /**
   * Get all teams involved in this match/activity (including referee)
   */
  getAllInvolvedTeams(): Team[] {
    const teams = [this.team1, this.team2];
    if (this.refereeTeam) {
      teams.push(this.refereeTeam);
    }
    return teams.filter((team, index, self) => self.findIndex(t => t.name === team.name) === index);
  }

  /**
   * Helper function to find a team by name across all divisions
   * @param teamName - Name of the team to find
   * @param teamsMap - Map of teams organized by division
   * @returns The team if found, null otherwise
   */
  private static findTeamAcrossDivisions(teamName: string, teamsMap: TeamsMap): Team | null {
    // Search through all divisions
    const divisions: Division[] = ['mixed', 'gendered', 'cloth'];
    
    for (const division of divisions) {
      if (teamsMap[division] && teamsMap[division][teamName]) {
        return teamsMap[division][teamName];
      }
    }
    
    return null;
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
      // Search for referee team across all divisions, not just the current division
      const refereeTeam = refereeTeamName ? this.findTeamAcrossDivisions(refereeTeamName, teamsMap) : null;

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
      refereeTeam: this.refereeTeam ? this.refereeTeam.name : null,
      activityType: this.activityType,
      locked: this.locked,
    };
  }
}
