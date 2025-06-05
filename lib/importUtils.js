import Papa from 'papaparse';
import { Player } from '../models/Player';
import { Team } from '../models/Team';
import { Match } from '../models/Match';

/**
 * Parse CSV data from string
 * @param {string} csvString - CSV data as string 
 * @returns {Array} Parsed data
 */
export function parseCSV(csvString) {
  const result = Papa.parse(csvString, {
    skipEmptyLines: true,
    header: false
  });
  
  if (result.errors && result.errors.length > 0) {
    throw new Error(`Error parsing CSV: ${result.errors[0].message}`);
  }
  
  return result.data;
}

/**
 * Import player data from CSV string
 * @param {string} csvString - CSV data as string
 * @returns {Array} Array of Player objects
 */
export function importPlayers(csvString) {
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
export function importSchedule(csvString, teamsMap) {
  const data = parseCSV(csvString);
  
  // Skip header row if it exists
  const hasHeader = isScheduleHeaderRow(data[0]);
  let scheduleData = hasHeader ? data.slice(1) : data;
  
  // Filter out empty rows and special rows (SETUP, PACKING DOWN)
  scheduleData = scheduleData.filter(row => {
    // Skip completely empty rows
    if (row.every(cell => !cell || cell.trim() === "")) return false;
    
    // Check if this is a special row like SETUP or PACKING DOWN
    const isSpecialRow = row.some(cell => 
      cell && typeof cell === 'string' && 
      (cell.includes('SETUP') || cell.includes('PACKING DOWN'))
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
function processScheduleFormat(scheduleData, teamsMap) {
  const matches = [];
  let currentDivision = "";
  let timeSlotCounter = 1;
  
  for (let i = 0; i < scheduleData.length; i++) {
    const row = scheduleData[i];
    
    // Skip rows that are too short
    if (row.length < 6) continue;
    
    // Check if this row contains a division header
    if (row[0] && !row[2] && !row[3] && row[0] !== "Round") {
      currentDivision = row[0].toLowerCase();
      continue;
    }
    
    // Format detection and extraction
    let division, time, team1, team2, field, refereeTeam;
    
    // Try to detect if this is the tournament-specific format
    if (row[0] === "" && row[1] && row[2] && row[3] && row[4]) {
      // This is likely the tournament format where div is in column 1
      division = (row[1] || currentDivision || "").toLowerCase();
      time = row[2] || "";
      team1 = row[3] || "";
      team2 = row[4] || "";
      field = row[5] || "";
      refereeTeam = row[6] || "";
    } else {
      // Try generic format or fallback
      division = (row[1] || currentDivision || "").toLowerCase();
      time = row[2] || "";
      team1 = row[3] || "";
      team2 = row[4] || "";
      field = row[5] || "";
      refereeTeam = row[6] || "";
      
      // If division is empty or doesn't match expected format, try different column mapping
      if (!division || !division.match(/^(mx|m|w)/i)) {
        const firstCol = (row[0] || "").toLowerCase();
        if (firstCol.match(/^(mx|m|w)/i)) {
          // Division is in first column
          division = firstCol;
          // Shift other columns if needed
          if (!time && row[1]) time = row[1];
          if (!team1 && row[2]) team1 = row[2];
          if (!team2 && row[3]) team2 = row[3];
          if (!field && row[4]) field = row[4];
          if (!refereeTeam && row[5]) refereeTeam = row[5];
        }
      }
    }
    
    // Skip if essential data is missing
    if (!division || !team1 || !team2) continue;
    
    // Normalize division format (mx1, mx2, m1, m2, w)
    let normalizedDivision = division.toLowerCase();
    if (normalizedDivision.startsWith("mx")) {
      normalizedDivision = "mixed";
    } else if (normalizedDivision.startsWith("m")) {
      normalizedDivision = "gendered";
    } else if (normalizedDivision.startsWith("w")) {
      normalizedDivision = "gendered";
    } else {
      // Use division from context if available
      normalizedDivision = currentDivision || "mixed";
    }
    
    // Convert time to slot number if it's a time string
    let timeSlot = timeSlotCounter++;
    if (time && time.includes(":")) {
      // It's a time string, convert to numerical order
      const timeParts = time.split(":");
      if (timeParts.length === 2) {
        const hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);
        // Create a time value for sorting (e.g., 9:30 becomes 930)
        timeSlot = hours * 100 + minutes;
      }
    }
    
    // Look up teams in the team map
    let divTeams = teamsMap[normalizedDivision] || {};
    
    // Create teams if they don't exist in the map
    if (!divTeams[team1]) {
      divTeams[team1] = new Team(team1, normalizedDivision);
    }
    
    if (!divTeams[team2]) {
      divTeams[team2] = new Team(team2, normalizedDivision);
    }
    
    // Look up referee team if provided
    let refTeam = null;
    if (refereeTeam && refereeTeam !== "-") {
      // Extract team name if it has division in parentheses, e.g., "Team Name (MX)"
      const refTeamName = refereeTeam.split("(")[0].trim();
      
      if (divTeams[refTeamName]) {
        refTeam = divTeams[refTeamName];
      } else {
        // Try to find the referee team in any division
        for (const div in teamsMap) {
          if (teamsMap[div][refTeamName]) {
            refTeam = teamsMap[div][refTeamName];
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
    const match = new Match(
      divTeams[team1],
      divTeams[team2],
      timeSlot,
      field,
      normalizedDivision,
      refTeam
    );
    
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
function isHeaderRow(row) {
  if (!row || row.length === 0) return false;
  
  // Check if first value is a non-numeric string like "Name" or "Player"
  const firstCell = String(row[0]).toLowerCase();
  return isNaN(firstCell) && 
    (firstCell.includes('name') || 
     firstCell.includes('player') ||
     firstCell.includes('team'));
}

/**
 * Check if a row is likely a header row for schedule data
 * @param {Array} row - Row data
 * @returns {boolean} True if row appears to be a header
 */
function isScheduleHeaderRow(row) {
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