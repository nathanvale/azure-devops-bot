export interface Concept {
  term: string;           // The concept term (e.g., "authentication")
  domain: string;         // Technical domain (e.g., "security")
  weight: number;         // Importance score (0-1)
  synonyms: string[];     // Related terms
  context?: string;       // Additional context
}

export interface SemanticMatch {
  workItemId: number;
  score: number;          // Overall similarity score (0-1)
  reasons: string[];      // Human-readable explanations
  concepts: Concept[];    // Matched concepts
  factorScores: {
    conceptOverlap: number;     // How many concepts match
    domainRelevance: number;    // Same technical domain
    workItemType: number;       // Type relevance
    recency: number;            // Time relevance
    completionContext: number;  // Success context
  };
}

export enum QueryIntent {
  FIND_SIMILAR = 'find_similar',      // "work like this", "similar tasks"
  SEARCH_CONTENT = 'search_content',  // "bugs about auth", "API work"
  REFERENCE_PAST = 'reference_past',  // "how I solved", "I fixed before"
  EXPLORE_RELATED = 'explore_related', // "related to", "connected with"
  GENERAL_SEARCH = 'general_search'   // Default fallback
}

export interface SemanticQuery {
  originalQuery: string;
  intent: QueryIntent;
  concepts: Concept[];
  confidence: number;     // How confident we are in the parsing
  filters?: {
    domains?: string[];
    workItemTypes?: string[];
    timeRange?: { start?: Date; end?: Date };
    completed?: boolean;
  };
}

export class SemanticSearchEngine {
  private static readonly DOMAIN_CONCEPTS = {
    // Security & Authentication
    security: {
      primary: ['authentication', 'authorization', 'security'],
      secondary: ['login', 'password', 'token', 'oauth', 'sso', 'jwt', 'session', 'certificate', 'encryption']
    },
    
    // Database & Data
    database: {
      primary: ['database', 'data', 'sql', 'query'],
      secondary: ['migration', 'schema', 'table', 'connection', 'orm', 'prisma', 'mysql', 'postgres', 'mongodb']
    },
    
    // API & Services
    api: {
      primary: ['api', 'service', 'endpoint', 'microservice'],
      secondary: ['rest', 'graphql', 'webhook', 'integration', 'http', 'request', 'response', 'json']
    },
    
    // Frontend & UI
    frontend: {
      primary: ['frontend', 'ui', 'interface', 'component'],
      secondary: ['react', 'angular', 'vue', 'html', 'css', 'javascript', 'typescript', 'styling', 'layout']
    },
    
    // Performance & Optimization
    performance: {
      primary: ['performance', 'optimization', 'speed', 'slow'],
      secondary: ['cache', 'memory', 'cpu', 'load', 'latency', 'bottleneck', 'monitoring', 'profiling']
    },
    
    // Testing & Quality
    testing: {
      primary: ['test', 'testing', 'quality', 'bug'],
      secondary: ['unit', 'integration', 'e2e', 'automation', 'coverage', 'regression', 'validation']
    },
    
    // DevOps & Infrastructure
    devops: {
      primary: ['deployment', 'infrastructure', 'devops', 'ci'],
      secondary: ['docker', 'kubernetes', 'pipeline', 'build', 'deploy', 'cloud', 'aws', 'azure', 'monitoring']
    }
  };

  private static readonly INTENT_PATTERNS = {
    [QueryIntent.FIND_SIMILAR]: [
      /similar\s+to/i, /like\s+this/i, /comparable/i, /related\s+work/i,
      /similar\s+(tasks?|work|items?)/i, /work\s+like/i
    ],
    [QueryIntent.REFERENCE_PAST]: [
      /how\s+i\s+(solved|fixed|handled)/i, /i\s+(solved|fixed|completed|did)\s+(before|previously)/i,
      /previous\s+(solution|work|fix)/i, /(before|previously|earlier)/i,
      /(bugs?|work|tasks?)\s+i\s+(fixed|solved|completed)/i, /i\s+(fixed|solved|completed)/i
    ],
    [QueryIntent.EXPLORE_RELATED]: [
      /work\s+related\s+to/i, /tasks?\s+connected\s+(with|to)/i, /items?\s+associated\s+with/i,
      /connected\s+(with|to)/i, /associated\s+with/i
    ],
    [QueryIntent.SEARCH_CONTENT]: [
      /(bugs?|tasks?|stories?|work)\s+(about|involving)/i,
      /find\s+(work|items?)\s+(with|containing|about)/i,
      /tasks?\s+related\s+to/i
    ]
  };

