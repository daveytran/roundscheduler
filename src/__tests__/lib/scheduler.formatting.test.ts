import { Match } from '../../models/Match';
import { createDivisionBlocks } from '../../lib/scheduler';
import { createMockTeam } from '../../lib/testUtils';

describe('createDivisionBlocks', () => {
  it('preserves activityType and locked flags when rebuilding matches', () => {
    const teamA = createMockTeam('Team A', 'mixed');
    const teamB = createMockTeam('Team B', 'mixed');
    const teamC = createMockTeam('Team C', 'gendered');
    const teamD = createMockTeam('Team D', 'gendered');

    const setup = new Match(teamA, teamB, 1, 'Field 1', 'mixed', null, 'SETUP', true);
    const regular = new Match(teamC, teamD, 2, 'Field 2', 'gendered', null, 'REGULAR', false);
    const packdown = new Match(teamA, teamB, 3, 'Field 1', 'mixed', null, 'PACKING_DOWN', true);

    const formatted = createDivisionBlocks([setup, regular, packdown], 'mixed,gendered,cloth');

    expect(formatted).toHaveLength(3);
    expect(formatted[0].activityType).toBe('SETUP');
    expect(formatted[0].locked).toBe(true);
    expect(formatted[1].activityType).toBe('PACKING_DOWN');
    expect(formatted[1].locked).toBe(true);
    expect(formatted[2].activityType).toBe('REGULAR');
    expect(formatted[2].locked).toBe(false);
  });
});

