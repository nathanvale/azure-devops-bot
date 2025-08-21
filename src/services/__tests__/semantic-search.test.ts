import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SemanticSearchEngine, 
  QueryIntent, 
  type Concept, 
  type SemanticQuery, 
  type SemanticMatch 
} from '../semantic-search.js';

describe('SemanticSearchEngine', () => {
  let engine: SemanticSearchEngine;

  beforeEach(() => {
    engine = new SemanticSearchEngine();
  });

  // Test data helper
  const createTestWorkItem = (overrides = {}) => ({
    id: Math.floor(Math.random() * 10000),
    title: 'Test Work Item',
    description: 'Test description',
    type: 'User Story',
    state: 'Active',
    lastUpdatedAt: new Date(),
    ...overrides
  });

  describe('Concept Extraction', () => {
    describe('Domain Recognition', () => {
      it('should extract security/authentication concepts', () => {
        const concepts = engine.extractConcepts('authentication login issues with oauth token');
        
        expect(concepts).toHaveLength(4);
        expect(concepts.map(c => c.term)).toContain('authentication');
        expect(concepts.map(c => c.term)).toContain('login');
        expect(concepts.map(c => c.term)).toContain('oauth');
        expect(concepts.map(c => c.term)).toContain('token');
        
        const authConcept = concepts.find(c => c.term === 'authentication');
        expect(authConcept?.domain).toBe('security');
        expect(authConcept?.weight).toBe(0.9); // Primary concept
      });

      it('should extract database concepts', () => {
        const concepts = engine.extractConcepts('database migration with SQL schema changes');
        
        expect(concepts.some(c => c.term === 'database' && c.domain === 'database')).toBe(true);
        expect(concepts.some(c => c.term === 'migration' && c.domain === 'database')).toBe(true);
        expect(concepts.some(c => c.term === 'sql' && c.domain === 'database')).toBe(true);
        expect(concepts.some(c => c.term === 'schema' && c.domain === 'database')).toBe(true);
      });

      it('should extract API concepts', () => {
        const concepts = engine.extractConcepts('REST API endpoint microservice integration');
        
        expect(concepts.some(c => c.term === 'api' && c.domain === 'api')).toBe(true);
        expect(concepts.some(c => c.term === 'endpoint' && c.domain === 'api')).toBe(true);
        expect(concepts.some(c => c.term === 'microservice' && c.domain === 'api')).toBe(true);
        expect(concepts.some(c => c.term === 'rest' && c.domain === 'api')).toBe(true);
      });

      it('should extract frontend concepts', () => {
        const concepts = engine.extractConcepts('React component UI interface styling');
        
        expect(concepts.some(c => c.term === 'react' && c.domain === 'frontend')).toBe(true);
        expect(concepts.some(c => c.term === 'component' && c.domain === 'frontend')).toBe(true);
        expect(concepts.some(c => c.term === 'interface' && c.domain === 'frontend')).toBe(true);
      });

      it('should extract performance concepts', () => {
        const concepts = engine.extractConcepts('performance optimization slow cache memory');
        
        expect(concepts.some(c => c.term === 'performance' && c.domain === 'performance')).toBe(true);
        expect(concepts.some(c => c.term === 'optimization' && c.domain === 'performance')).toBe(true);
        expect(concepts.some(c => c.term === 'slow' && c.domain === 'performance')).toBe(true);
        expect(concepts.some(c => c.term === 'cache' && c.domain === 'performance')).toBe(true);
      });
    });

    describe('Concept Weighting', () => {
      it('should assign higher weights to primary concepts', () => {
        const concepts = engine.extractConcepts('authentication with login token');
        
        const authConcept = concepts.find(c => c.term === 'authentication');
        const loginConcept = concepts.find(c => c.term === 'login');
        
        expect(authConcept?.weight).toBe(0.9); // Primary
        expect(loginConcept?.weight).toBe(0.6); // Secondary
      });

      it('should sort concepts by weight', () => {
        const concepts = engine.extractConcepts('login authentication oauth token');
        
        // Should be sorted by weight (primary concepts first)
        expect(concepts[0].weight).toBeGreaterThanOrEqual(concepts[1].weight);
        expect(concepts[1].weight).toBeGreaterThanOrEqual(concepts[2].weight);
      });
    });

    describe('Fuzzy Matching', () => {
      it('should expand abbreviations', () => {
        const concepts = engine.extractConcepts('auth db api ui perf');
        
        expect(concepts.some(c => c.term === 'authentication')).toBe(true);
        expect(concepts.some(c => c.term === 'database')).toBe(true);
        expect(concepts.some(c => c.term === 'api')).toBe(true);
        expect(concepts.some(c => c.term === 'interface')).toBe(true);
        expect(concepts.some(c => c.term === 'performance')).toBe(true);
      });

      it('should assign lower weights to fuzzy matches', () => {
        const concepts = engine.extractConcepts('auth');
        
        const authConcept = concepts.find(c => c.term === 'auth');
        const authenticationConcept = concepts.find(c => c.term === 'authentication');
        
        expect(authConcept?.weight).toBe(0.6); // Secondary match
        expect(authenticationConcept?.weight).toBe(0.48); // 0.6 * 0.8 (fuzzy penalty)
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty input', () => {
        const concepts = engine.extractConcepts('');
        expect(concepts).toHaveLength(0);
      });

      it('should handle text with no technical concepts', () => {
        const concepts = engine.extractConcepts('the quick brown fox jumps over lazy dog');
        expect(concepts).toHaveLength(0);
      });

      it('should deduplicate concepts', () => {
        const concepts = engine.extractConcepts('authentication auth login authentication');
        
        const authTerms = concepts.filter(c => c.term === 'authentication');
        expect(authTerms).toHaveLength(1);
      });
    });
  });

  describe('Intent Recognition', () => {
    it('should recognize FIND_SIMILAR intent', () => {
      expect(engine.recognizeIntent('find similar work to this')).toBe(QueryIntent.FIND_SIMILAR);
      expect(engine.recognizeIntent('work like this task')).toBe(QueryIntent.FIND_SIMILAR);
      expect(engine.recognizeIntent('similar tasks I have done')).toBe(QueryIntent.FIND_SIMILAR);
      expect(engine.recognizeIntent('comparable work items')).toBe(QueryIntent.FIND_SIMILAR);
    });

    it('should recognize REFERENCE_PAST intent', () => {
      expect(engine.recognizeIntent('how I solved authentication before')).toBe(QueryIntent.REFERENCE_PAST);
      expect(engine.recognizeIntent('bugs I fixed previously')).toBe(QueryIntent.REFERENCE_PAST);
      expect(engine.recognizeIntent('previous solution for database issues')).toBe(QueryIntent.REFERENCE_PAST);
      expect(engine.recognizeIntent('work I completed before')).toBe(QueryIntent.REFERENCE_PAST);
    });

    it('should recognize SEARCH_CONTENT intent', () => {
      expect(engine.recognizeIntent('bugs about authentication')).toBe(QueryIntent.SEARCH_CONTENT);
      expect(engine.recognizeIntent('tasks related to database')).toBe(QueryIntent.SEARCH_CONTENT);
      expect(engine.recognizeIntent('find work containing API')).toBe(QueryIntent.SEARCH_CONTENT);
      expect(engine.recognizeIntent('stories involving performance')).toBe(QueryIntent.SEARCH_CONTENT);
    });

    it('should recognize EXPLORE_RELATED intent', () => {
      expect(engine.recognizeIntent('work related to authentication')).toBe(QueryIntent.EXPLORE_RELATED);
      expect(engine.recognizeIntent('tasks connected with database')).toBe(QueryIntent.EXPLORE_RELATED);
      expect(engine.recognizeIntent('items associated with API')).toBe(QueryIntent.EXPLORE_RELATED);
    });

    it('should default to GENERAL_SEARCH for unclear intent', () => {
      expect(engine.recognizeIntent('show me work items')).toBe(QueryIntent.GENERAL_SEARCH);
      expect(engine.recognizeIntent('authentication database')).toBe(QueryIntent.GENERAL_SEARCH);
      expect(engine.recognizeIntent('random query text')).toBe(QueryIntent.GENERAL_SEARCH);
    });
  });

  describe('Semantic Query Parsing', () => {
    it('should parse complete semantic query', () => {
      const query = 'authentication bugs I solved before';
      const semanticQuery = engine.parseSemanticQuery(query);

      expect(semanticQuery.originalQuery).toBe(query);
      expect(semanticQuery.intent).toBe(QueryIntent.REFERENCE_PAST);
      expect(semanticQuery.concepts.some(c => c.term === 'authentication')).toBe(true);
      expect(semanticQuery.confidence).toBeGreaterThan(0.5);
      expect(semanticQuery.filters?.completed).toBe(true);
      expect(semanticQuery.filters?.workItemTypes).toEqual(['Bug']);
    });

    it('should extract work item type filters', () => {
      const bugQuery = engine.parseSemanticQuery('authentication bugs');
      expect(bugQuery.filters?.workItemTypes).toEqual(['Bug']);

      const storyQuery = engine.parseSemanticQuery('user story about login');
      expect(storyQuery.filters?.workItemTypes).toEqual(['User Story', 'Product Backlog Item']);

      const taskQuery = engine.parseSemanticQuery('database migration task');
      expect(taskQuery.filters?.workItemTypes).toEqual(['Task']);
    });

    it('should extract domain filters', () => {
      const query = engine.parseSemanticQuery('authentication and database work');
      expect(query.filters?.domains).toContain('security');
      expect(query.filters?.domains).toContain('database');
    });

    it('should calculate confidence scores', () => {
      const simpleQuery = engine.parseSemanticQuery('auth');
      const complexQuery = engine.parseSemanticQuery('authentication bugs I solved before with oauth tokens');

      expect(complexQuery.confidence).toBeGreaterThan(simpleQuery.confidence);
      expect(simpleQuery.confidence).toBeGreaterThan(0);
      expect(complexQuery.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Similarity Calculation', () => {
    const mockSemanticQuery: SemanticQuery = {
      originalQuery: 'authentication bugs',
      intent: QueryIntent.SEARCH_CONTENT,
      concepts: [
        { term: 'authentication', domain: 'security', weight: 0.9, synonyms: ['auth', 'login'] },
        { term: 'bug', domain: 'testing', weight: 0.9, synonyms: ['issue', 'defect'] }
      ],
      confidence: 0.8,
      filters: { workItemTypes: ['Bug'] }
    };

    it('should calculate high similarity for matching work items', () => {
      const workItem = createTestWorkItem({
        title: 'Authentication login bug fix',
        description: 'Fixed authentication issues in login flow',
        type: 'Bug'
      });

      const match = engine.calculateSimilarity(mockSemanticQuery, workItem);

      expect(match.score).toBeGreaterThan(0.7);
      expect(match.factorScores.conceptOverlap).toBeGreaterThan(0.5);
      expect(match.factorScores.workItemType).toBe(1.0);
      expect(match.reasons).toContain('Exact work item type match');
    });

    it('should calculate low similarity for non-matching work items', () => {
      const workItem = createTestWorkItem({
        title: 'Database migration script',
        description: 'Update database schema for new features',
        type: 'Task'
      });

      const match = engine.calculateSimilarity(mockSemanticQuery, workItem);

      expect(match.score).toBeLessThan(0.4);
      expect(match.factorScores.conceptOverlap).toBe(0);
      expect(match.factorScores.workItemType).toBe(0);
    });

    it('should prefer recent work items', () => {
      const recentItem = createTestWorkItem({
        title: 'Authentication bug',
        lastUpdatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        type: 'Bug'
      });

      const oldItem = createTestWorkItem({
        title: 'Authentication bug', 
        lastUpdatedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        type: 'Bug'
      });

      const recentMatch = engine.calculateSimilarity(mockSemanticQuery, recentItem);
      const oldMatch = engine.calculateSimilarity(mockSemanticQuery, oldItem);

      expect(recentMatch.factorScores.recency).toBeGreaterThan(oldMatch.factorScores.recency);
    });

    it('should prefer completed work for reference queries', () => {
      const referenceQuery: SemanticQuery = {
        ...mockSemanticQuery,
        intent: QueryIntent.REFERENCE_PAST
      };

      const completedItem = createTestWorkItem({
        title: 'Authentication bug',
        state: 'Closed',
        type: 'Bug'
      });

      const activeItem = createTestWorkItem({
        title: 'Authentication bug',
        state: 'Active', 
        type: 'Bug'
      });

      const completedMatch = engine.calculateSimilarity(referenceQuery, completedItem);
      const activeMatch = engine.calculateSimilarity(referenceQuery, activeItem);

      expect(completedMatch.factorScores.completionContext).toBeGreaterThan(activeMatch.factorScores.completionContext);
    });
  });

  describe('Find Similar Work Items', () => {
    const workItems = [
      createTestWorkItem({
        id: 1,
        title: 'Authentication login bug',
        description: 'Fixed oauth token validation issues',
        type: 'Bug',
        state: 'Closed'
      }),
      createTestWorkItem({
        id: 2,
        title: 'Database migration script',
        description: 'Updated schema for user table',
        type: 'Task',
        state: 'Done'
      }),
      createTestWorkItem({
        id: 3,
        title: 'API performance optimization',
        description: 'Improved response time for authentication endpoints',
        type: 'Story',
        state: 'Active'
      }),
      createTestWorkItem({
        id: 4,
        title: 'Random unrelated work',
        description: 'Something completely different',
        type: 'Task',
        state: 'New'
      })
    ];

    it('should find and rank similar work items', async () => {
      const query = 'authentication bugs I solved';
      const matches = await engine.findSimilarWorkItems(query, workItems);

      expect(matches).toHaveLength(2); // Should filter out low-scoring matches
      expect(matches[0].workItemId).toBe(1); // Authentication bug should score highest
      expect(matches[0].score).toBeGreaterThan(matches[1].score);
    });

    it('should apply minimum threshold filtering', async () => {
      const query = 'completely unrelated topic';
      const matches = await engine.findSimilarWorkItems(query, workItems);

      // Should return very few or no matches due to low similarity
      expect(matches.every(match => match.score >= 0.3)).toBe(true);
    });

    it('should handle empty work items array', async () => {
      const matches = await engine.findSimilarWorkItems('authentication bugs', []);
      expect(matches).toHaveLength(0);
    });

    it('should provide meaningful match reasons', async () => {
      const query = 'authentication performance work';
      const matches = await engine.findSimilarWorkItems(query, workItems);

      const topMatch = matches[0];
      expect(topMatch.reasons.length).toBeGreaterThan(0);
      expect(topMatch.reasons.some(reason => reason.includes('concept match') || reason.includes('domain'))).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex multi-domain queries', async () => {
      const query = 'authentication API performance bugs I fixed last year';
      const semanticQuery = engine.parseSemanticQuery(query);

      expect(semanticQuery.concepts.some(c => c.domain === 'security')).toBe(true);
      expect(semanticQuery.concepts.some(c => c.domain === 'api')).toBe(true);
      expect(semanticQuery.concepts.some(c => c.domain === 'performance')).toBe(true);
      expect(semanticQuery.intent).toBe(QueryIntent.REFERENCE_PAST);
      expect(semanticQuery.filters?.completed).toBe(true);
    });

    it('should prioritize domain relevance', async () => {
      const workItems = [
        createTestWorkItem({
          id: 1,
          title: 'Database authentication module',
          description: 'Auth logic in database layer',
          type: 'Bug'
        }),
        createTestWorkItem({
          id: 2,
          title: 'Pure authentication service',
          description: 'Core authentication and authorization service',
          type: 'Bug'
        })
      ];

      const matches = await engine.findSimilarWorkItems('authentication security work', workItems);
      
      // Pure auth service should score higher due to stronger domain relevance
      expect(matches[0].workItemId).toBe(2);
    });

    it('should handle queries with synonyms and abbreviations', async () => {
      const workItems = [
        createTestWorkItem({
          title: 'Auth service bug',
          description: 'Login token validation error'
        })
      ];

      const matches = await engine.findSimilarWorkItems('authentication issues', workItems);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].score).toBeGreaterThan(0.5);
    });
  });
});