  private static readonly FUZZY_MAPPINGS: Record<string, string> = {
    // Common abbreviations
    'auth': 'authentication',
    'db': 'database',
    'api': 'api',
    'ui': 'interface',
    'perf': 'performance',
    'config': 'configuration',
    'env': 'environment',
    'prod': 'production',
    'dev': 'development',
    'qa': 'testing',
    
    // Technical variations
    'rest': 'api',
    'endpoint': 'api',
    'microservice': 'service',
    'frontend': 'ui',
    'backend': 'service',
    'css': 'styling',
    'js': 'javascript',
    'ts': 'typescript'
  };

  /**
   * Extract semantic concepts from a text query
   */
  extractConcepts(text: string): Concept[] {
    const normalizedText = text.toLowerCase().trim();
    const concepts: Concept[] = [];
    const words = this.tokenize(normalizedText);

    // Apply fuzzy mappings first to expand abbreviations
    const expandedWords = [...words];
    words.forEach(word => {
      const fuzzyMatch = SemanticSearchEngine.FUZZY_MAPPINGS[word];
      if (fuzzyMatch && !expandedWords.includes(fuzzyMatch)) {
        expandedWords.push(fuzzyMatch);
      }
    });

    // Extract domain concepts from both original and expanded words
    for (const [domain, domainData] of Object.entries(SemanticSearchEngine.DOMAIN_CONCEPTS)) {
      const primaryMatches = this.findMatches(expandedWords, domainData.primary);
      const secondaryMatches = this.findMatches(expandedWords, domainData.secondary);

      if (primaryMatches.length > 0 || secondaryMatches.length > 0) {
        // Primary concepts get higher weight
        primaryMatches.forEach(match => {
          // Check if this is from an abbreviation
          const isFromAbbreviation = words.some(word => SemanticSearchEngine.FUZZY_MAPPINGS[word] === match);
          const weight = isFromAbbreviation ? 0.48 : 0.9; // Lower weight for abbreviations
          
          concepts.push({
            term: match,
            domain,
            weight,
            synonyms: domainData.secondary,
            context: isFromAbbreviation ? `Expanded from abbreviation` : `Primary ${domain} concept`
          });
        });

        // Secondary concepts get lower weight
        secondaryMatches.forEach(match => {
          const isFromAbbreviation = words.some(word => SemanticSearchEngine.FUZZY_MAPPINGS[word] === match);
          const weight = isFromAbbreviation ? 0.48 : 0.6; // Even lower weight for secondary abbreviations
          
          concepts.push({
            term: match,
            domain,
            weight,
            synonyms: domainData.primary.concat(domainData.secondary.filter(s => s !== match)),
            context: isFromAbbreviation ? `Secondary concept from abbreviation` : `Secondary ${domain} concept`
          });
        });
      }
    }

    // Add original abbreviations as concepts too
    words.forEach(word => {
      const fuzzyMatch = SemanticSearchEngine.FUZZY_MAPPINGS[word];
      if (fuzzyMatch && !concepts.some(c => c.term === word)) {
        // Find the domain for the expanded term
        for (const [domain, domainData] of Object.entries(SemanticSearchEngine.DOMAIN_CONCEPTS)) {
          if (domainData.primary.includes(fuzzyMatch) || domainData.secondary.includes(fuzzyMatch)) {
            concepts.push({
              term: word,
              domain,
              weight: 0.6, // Secondary weight for abbreviations
              synonyms: [fuzzyMatch],
              context: `Abbreviation for ${fuzzyMatch}`
            });
            break;
          }
        }
      }
    });

    // Remove duplicates and sort by weight
    const uniqueConcepts = this.deduplicateConcepts(concepts);
    return uniqueConcepts.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Recognize query intent from natural language
   */
  recognizeIntent(query: string): QueryIntent {
    const normalizedQuery = query.toLowerCase().trim();

    for (const [intent, patterns] of Object.entries(SemanticSearchEngine.INTENT_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(normalizedQuery))) {
        return intent as QueryIntent;
      }
    }

    return QueryIntent.GENERAL_SEARCH;
  }

  /**
   * Parse a natural language query into structured semantic query
   */
  parseSemanticQuery(query: string): SemanticQuery {
    const concepts = this.extractConcepts(query);
    const intent = this.recognizeIntent(query);
    
    // Calculate confidence based on concept extraction and intent recognition
    const confidence = this.calculateParsingConfidence(query, concepts, intent);

    // Extract additional filters based on intent and concepts
    const filters = this.extractFilters(query, concepts, intent);

    return {
      originalQuery: query,
      intent,
      concepts,
      confidence,
      filters
    };
  }

