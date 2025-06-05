import * as Papa from 'papaparse';
import { Player } from '../models/Player';
import { Team, Division, TeamsMap } from '../models/Team';
import { Match } from '../models/Match';

// Type for CSV row data
type CSVRow = (string | null)[];

/**
 * Parse CSV data from string
 * @param {string} csvString - CSV data as string
 * @returns {Array} Parsed data
 */
export function parseCSV(csvString: string): CSVRow[] {
  // Handle empty CSV data
  if (!csvString || csvString.trim() === '') {
    return [];
  }

  const result = Papa.parse(csvString, {
    skipEmptyLines: true,
    header: false,
  });

  if (result.errors && result.errors.length > 0) {
    // Don't throw error for auto-detection issues on empty data
    const error = result.errors[0];
    if (error.message.includes('auto-detect') && (!result.data || result.data.length === 0)) {
      return [];
    }
    throw new Error(`Error parsing CSV: ${error.message}`);
  }

  return result.data as CSVRow[];
}

/**
 * Import player data from CSV string
 * @param {string} csvString - CSV data as string
 * @returns {Array} Array of Player objects
 */
export function importPlayers(csvString: string): Player[] {
  const data = parseCSV(csvString);

  // Skip header row if it exists
  const hasHeader = isHeaderRow(data[0]);
  const playerData = hasHeader ? data.slice(1) : data;

  return playerData.map(row => Player.fromRow(row));
}

/**
 * Import schedule data from CSV string
 * @param {string} csvString - CSV data as string
 * @param {Object} teamsMap - Map of team names to Team objects by division
 * @returns {Array} Array of Match objects
 */
export function importSchedule(csvString: string, teamsMap: TeamsMap): Match[] {
  const data = parseCSV(csvString);

  // Skip header row if it exists
  const hasHeader = isScheduleHeaderRow(data[0]);
  let scheduleData = hasHeader ? data.slice(1) : data;

  // Filter out empty rows and special rows (SETUP, PACKING DOWN)
  scheduleData = scheduleData.filter((row: CSVRow) => {
    // Skip completely empty rows
    if (row.every((cell: string | null) => !cell || cell.trim() === '')) return false;

    // Check if this is a special row like SETUP or PACKING DOWN
    const isSpecialRow = row.some(
      (cell: string | null) =>
        cell && typeof cell === 'string' && (cell.includes('SETUP') || cell.includes('PACKING DOWN'))
    );

    return !isSpecialRow;
  });

  return processScheduleFormat(scheduleData, teamsMap);
}

/**
 * Process schedule data based on format detection
 * @param {Array} scheduleData - Parsed schedule data
 * @param {Object} teamsMap - Map of team names to Team objects by division
 * @returns {Array} Array of Match objects
 */
