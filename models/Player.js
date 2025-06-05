/**
 * Player class represents a player in the tournament
 */
export class Player {
  constructor(name, mixedTeam = null, genderedTeam = null, clothTeam = null) {
    this.name = name;
    this.mixedTeam = mixedTeam;
    this.genderedTeam = genderedTeam;
    this.clothTeam = clothTeam;
  }

  static fromRow(row) {
    return new Player(
      row[0] || "", // Name
      row[1] || null, // Mixed division team
      row[2] || null, // Gendered team
      row[3] || null  // Cloth team
    );
  }

  toObject() {
    return {
      name: this.name,
      mixedTeam: this.mixedTeam,
      genderedTeam: this.genderedTeam,
      clothTeam: this.clothTeam
    };
  }
}