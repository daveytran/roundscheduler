import { Player } from './Player';

export type Division = 'mixed' | 'gendered' | 'cloth';

export interface TeamsMap {
  mixed: { [teamName: string]: Team };
  gendered: { [teamName: string]: Team };
  cloth: { [teamName: string]: Team };
}

/**
 * Team class represents a team in a division
 */
export class Team {
  name: string;
  division: Division;
  players: Player[];
  matches: any[]; // TODO: Add proper Match type when available

  constructor(name: string, division: Division, players: Player[] = []) {
    this.name = name;
    this.division = division;
    this.players = players;
    this.matches = [];
  }

  addPlayer(player: Player): void {
    if (!this.players.some(p => p.name === player.name)) {
      this.players.push(player);
    }
  }

  /**
   * Create teams from player data
   */
  static createTeamsFromPlayers(players: Player[]): TeamsMap {
    const teams: TeamsMap = {
      mixed: {},
      gendered: {},
      cloth: {},
    };

    players.forEach(player => {
      // Process mixed division
      if (player.mixedTeam) {
        if (!teams.mixed[player.mixedTeam]) {
          teams.mixed[player.mixedTeam] = new Team(player.mixedTeam, 'mixed');
        }
        teams.mixed[player.mixedTeam].addPlayer(player);
      }

      // Process gendered division
      if (player.genderedTeam) {
        if (!teams.gendered[player.genderedTeam]) {
          teams.gendered[player.genderedTeam] = new Team(player.genderedTeam, 'gendered');
        }
        teams.gendered[player.genderedTeam].addPlayer(player);
      }

      // Process cloth division
      if (player.clothTeam) {
        if (!teams.cloth[player.clothTeam]) {
          teams.cloth[player.clothTeam] = new Team(player.clothTeam, 'cloth');
        }
        teams.cloth[player.clothTeam].addPlayer(player);
      }
    });

    return teams;
  }
}
