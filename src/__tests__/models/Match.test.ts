import { Match } from '../../models/Match';
import { Team, TeamsMap } from '../../models/Team';

describe('Match', () => {
  describe('createMatchesFromSchedule', () => {
    it('should allow referee teams from different divisions than playing teams', () => {
      // Create teams map with teams in different divisions
      const teamsMap: TeamsMap = {
        mixed: {
          'Mixed Team A': new Team('Mixed Team A', 'mixed'),
          'Mixed Team B': new Team('Mixed Team B', 'mixed'),
        },
        gendered: {
          'Gendered Team C': new Team('Gendered Team C', 'gendered'),
        },
        cloth: {
          'Cloth Team D': new Team('Cloth Team D', 'cloth'),
        },
      };

      // Create schedule data where referee is from a different division
      const scheduleData = [
        ['1', 'mixed', 'Field 1', 'Mixed Team A', 'Mixed Team B', 'Gendered Team C'], // Mixed teams with gendered referee
        ['2', 'gendered', 'Field 2', 'Gendered Team C', 'Mixed Team A', 'Cloth Team D'], // Invalid teams for demo
      ];

      // This should work for the first match (referee from different division)
      try {
        const matches = Match.createMatchesFromSchedule([scheduleData[0]], teamsMap);
        
        expect(matches).toHaveLength(1);
        expect(matches[0].team1.name).toBe('Mixed Team A');
        expect(matches[0].team2.name).toBe('Mixed Team B');
        expect(matches[0].refereeTeam?.name).toBe('Gendered Team C');
        expect(matches[0].refereeTeam?.division).toBe('gendered');
        expect(matches[0].division).toBe('mixed');
      } catch (error) {
        fail('Should not throw error when referee is from different division');
      }
    });

    it('should handle missing referee teams gracefully', () => {
      const teamsMap: TeamsMap = {
        mixed: {
          'Team A': new Team('Team A', 'mixed'),
          'Team B': new Team('Team B', 'mixed'),
        },
        gendered: {},
        cloth: {},
      };

      const scheduleData = [
        ['1', 'mixed', 'Field 1', 'Team A', 'Team B', 'Nonexistent Team'],
      ];

      const matches = Match.createMatchesFromSchedule(scheduleData, teamsMap);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].refereeTeam).toBeNull();
    });

    it('should prioritize exact matches when searching across divisions', () => {
      // Create teams with similar names in different divisions
      const teamsMap: TeamsMap = {
        mixed: {
          'Team X': new Team('Team X', 'mixed'),
          'Team Y': new Team('Team Y', 'mixed'),
        },
        gendered: {
          'Team X': new Team('Team X', 'gendered'), // Same name, different division
        },
        cloth: {},
      };

      const scheduleData = [
        ['1', 'mixed', 'Field 1', 'Team X', 'Team Y', 'Team X'], // Should find mixed Team X first
      ];

      const matches = Match.createMatchesFromSchedule(scheduleData, teamsMap);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].refereeTeam?.name).toBe('Team X');
      expect(matches[0].refereeTeam?.division).toBe('mixed'); // Should find mixed division first
    });
  });
}); 