function processScheduleFormat(scheduleData: CSVRow[], teamsMap: TeamsMap): Match[] {
  const matches: Match[] = [];
  let currentDivision = '';
  let timeSlotCounter = 1;
  const timeToSlotMap = new Map<string, number>(); // Track time strings to slot numbers

  for (let i = 0; i < scheduleData.length; i++) {
    const row = scheduleData[i];

    // Skip empty rows
    if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
      continue;
    }

    // Check if this row is a division context row (single division name)
    if (row.length === 1 || (row[0] && !row[2] && !row[3])) {
      const divisionCandidate = (row[0] || '').toLowerCase().trim();
      if (divisionCandidate === 'mixed' || divisionCandidate === 'gendered' || divisionCandidate === 'cloth') {
        currentDivision = divisionCandidate;
        continue;
      }
    }

    // Need at least 5 columns for a match (time/slot, division, field, team1, team2)
    if (row.length < 5) continue;

    let timeSlot: number;
    let division: string;
    let field: string;
    let team1: string;
    let team2: string;
    let refereeTeam: string;

    // Try to detect the format based on column count and content
    if (row.length >= 7) {
      // Format with extra columns: Time,Division,Field,Team1,Team2,Team Referee,ExtraCol...
      // Check if first column looks like a round descriptor (not just a number)
      const firstCol = (row[0] || '').toString();
      const isRoundColumn =
        firstCol.toLowerCase() === 'round' ||
        firstCol === '' ||
        (/[a-zA-Z]/.test(firstCol) && !/^\d+:\d+$/.test(firstCol)); // Contains letters but not time format

      if (isRoundColumn) {
        // Tournament format: Round,Division,Time,Team1,Team2,Court,Referee,Extra...
        division = (row[1] || currentDivision || '').toString();
        const timeStr = (row[2] || '').toString();
        team1 = (row[3] || '').toString();
        team2 = (row[4] || '').toString();
        field = (row[5] || '').toString();
        refereeTeam = (row[6] || '').toString();

        // Handle time slot
        if (timeStr && timeStr.trim() !== '') {
          if (timeToSlotMap.has(timeStr)) {
            timeSlot = timeToSlotMap.get(timeStr)!;
          } else {
            timeSlot = timeSlotCounter++;
            timeToSlotMap.set(timeStr, timeSlot);
          }
        } else {
          timeSlot = timeSlotCounter++;
        }
      } else {
        // Basic format with extra columns: Time,Division,Field,Team1,Team2,Team Referee,Extra...
        const timeStr = firstCol;
        division = (row[1] || currentDivision || '').toString();
        field = (row[2] || '').toString();
        team1 = (row[3] || '').toString();
        team2 = (row[4] || '').toString();
        refereeTeam = (row[5] || '').toString();

        // Handle time slot
        if (timeStr && timeStr.trim() !== '') {
          if (/^\d+$/.test(timeStr.trim())) {
            timeSlot = parseInt(timeStr.trim(), 10);
          } else {
            if (timeToSlotMap.has(timeStr)) {
              timeSlot = timeToSlotMap.get(timeStr)!;
            } else {
              timeSlot = timeSlotCounter++;
              timeToSlotMap.set(timeStr, timeSlot);
            }
          }
        } else {
          timeSlot = timeSlotCounter++;
        }
      }
    } else if (row.length === 6) {
      // Format: Time,Division,Field,Team1,Team2,Team Referee
      // Check if first column looks like a round descriptor (not just a number)
      const firstCol = (row[0] || '').toString();
      const isRoundColumn =
        firstCol.toLowerCase() === 'round' ||
        firstCol === '' ||
        (/[a-zA-Z]/.test(firstCol) && !/^\d+:\d+$/.test(firstCol)); // Contains letters but not time format

      if (isRoundColumn) {
        // Tournament format: Round,Division,Time,Team1,Team2,Court
        division = (row[1] || currentDivision || '').toString();
        const timeStr = (row[2] || '').toString();
        team1 = (row[3] || '').toString();
        team2 = (row[4] || '').toString();
        field = (row[5] || '').toString();
        refereeTeam = '';

        // Handle time slot
        if (timeStr && timeStr.trim() !== '') {
          if (timeToSlotMap.has(timeStr)) {
            timeSlot = timeToSlotMap.get(timeStr)!;
          } else {
            timeSlot = timeSlotCounter++;
            timeToSlotMap.set(timeStr, timeSlot);
          }
        } else {
          timeSlot = timeSlotCounter++;
        }
      } else {
        // Basic format: Time,Division,Field,Team1,Team2,Team Referee
        const timeStr = firstCol;
        division = (row[1] || currentDivision || '').toString();
        field = (row[2] || '').toString();
        team1 = (row[3] || '').toString();
        team2 = (row[4] || '').toString();
        refereeTeam = (row[5] || '').toString();

        // Handle time slot
        if (timeStr && timeStr.trim() !== '') {
          if (/^\d+$/.test(timeStr.trim())) {
            timeSlot = parseInt(timeStr.trim(), 10);
          } else {
            if (timeToSlotMap.has(timeStr)) {
              timeSlot = timeToSlotMap.get(timeStr)!;
            } else {
              timeSlot = timeSlotCounter++;
              timeToSlotMap.set(timeStr, timeSlot);
            }
          }
        } else {
          timeSlot = timeSlotCounter++;
        }
      }
    } else if (row.length === 5) {
      // Format: Time,Division,Field,Team1,Team2 (no referee)
      const timeStr = (row[0] || '').toString();
      division = (row[1] || currentDivision || '').toString();
      field = (row[2] || '').toString();
      team1 = (row[3] || '').toString();
      team2 = (row[4] || '').toString();
      refereeTeam = '';

      // Handle time slot
      if (timeStr && timeStr.trim() !== '') {
        if (/^\d+$/.test(timeStr.trim())) {
          timeSlot = parseInt(timeStr.trim(), 10);
        } else {
          if (timeToSlotMap.has(timeStr)) {
            timeSlot = timeToSlotMap.get(timeStr)!;
          } else {
            timeSlot = timeSlotCounter++;
            timeToSlotMap.set(timeStr, timeSlot);
          }
        }
      } else {
        timeSlot = timeSlotCounter++;
      }
    } else {
      // Try to extract from whatever columns we have
      const timeStr = (row[0] || '').toString();
      division = currentDivision || 'mixed';
      team1 = (row[row.length >= 3 ? row.length - 3 : 1] || '').toString();
      team2 = (row[row.length >= 2 ? row.length - 2 : 2] || '').toString();
      refereeTeam = (row[row.length - 1] || '').toString();
      field = '';

      if (timeStr && /^\d+$/.test(timeStr.trim())) {
        timeSlot = parseInt(timeStr.trim(), 10);
      } else {
        timeSlot = timeSlotCounter++;
      }
    }

    // Skip if essential data is missing
    if (!team1 || !team2) continue;

    // Normalize division
    let normalizedDivision: Division = 'mixed'; // Default to mixed
    const divLower = division.toLowerCase();
    if (divLower.startsWith('mx') || divLower === 'mixed') {
      normalizedDivision = 'mixed';
    } else if (divLower.startsWith('m') || divLower.startsWith('w') || divLower === 'gendered') {
      normalizedDivision = 'gendered';
    } else if (divLower === 'cloth') {
      normalizedDivision = 'cloth';
    } else if (currentDivision) {
      const currentDivLower = currentDivision.toLowerCase();
      if (currentDivLower === 'mixed') {
        normalizedDivision = 'mixed';
      } else if (currentDivLower === 'gendered') {
        normalizedDivision = 'gendered';
      } else if (currentDivLower === 'cloth') {
        normalizedDivision = 'cloth';
      }
    }

    // Ensure teams map has the division
    if (!teamsMap[normalizedDivision]) {
      teamsMap[normalizedDivision] = {};
    }

    // Look up or create teams
    if (!teamsMap[normalizedDivision][team1]) {
      teamsMap[normalizedDivision][team1] = new Team(team1, normalizedDivision);
    }

    if (!teamsMap[normalizedDivision][team2]) {
      teamsMap[normalizedDivision][team2] = new Team(team2, normalizedDivision);
    }

    // Handle referee team
    let refTeam: Team | null = null;
    if (refereeTeam && refereeTeam !== '-' && refereeTeam.trim() !== '') {
      // Extract team name if it has division in parentheses, e.g., "Team Name (MX)"
      const refTeamName = refereeTeam.split('(')[0].trim();

      if (!teamsMap[normalizedDivision][refTeamName]) {
        teamsMap[normalizedDivision][refTeamName] = new Team(refTeamName, normalizedDivision);
      }
      refTeam = teamsMap[normalizedDivision][refTeamName];
    }

    // Create the match
    const match = new Match(
      teamsMap[normalizedDivision][team1],
      teamsMap[normalizedDivision][team2],
      timeSlot,
      field,
      normalizedDivision,
      refTeam
    );

    matches.push(match);
  }

  return matches;
}