  /**
   * Calculate similarity between semantic query and work item
   */
  calculateSimilarity(semanticQuery: SemanticQuery, workItem: any): SemanticMatch {
    const workItemText = `${workItem.title} ${workItem.description || ''}`.toLowerCase();
    const workItemConcepts = this.extractConcepts(workItemText);

    // Calculate individual factor scores
    const factorScores = {
      conceptOverlap: this.calculateConceptOverlap(semanticQuery.concepts, workItemConcepts),
      domainRelevance: this.calculateDomainRelevance(semanticQuery.concepts, workItemConcepts),
      workItemType: this.calculateTypeRelevance(semanticQuery, workItem),
      recency: this.calculateRecencyScore(workItem),
      completionContext: this.calculateCompletionScore(workItem, semanticQuery.intent)
    };

    // Weighted overall score
    const weights = {
      conceptOverlap: 0.35,
      domainRelevance: 0.35,
      workItemType: 0.15,
      recency: 0.075,
      completionContext: 0.075
    };

    const overallScore = Object.entries(factorScores).reduce(
      (sum, [factor, score]) => sum + (weights[factor as keyof typeof weights] * score),
      0
    );

    // Generate human-readable reasons
    const reasons = this.generateMatchReasons(factorScores, semanticQuery, workItemConcepts);

    return {
      workItemId: workItem.id,
      score: Math.min(overallScore, 1.0), // Cap at 1.0
      reasons,
      concepts: workItemConcepts,
      factorScores
    };
  }

  /**
   * Find similar work items using semantic search
   */
  async findSimilarWorkItems(query: string, workItems: any[]): Promise<SemanticMatch[]> {
    const semanticQuery = this.parseSemanticQuery(query);
    
    // Calculate similarity for each work item
    const matches = workItems.map(item => this.calculateSimilarity(semanticQuery, item));
    
    // Filter by minimum score threshold and sort
    const threshold = 0.25; // Minimum similarity threshold
    return matches
      .filter(match => match.score >= threshold)
      .sort((a, b) => b.score - a.score);
  }

