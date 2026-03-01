import {
  buildPlayersCsv,
  buildScheduleCsv,
  normalizeMatches,
  normalizePlayers,
  resolveImportType,
} from '../../lib/aiImport';

describe('aiImport utilities', () => {
  test('normalizePlayers trims fields and removes empty names', () => {
    const rows = normalizePlayers([
      { name: '  Alex Kim  ', mixedClub: ' North Stars ' },
      { name: '   ' },
    ]);

    expect(rows).toEqual([{ name: 'Alex Kim', gender: '', mixedClub: 'North Stars', genderedClub: '', clothClub: '' }]);
  });

  test('buildPlayersCsv removes commas that would break parser splitting', () => {
    const csv = buildPlayersCsv([{ name: 'Taylor', mixedClub: 'Storm, East' }]);
    expect(csv).toContain('Name,Gender,Mixed Club,Gendered Club,Cloth Club');
    expect(csv).toContain('Taylor,,Storm East,,');
  });

  test('normalizeMatches keeps setup/packing rows without team2', () => {
    const rows = normalizeMatches([
      { round: 'Setup', team1: 'Field Crew', team2: '' },
      { round: 'Round 1', team1: 'A', team2: 'B' },
      { round: 'Round 2', team1: '', team2: 'C' },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].round).toBe('Setup');
    expect(rows[1].team2).toBe('B');
  });

  test('resolveImportType picks requested target and auto fallback correctly', () => {
    expect(
      resolveImportType({
        target: 'players',
        detectedType: 'schedule',
        playerCount: 1,
        matchCount: 20,
      })
    ).toBe('players');

    expect(
      resolveImportType({
        target: 'auto',
        detectedType: 'unknown',
        playerCount: 0,
        matchCount: 0,
      })
    ).toBeNull();

    expect(
      resolveImportType({
        target: 'auto',
        detectedType: 'unknown',
        playerCount: 3,
        matchCount: 1,
      })
    ).toBe('players');
  });

  test('buildScheduleCsv returns normalized schedule header and rows', () => {
    const csv = buildScheduleCsv([
      { round: 'Final', division: 'Mixed', time: '13:00', team1: 'Team A', team2: 'Team B', field: '1' },
      { round: 'Packing Down', team1: 'Field Crew' },
    ]);

    expect(csv).toContain('Round,Division,Time,Team1,Team2,Court,Referee');
    expect(csv).toContain('Final,Mixed,13:00,Team A,Team B,1,');
    expect(csv).toContain('Packing Down,,,Field Crew,,,');
  });
});
