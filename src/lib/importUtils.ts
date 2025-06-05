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
  const result = Papa.parse(csvString, {
    skipEmptyLines: true,
    header: false,
  });

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Error parsing CSV: ${result.errors[0].message}`);
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

    // Skip rows that are too short
    if (row.length < 5) continue;

    // Check if this row contains a division header
    if (row[0] && !row[2] && !row[3] && row[0] !== 'Round') {
      currentDivision = row[0].toLowerCase();
      continue;
    }

    // Format detection and extraction
    let division: string, time: string, team1: string, team2: string, field: string, refereeTeam: string;

    // Handle the specific format: Round, Division, Time, Team1, Team2, Court, Referee
    // where Round column might be empty for subsequent rows
    if (row.length >= 6) {
      // Check if this looks like the tournament format:
      // Column 0: Round (can be empty)
      // Column 1: Division
      // Column 2: Time
      // Column 3: Team 1
      // Column 4: Team 2
      // Column 5: Court/Field
      // Column 6: Referee (optional)

      const possibleDivision = (row[1] || '').toLowerCase();
      const possibleTime = row[2] || '';
      const possibleTeam1 = row[3] || '';
      const possibleTeam2 = row[4] || '';

      // If we have teams in columns 3 and 4, use this format
      if (possibleTeam1 && possibleTeam2) {
        division = possibleDivision || currentDivision || '';
        time = possibleTime;
        team1 = possibleTeam1;
        team2 = possibleTeam2;
        field = row[5] || '';
        refereeTeam = row[6] || '';
      } else {
        // Fallback: try to detect columns automatically
        let divIndex = -1,
          timeIndex = -1,
          team1Index = -1,
          team2Index = -1,
          fieldIndex = -1,
          refIndex = -1;

        // Find division column (contains mx, m, w patterns)
        for (let j = 0; j < Math.min(3, row.length); j++) {
          const cellValue = (row[j] || '').toLowerCase();
          if (cellValue.match(/^(mx|m\d|w)/) && divIndex === -1) {
            divIndex = j;
            break;
          }
        }

        // Find time column (contains : pattern)
        for (let j = 0; j < row.length; j++) {
          const cellValue = row[j] || '';
          if (cellValue.includes(':') && timeIndex === -1) {
            timeIndex = j;
            break;
          }
        }

        // Find team columns (look for non-empty strings after time)
        for (let j = Math.max(divIndex + 1, timeIndex + 1); j < row.length; j++) {
          const cellValue = row[j] || '';
          if (cellValue && team1Index === -1) {
            team1Index = j;
          } else if (cellValue && team2Index === -1) {
            team2Index = j;
            break;
          }
        }

        // Field is typically right after team2
        if (team2Index >= 0 && team2Index + 1 < row.length) {
          fieldIndex = team2Index + 1;
        }

        // Referee is typically after field
        if (fieldIndex >= 0 && fieldIndex + 1 < row.length) {
          refIndex = fieldIndex + 1;
        }

        division = divIndex >= 0 ? (row[divIndex] || currentDivision || '').toLowerCase() : '';
        time = timeIndex >= 0 ? row[timeIndex] || '' : '';
        team1 = team1Index >= 0 ? row[team1Index] || '' : '';
        team2 = team2Index >= 0 ? row[team2Index] || '' : '';
        field = fieldIndex >= 0 ? row[fieldIndex] || '' : '';
        refereeTeam = refIndex >= 0 ? row[refIndex] || '' : '';
      }
    } else {
      // Skip rows with insufficient data
      continue;
    }

    // Skip if essential data is missing
    if (!division || !team1 || !team2) continue;

    // Normalize division format (mx1, mx2, m1, m2, w)
    let normalizedDivision: Division = 'mixed'; // Default to mixed
    if (division.toLowerCase().startsWith('mx')) {
      normalizedDivision = 'mixed';
    } else if (division.toLowerCase().startsWith('m')) {
      normalizedDivision = 'gendered';
    } else if (division.toLowerCase().startsWith('w')) {
      normalizedDivision = 'gendered';
    } else {
      // Use division from context if available
      const contextDiv = currentDivision.toLowerCase();
      if (contextDiv.startsWith('mx') || contextDiv === 'mixed') {
        normalizedDivision = 'mixed';
      } else if (contextDiv.startsWith('m') || contextDiv.startsWith('w') || contextDiv === 'gendered') {
        normalizedDivision = 'gendered';
      } else if (contextDiv === 'cloth') {
        normalizedDivision = 'cloth';
      }
    }

    // Convert time to slot number, ensuring matches with same time get same slot
    let timeSlot: number;
    if (time && time.trim() !== '') {
      // Use existing slot if this time has been seen before
      if (timeToSlotMap.has(time)) {
        timeSlot = timeToSlotMap.get(time)!;
      } else {
        // New time, assign next sequential slot number and store mapping
        timeSlot = timeSlotCounter++;
        timeToSlotMap.set(time, timeSlot);
      }
    } else {
      // No time provided, use sequential counter
      timeSlot = timeSlotCounter++;
    }

    // Look up teams in the team map
    const divTeams = teamsMap[normalizedDivision] || {};

    // Create teams if they don't exist in the map
    if (!divTeams[team1]) {
      divTeams[team1] = new Team(team1, normalizedDivision);
    }

    if (!divTeams[team2]) {
      divTeams[team2] = new Team(team2, normalizedDivision);
    }

    // Look up referee team if provided
    let refTeam: Team | null = null;
    if (refereeTeam && refereeTeam !== '-') {
      // Extract team name if it has division in parentheses, e.g., "Team Name (MX)"
      const refTeamName = refereeTeam.split('(')[0].trim();

      if (divTeams[refTeamName]) {
        refTeam = divTeams[refTeamName];
      } else {
        // Try to find the referee team in any division
        for (const div in teamsMap) {
          const divKey = div as keyof TeamsMap;
          if (teamsMap[divKey][refTeamName]) {
            refTeam = teamsMap[divKey][refTeamName];
            break;
          }
        }

        // If still not found, create it
        if (!refTeam) {
          refTeam = new Team(refTeamName, normalizedDivision);
          divTeams[refTeamName] = refTeam;
        }
      }
    }

    // Create the match
    const match = new Match(divTeams[team1], divTeams[team2], timeSlot, field, normalizedDivision, refTeam);

    matches.push(match);
  }

  // Update the teams map with any new teams
  for (const match of matches) {
    if (!teamsMap[match.division]) {
      teamsMap[match.division] = {};
    }

    if (!teamsMap[match.division][match.team1.name]) {
      teamsMap[match.division][match.team1.name] = match.team1;
    }

    if (!teamsMap[match.division][match.team2.name]) {
      teamsMap[match.division][match.team2.name] = match.team2;
    }

    if (match.refereeTeam && !teamsMap[match.division][match.refereeTeam.name]) {
      teamsMap[match.division][match.refereeTeam.name] = match.refereeTeam;
    }
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

  // Check for common schedule header columns
  const headerKeywords = ['round', 'division', 'time', 'team', 'court', 'field', 'referee'];

  // Count how many cells contain header keywords
  let headerKeywordCount = 0;
  for (const cell of row) {
    const cellText = String(cell).toLowerCase();
    if (headerKeywords.some(keyword => cellText.includes(keyword))) {
      headerKeywordCount++;
    }
  }

  // If at least 3 header keywords are found, consider it a header row
  return headerKeywordCount >= 3;
}
