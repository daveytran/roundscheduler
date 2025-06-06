import { importSchedule } from '../../lib/importUtils';
import { Team, TeamsMap } from '../../models/Team';

describe('Cross-Division Referee Integration', () => {
  it('should import schedule with referees from different divisions', () => {
    // Create a teams map with teams in different divisions
    const teamsMap: TeamsMap = {
      mixed: {
        'Mixed Team A': new Team('Mixed Team A', 'mixed'),
        'Mixed Team B': new Team('Mixed Team B', 'mixed'),
        'Mixed Team C': new Team('Mixed Team C', 'mixed'),
      },
      gendered: {
        'Gendered Team X': new Team('Gendered Team X', 'gendered'),
        'Gendered Team Y': new Team('Gendered Team Y', 'gendered'),
      },
      cloth: {
        'Cloth Team Z': new Team('Cloth Team Z', 'cloth'),
      },
    };

    // CSV with cross-division referees
    const csvData = `Time,Division,Field,Team1,Team2,Referee
1,mixed,Field 1,Mixed Team A,Mixed Team B,Gendered Team X
2,mixed,Field 2,Mixed Team B,Mixed Team C,Cloth Team Z
3,gendered,Field 1,Gendered Team X,Gendered Team Y,Mixed Team A`;

    const matches = importSchedule(csvData, teamsMap);

    expect(matches).toHaveLength(3);

    // Verify first match: mixed teams with gendered referee
    expect(matches[0].team1.name).toBe('Mixed Team A');
    expect(matches[0].team2.name).toBe('Mixed Team B');
    expect(matches[0].division).toBe('mixed');
    expect(matches[0].refereeTeam?.name).toBe('Gendered Team X');
    expect(matches[0].refereeTeam?.division).toBe('gendered');

    // Verify second match: mixed teams with cloth referee
    expect(matches[1].team1.name).toBe('Mixed Team B');
    expect(matches[1].team2.name).toBe('Mixed Team C');
    expect(matches[1].division).toBe('mixed');
    expect(matches[1].refereeTeam?.name).toBe('Cloth Team Z');
    expect(matches[1].refereeTeam?.division).toBe('cloth');

    // Verify third match: gendered teams with mixed referee
    expect(matches[2].team1.name).toBe('Gendered Team X');
    expect(matches[2].team2.name).toBe('Gendered Team Y');
    expect(matches[2].division).toBe('gendered');
    expect(matches[2].refereeTeam?.name).toBe('Mixed Team A');
    expect(matches[2].refereeTeam?.division).toBe('mixed');
  });

  it('should handle referee teams that do not exist and create them in the match division', () => {
    const teamsMap: TeamsMap = {
      mixed: {
        'Team A': new Team('Team A', 'mixed'),
        'Team B': new Team('Team B', 'mixed'),
      },
      gendered: {},
      cloth: {},
    };

    const csvData = `Time,Division,Field,Team1,Team2,Referee
1,mixed,Field 1,Team A,Team B,New Referee Team`;

    const matches = importSchedule(csvData, teamsMap);

    expect(matches).toHaveLength(1);
    expect(matches[0].refereeTeam?.name).toBe('New Referee Team');
    expect(matches[0].refereeTeam?.division).toBe('mixed'); // Should be created in match division
    
    // Verify the team was added to the teams map
    expect(teamsMap.mixed['New Referee Team']).toBeDefined();
    expect(teamsMap.mixed['New Referee Team'].division).toBe('mixed');
  });

  it('should find existing referee teams across divisions before creating new ones', () => {
    const teamsMap: TeamsMap = {
      mixed: {
        'Team A': new Team('Team A', 'mixed'),
        'Team B': new Team('Team B', 'mixed'),
      },
      gendered: {
        'Existing Referee': new Team('Existing Referee', 'gendered'),
      },
      cloth: {},
    };

    const csvData = `Time,Division,Field,Team1,Team2,Referee
1,mixed,Field 1,Team A,Team B,Existing Referee`;

    const matches = importSchedule(csvData, teamsMap);

    expect(matches).toHaveLength(1);
    expect(matches[0].refereeTeam?.name).toBe('Existing Referee');
    expect(matches[0].refereeTeam?.division).toBe('gendered'); // Should use existing team from gendered division
    
    // Verify no new team was created in mixed division
    expect(teamsMap.mixed['Existing Referee']).toBeUndefined();
  });
}); 