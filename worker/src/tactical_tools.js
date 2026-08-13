// Gemini Interactions API tool declarations for Warthog.
// The Worker executes these locally against the official-first knowledge snapshot.
export const WARTHOG_TOOLS = [
  {
    type: 'function',
    name: 'search_official_knowledge',
    description: 'Search the Warthog knowledge base containing crawled official War Thunder Wiki/game documentation.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Specific War Thunder fact or relationship to find.' },
        limit: { type: 'integer', description: 'Maximum results to return, from 1 to 8.' }
      },
      required: ['query']
    }
  },
  {
    type: 'function',
    name: 'lookup_vehicle',
    description: 'Look up official knowledge relevant to a named War Thunder ground vehicle.',
    parameters: {
      type: 'object',
      properties: { vehicle: { type: 'string', description: 'Vehicle name.' } },
      required: ['vehicle']
    }
  },
  {
    type: 'function',
    name: 'lookup_ammunition',
    description: 'Look up official ammunition information for a named vehicle or shell, including penetration data where available.',
    parameters: {
      type: 'object',
      properties: {
        vehicle: { type: 'string', description: 'Vehicle name, if known.' },
        shell: { type: 'string', description: 'Shell/ammunition name, if known.' }
      },
      required: []
    }
  },
  {
    type: 'function',
    name: 'lookup_matchup',
    description: 'Search official knowledge for a player-versus-enemy vehicle engagement.',
    parameters: {
      type: 'object',
      properties: {
        player_vehicle: { type: 'string' },
        enemy_vehicle: { type: 'string' },
        ammunition: { type: 'string' },
        distance_m: { type: 'number' },
        aspect: { type: 'string' }
      },
      required: ['player_vehicle', 'enemy_vehicle']
    }
  },
  {
    type: 'function',
    name: 'lookup_map',
    description: 'Search official knowledge for a named War Thunder ground map and a tactical question.',
    parameters: {
      type: 'object',
      properties: {
        map: { type: 'string' },
        question: { type: 'string' }
      },
      required: ['map']
    }
  },
  {
    type: 'function',
    name: 'get_match_state',
    description: 'Return the match context supplied by the player.',
    parameters: {
      type: 'object',
      properties: { fields: { type: 'array', items: { type: 'string' } } },
      required: []
    }
  }
];