/**
 * Check if a row is likely a header row for player data
 * @param {Array} row - Row data
 * @returns {boolean} True if row appears to be a header
 */
function isHeaderRow(row: CSVRow): boolean {
  if (!row || row.length === 0) return false;

  // Check if first value is a non-numeric string like "Name" or "Player"
  const firstCell = String(row[0]).toLowerCase();
  return (
    Number.isNaN(Number(firstCell)) &&
    (firstCell.includes('name') || firstCell.includes('player') || firstCell.includes('team'))
  );
}

/**
 * Check if a row is likely a header row for schedule data
 * @param {Array} row - Row data
 * @returns {boolean} True if row appears to be a header
 */
function isScheduleHeaderRow(row: CSVRow): boolean {
  if (!row || row.length === 0) return false;

  // Check for exact header column names (case insensitive)
  const exactHeaders = ['time', 'division', 'round', 'team1', 'team2', 'field', 'court', 'referee'];

  // Count how many cells are exact header matches
  let exactHeaderCount = 0;
  for (const cell of row) {
    const cellText = String(cell).toLowerCase().trim();
    if (exactHeaders.includes(cellText)) {
      exactHeaderCount++;
    }
  }

  // If at least 3 exact header matches are found, consider it a header row
  return exactHeaderCount >= 3;
}

