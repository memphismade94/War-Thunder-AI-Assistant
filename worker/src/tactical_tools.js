// Gemini Interactions API tool declarations for Warthog.
// The Worker executes these locally against the official-first knowledge snapshot.
export const WARTHOG_TOOLS = [
  {
    type: 'function',
    name: 'search_official_knowledge',
    description: 'Search the Warthog knowledge base containing crawled official War Thunder Wiki/game documentation. Use this to verify exact game facts instead of relying on model memory.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Specific War Thunder fact or relationship to find. Include the vehicle, shell, armor area, range, mechanic, or map feature that needs verification.' },
        limit: { type: 'integer', description: 'Maximum results to return, from 1 to 8.' }
      },
      required: ['query']
    }
  },
  {
    type: 'function',
    name: 'lookup_vehicle',
    description: 'Look up official knowledge relevant to a named War Thunder ground vehicle. Use this to verify the player or enemy vehicle before making exact armor, weapon, mobility, reload, or survivability claims.',
    parameters: {
      type: 'object',
      properties: { vehicle: { type: 'string', description: 'Exact vehicle name when known.' } },
      required: ['vehicle']
    }
  },
  {
    type: 'function',
    name: 'lookup_ammunition',
    description: 'Look up official ammunition information for a named vehicle or shell, including penetration data where available. Use this before recommending a specific round or claiming a shot is reliable at a given range or angle.',
    parameters: {
      type: 'object',
      properties: {
        vehicle: { type: 'string', description: 'Vehicle name, if known.' },
        shell: { type: 'string', description: 'Exact shell/ammunition name, if known.' }
      },
      required: []
    }
  },
  {
    type: 'function',
    name: 'lookup_matchup',
    description: 'Evaluate a specific player-versus-enemy ground engagement using official knowledge. For aim/penetration questions, use this before answering and rank recommendations by practical outcome: first the most reliable disabling or kill shot supported by evidence, then one fallback, then say when the shot is too uncertain and disengagement/repositioning is better. Do not present several theoretical weak spots as equally good. Do not invent an exact weak spot if retrieved evidence does not support it.',
    parameters: {
      type: 'object',
      properties: {
        player_vehicle: { type: 'string', description: 'Player vehicle.' },
        enemy_vehicle: { type: 'string', description: 'Enemy vehicle.' },
        ammunition: { type: 'string', description: 'Player ammunition or shell if known.' },
        distance_m: { type: 'number', description: 'Approximate engagement distance in meters when known.' },
        aspect: { type: 'string', description: 'Target aspect/angle such as frontal, side, rear, hull-down, angled, or unknown.' }
      },
      required: ['player_vehicle', 'enemy_vehicle']
    }
  },
  {
    type: 'function',
    name: 'lookup_map',
    description: 'Search official knowledge for a named War Thunder ground map and a tactical question. Favor positions with cover, an exit route, useful sightlines, and objective value; do not recommend a position solely because it can see the enemy.',
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
    description: 'Return the match context supplied by the player. Treat missing fields as unknown; never infer hidden game state.',
    parameters: {
      type: 'object',
      properties: { fields: { type: 'array', items: { type: 'string' } } },
      required: []
    }
  }
];
