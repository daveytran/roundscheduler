/**
 * Team class represents a team in a division
 */
export class Team {
  constructor(name, division, players = []) {
    this.name = name;
    this.division = division; // "mixed", "gendered", or "cloth"
    this.players = players;
    this.matches = [];
  }

  addPlayer(player) {
    if (!this.players.some(p => p.name === player.name)) {
      this.players.push(player);
    }
  }

  /**
   * Create teams from player data
   * @param {Array} players - Array of Player objects
   * @returns {Object} Object with teams by division
   */
  static createTeamsFromPlayers(players) {
    const teams = {
      mixed: {},
      gendered: {},
      cloth: {}
    };

    players.forEach(player => {
      // Process mixed division
      if (player.mixedTeam) {
        if (!teams.mixed[player.mixedTeam]) {
          teams.mixed[player.mixedTeam] = new Team(player.mixedTeam, "mixed");
        }
        teams.mixed[player.mixedTeam].addPlayer(player);
      }

      // Process gendered division
      if (player.genderedTeam) {
        if (!teams.gendered[player.genderedTeam]) {
          teams.gendered[player.genderedTeam] = new Team(player.genderedTeam, "gendered");
        }
        teams.gendered[player.genderedTeam].addPlayer(player);
      }

      // Process cloth division
      if (player.clothTeam) {
        if (!teams.cloth[player.clothTeam]) {
          teams.cloth[player.clothTeam] = new Team(player.clothTeam, "cloth");
        }
        teams.cloth[player.clothTeam].addPlayer(player);
      }
    });

    return teams;
  }
}