/**
 * Import player-team assignments from table format
 * Expected format: Mixed Team | Gendered Team | Cloth Team | Player
 * @param {string} csvString - CSV/TSV data as string
 * @param {Object} teamsMap - Map of team names to Team objects by division
 * @returns {Array} Array of Player objects with team assignments
 */
export function importPlayerTeamTable(csvString: string, teamsMap: TeamsMap): Player[] {
  const data = parseCSV(csvString);

  // If there's only one row, treat it as data, not a header
  if (data.length <= 1) {
    return processPlayerTeamData(data, teamsMap);
  }

  // Skip header row if it exists
  const hasHeader = isPlayerTeamTableHeader(data[0]);
  let playerData = hasHeader ? data.slice(1) : data;

  return processPlayerTeamData(playerData, teamsMap);
}

/**
 * Process player team data rows
 */
function processPlayerTeamData(playerData: CSVRow[], teamsMap: TeamsMap): Player[] {
  // Filter out empty rows
  playerData = playerData.filter((row: CSVRow) => {
    return row.some((cell: string | null) => cell && cell.trim() !== '');
  });

  const players: Player[] = [];
  let currentMixedTeam = '';
  let currentGenderedTeam = '';
  let currentClothTeam = '';

  for (const row of playerData) {
    if (row.length < 4) continue;

    // Update current team values if provided
    const mixedTeam = (row[0] || '').toString().trim();
    const genderedTeam = (row[1] || '').toString().trim();
    const clothTeam = (row[2] || '').toString().trim();
    const playerName = (row[3] || '').toString().trim();

    if (!playerName) continue;

    // Use provided team or fall back to current team
    if (mixedTeam) currentMixedTeam = mixedTeam;
    if (genderedTeam) currentGenderedTeam = genderedTeam;
    if (clothTeam) currentClothTeam = clothTeam;

    // Create player - determine primary division based on team assignments
    const primaryDivision: Division = currentMixedTeam
      ? 'mixed'
      : currentGenderedTeam
        ? 'gendered'
        : currentClothTeam
          ? 'cloth'
          : 'mixed';

    const player = new Player(playerName, primaryDivision, 'cloth'); // Default cloth color

    // Assign player to teams in each division where they have a team
    if (currentMixedTeam) {
      // Ensure teams map has the division
      if (!teamsMap.mixed) teamsMap.mixed = {};

      // Create team if it doesn't exist
      if (!teamsMap.mixed[currentMixedTeam]) {
        teamsMap.mixed[currentMixedTeam] = new Team(currentMixedTeam, 'mixed');
      }

      // Add player to team
      teamsMap.mixed[currentMixedTeam].addPlayer(player);
    }

    if (currentGenderedTeam) {
      // Ensure teams map has the division
      if (!teamsMap.gendered) teamsMap.gendered = {};

      // Create team if it doesn't exist
      if (!teamsMap.gendered[currentGenderedTeam]) {
        teamsMap.gendered[currentGenderedTeam] = new Team(currentGenderedTeam, 'gendered');
      }

      // Add player to team
      teamsMap.gendered[currentGenderedTeam].addPlayer(player);
    }

    if (currentClothTeam) {
      // Ensure teams map has the division
      if (!teamsMap.cloth) teamsMap.cloth = {};

      // Create team if it doesn't exist
      if (!teamsMap.cloth[currentClothTeam]) {
        teamsMap.cloth[currentClothTeam] = new Team(currentClothTeam, 'cloth');
      }

      // Add player to team
      teamsMap.cloth[currentClothTeam].addPlayer(player);
    }

    players.push(player);
  }

  return players;
}

/**
 * Check if a row is likely a header row for player-team table data
 * @param {Array} row - Row data
 * @returns {boolean} True if row appears to be a header
 */
function isPlayerTeamTableHeader(row: CSVRow): boolean {
  if (!row || row.length < 4) return false;

  // Check for exact header column names that are commonly used
  const exactHeaders = [
    'mixed team',
    'gendered team',
    'cloth team',
    'player',
    'player name',
    'gendered foam',
    'open cloth',
    'team',
    'name',
  ];

  // Count exact header matches (case insensitive)
  let exactHeaderCount = 0;
  for (const cell of row) {
    const cellText = String(cell).toLowerCase().trim();
    if (exactHeaders.includes(cellText)) {
      exactHeaderCount++;
    }
  }

  // Require at least 2 exact header matches
  return exactHeaderCount >= 2;
}