  // Private helper methods

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(word => word.length > 1); // Filter out very short words (changed from 2 to 1)
  }

  private findMatches(words: string[], terms: string[]): string[] {
    const matches: string[] = [];
    
    for (const term of terms) {
      // Direct word match
      if (words.includes(term)) {
        matches.push(term);
        continue;
      }
      
      // Partial match in compound words - be more selective
      const partialMatch = words.find(word => {
        // Only match if word contains the term and the term is significant
        if (word.includes(term) && term.length >= 3) {
          // Don't match if it's a substring of a common word that isn't technical
          const commonWords = ['over', 'under', 'after', 'before', 'about', 'above', 'below'];
          if (commonWords.includes(word)) return false;
          return true;
        }
        return false;
      });
      if (partialMatch) {
        matches.push(term);
      }
    }
    
    return matches;
  }

  private deduplicateConcepts(concepts: Concept[]): Concept[] {
    const seen = new Set<string>();
    return concepts.filter(concept => {
      const key = `${concept.term}-${concept.domain}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateParsingConfidence(query: string, concepts: Concept[], intent: QueryIntent): number {
    let confidence = 0.5; // Base confidence
    
    // More concepts = higher confidence
    confidence += Math.min(concepts.length * 0.1, 0.3);
    
    // Non-general intent = higher confidence
    if (intent !== QueryIntent.GENERAL_SEARCH) {
      confidence += 0.2;
    }
    
    // Longer, more specific queries = higher confidence
    const wordCount = query.split(/\s+/).length;
    confidence += Math.min(wordCount * 0.05, 0.2);
    
    return Math.min(confidence, 1.0);
  }

  private extractFilters(query: string, concepts: Concept[], intent: QueryIntent): SemanticQuery['filters'] {
    const filters: SemanticQuery['filters'] = {};

    // Extract domains from concepts
    const domains = [...new Set(concepts.map(c => c.domain))];
    if (domains.length > 0) {
      filters.domains = domains;
    }

    // Intent-based filters
    if (intent === QueryIntent.REFERENCE_PAST) {
      filters.completed = true;
    }

    // Work item type hints from query
    const queryLower = query.toLowerCase();
    if (queryLower.includes('bug')) {
      filters.workItemTypes = ['Bug'];
    } else if (queryLower.includes('story') || queryLower.includes('feature')) {
      filters.workItemTypes = ['User Story', 'Product Backlog Item'];
    } else if (queryLower.includes('task')) {
      filters.workItemTypes = ['Task'];
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  }

  private calculateConceptOverlap(queryConcepts: Concept[], itemConcepts: Concept[]): number {
    if (queryConcepts.length === 0) return 0;

    const queryTerms = new Set(queryConcepts.map(c => c.term));
    const itemTerms = new Set(itemConcepts.map(c => c.term));
    
    const intersection = new Set([...queryTerms].filter(term => itemTerms.has(term)));
    return intersection.size / queryTerms.size;
  }

  private calculateDomainRelevance(queryConcepts: Concept[], itemConcepts: Concept[]): number {
    if (queryConcepts.length === 0) return 0;

    const queryDomains = new Set(queryConcepts.map(c => c.domain));
    const itemDomains = new Set(itemConcepts.map(c => c.domain));
    
    const intersection = new Set([...queryDomains].filter(domain => itemDomains.has(domain)));
    const basicRelevance = intersection.size / queryDomains.size;
    
    // Bonus for domain concentration - prefer items with more concepts from matching domains
    let concentrationBonus = 0;
    for (const domain of intersection) {
      const queryConceptsInDomain = queryConcepts.filter(c => c.domain === domain).length;
      const itemConceptsInDomain = itemConcepts.filter(c => c.domain === domain);
      
      // Bonus based on how many concepts from this domain are in the item
      const domainRatio = Math.min(itemConceptsInDomain.length / queryConceptsInDomain, 1);
      // Additional bonus for having multiple concepts in the same domain
      const multiplicityBonus = itemConceptsInDomain.length > 1 ? 0.1 : 0;
      // Quality bonus for higher-weight concepts in this domain
      const qualityBonus = itemConceptsInDomain.reduce((sum, concept) => sum + concept.weight, 0) / itemConceptsInDomain.length * 0.05;
      concentrationBonus += domainRatio * 0.3 + multiplicityBonus + qualityBonus;
    }
    
    // Penalty for domain mixing - prefer items with fewer non-matching domains
    const nonMatchingDomains = itemDomains.size - intersection.size;
    const mixingPenalty = nonMatchingDomains * 0.3;
    
    return Math.min(Math.max(basicRelevance + concentrationBonus - mixingPenalty, 0), 1.2);
  }

  private calculateTypeRelevance(semanticQuery: SemanticQuery, workItem: any): number {
    const filters = semanticQuery.filters;
    if (!filters?.workItemTypes) return 0.5; // Neutral if no type preference

    return filters.workItemTypes.includes(workItem.type) ? 1.0 : 0.0;
  }

  private calculateRecencyScore(workItem: any): number {
    const now = new Date();
    const itemDate = new Date(workItem.lastUpdatedAt);
    const daysDiff = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // More recent = higher score, with decay over time
    if (daysDiff <= 30) return 1.0;
    if (daysDiff <= 90) return 0.8;
    if (daysDiff <= 180) return 0.6;
    if (daysDiff <= 365) return 0.4;
    return 0.2;
  }

  private calculateCompletionScore(workItem: any, intent: QueryIntent): number {
    const isCompleted = ['Closed', 'Resolved', 'Done', 'Completed'].includes(workItem.state);
    
    if (intent === QueryIntent.REFERENCE_PAST) {
      return isCompleted ? 1.0 : 0.2; // Strongly prefer completed work for reference
    }
    
    return 0.5; // Neutral for other intents
  }

  private generateMatchReasons(
    factorScores: SemanticMatch['factorScores'], 
    semanticQuery: SemanticQuery, 
    itemConcepts: Concept[]
  ): string[] {
    const reasons: string[] = [];

    if (factorScores.conceptOverlap > 0.6) {
      const sharedConcepts = semanticQuery.concepts
        .filter(qc => itemConcepts.some(ic => ic.term === qc.term))
        .map(c => c.term);
      reasons.push(`Strong concept match: ${sharedConcepts.join(', ')}`);
    }

    if (factorScores.domainRelevance > 0.7) {
      const domains = [...new Set(itemConcepts.map(c => c.domain))];
      reasons.push(`Same technical domain: ${domains.join(', ')}`);
    }

    if (factorScores.workItemType === 1.0) {
      reasons.push('Exact work item type match');
    }

    if (factorScores.recency > 0.8) {
      reasons.push('Recent work item');
    }

    if (factorScores.completionContext > 0.8) {
      reasons.push('Successfully completed work');
    }

    return reasons;
  }
}