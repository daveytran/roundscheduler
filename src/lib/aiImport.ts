export type AIImportTarget = 'players' | 'schedule' | 'auto';
export type AIDetectedType = 'players' | 'schedule' | 'unknown';

export interface AIPlayerRow {
  name: string;
  gender?: string;
  mixedClub?: string;
  genderedClub?: string;
  clothClub?: string;
}

export interface AIScheduleRow {
  round?: string;
  division?: string;
  time?: string;
  field?: string;
  team1?: string;
  team2?: string;
  referee?: string;
}

const compressWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const sanitizeCell = (value: string | undefined): string => {
  if (!value) return '';
  return compressWhitespace(value.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/,/g, ' '));
};

const isSpecialScheduleRow = (row: AIScheduleRow): boolean => {
  const combinedText = `${row.round || ''} ${row.team1 || ''} ${row.team2 || ''}`.toLowerCase();
  return combinedText.includes('setup') || combinedText.includes('packing');
};

export const normalizePlayers = (rows: AIPlayerRow[]): AIPlayerRow[] => {
  return rows
    .map(row => ({
      name: sanitizeCell(row.name),
      gender: sanitizeCell(row.gender),
      mixedClub: sanitizeCell(row.mixedClub),
      genderedClub: sanitizeCell(row.genderedClub),
      clothClub: sanitizeCell(row.clothClub),
    }))
    .filter(row => row.name.length > 0);
};

export const normalizeMatches = (rows: AIScheduleRow[]): AIScheduleRow[] => {
  return rows
    .map(row => ({
      round: sanitizeCell(row.round),
      division: sanitizeCell(row.division),
      time: sanitizeCell(row.time),
      field: sanitizeCell(row.field),
      team1: sanitizeCell(row.team1),
      team2: sanitizeCell(row.team2),
      referee: sanitizeCell(row.referee),
    }))
    .filter(row => {
      if (!row.team1) return false;
      if (row.team2) return true;
      return isSpecialScheduleRow(row);
    });
};

export const buildPlayersCsv = (rows: AIPlayerRow[]): string => {
  const normalizedRows = normalizePlayers(rows);
  const header = ['Name', 'Gender', 'Mixed Club', 'Gendered Club', 'Cloth Club'];
  const body = normalizedRows.map(row =>
    [row.name, row.gender || '', row.mixedClub || '', row.genderedClub || '', row.clothClub || ''].join(',')
  );

  return [header.join(','), ...body].join('\n');
};

export const buildScheduleCsv = (rows: AIScheduleRow[]): string => {
  const normalizedRows = normalizeMatches(rows);
  const header = ['Round', 'Division', 'Time', 'Team1', 'Team2', 'Court', 'Referee'];
  const body = normalizedRows.map(row =>
    [row.round || '', row.division || '', row.time || '', row.team1 || '', row.team2 || '', row.field || '', row.referee || ''].join(',')
  );

  return [header.join(','), ...body].join('\n');
};

export const resolveImportType = ({
  target,
  detectedType,
  playerCount,
  matchCount,
}: {
  target: AIImportTarget;
  detectedType: AIDetectedType;
  playerCount: number;
  matchCount: number;
}): 'players' | 'schedule' | null => {
  if (target === 'players' || target === 'schedule') {
    return target;
  }

  if (detectedType === 'players' && playerCount > 0) {
    return 'players';
  }

  if (detectedType === 'schedule' && matchCount > 0) {
    return 'schedule';
  }

  if (playerCount === 0 && matchCount === 0) {
    return null;
  }

  if (playerCount >= matchCount) {
    return 'players';
  }

  return 'schedule';
};
