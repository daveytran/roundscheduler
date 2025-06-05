/**
 * Player class represents a player in the tournament
 */
export interface PlayerData {
  name: string;
  mixedTeam: string | null;
  genderedTeam: string | null;
  clothTeam: string | null;
}

export class Player {
  name: string;
  mixedTeam: string | null;
  genderedTeam: string | null;
  clothTeam: string | null;

  constructor(
    name: string,
    mixedTeam: string | null = null,
    genderedTeam: string | null = null,
    clothTeam: string | null = null
  ) {
    this.name = name;
    this.mixedTeam = mixedTeam;
    this.genderedTeam = genderedTeam;
    this.clothTeam = clothTeam;
  }

  static fromRow(row: (string | null)[]): Player {
    return new Player(
      row[0] || '', // Name
      row[1] || null, // Mixed division team
      row[2] || null, // Gendered team
      row[3] || null // Cloth team
    );
  }

  toObject(): PlayerData {
    return {
      name: this.name,
      mixedTeam: this.mixedTeam,
      genderedTeam: this.genderedTeam,
      clothTeam: this.clothTeam,
    };
  }
}
