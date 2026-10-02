// services/mythosData.ts
/**
 * Asynchronous Narrative Database
 * Standard fetch pattern avoids 'assert' or 'with' syntax errors in ESM browsers.
 */

export interface MythosDatabase {
  genres: any;
  structures: any;
  archetypes: any;
  themes: any;
}

// Internal state
let _genres: any = {};
let _structures: any = {};
let _archetypes: any = {};
let _themes: any = {};

/**
 * Single Source of Truth for all narrative and structural metadata.
 * These getters return the data once loaded.
 */
export const MythosData: MythosDatabase = {
  get genres() { return _genres; },
  get structures() { return _structures; },
  get archetypes() { return _archetypes; },
  get themes() { return _themes; }
};

// Also export individual variables for legacy compatibility if needed
export { _genres as genres, _structures as structures, _archetypes as archetypes, _themes as themes };

/**
 * Loads all required JSON metadata from the server.
 * This should be called before the main React application mounts.
 */
export async function loadMythosData() {
  try {
    const [g, s, a, t] = await Promise.all([
      fetch('/data/writer/genres.json').then(r => r.ok ? r.json() : {}),
      fetch('/data/writer/structures.json').then(r => r.ok ? r.json() : {}),
      fetch('/data/writer/archetypes.json').then(r => r.ok ? r.json() : {}),
      fetch('/data/writer/novel_themes.json').then(r => r.ok ? r.json() : {})
    ]);
    
    _genres = g;
    _structures = s;
    _archetypes = a;
    _themes = t;
    
    console.log("[MythOS] Narrative Metadata Synchronized.");
  } catch (error) {
    console.error("[MythOS] Failed to load narrative metadata:", error);
    // Continue with empty objects to prevent total crash
  }
}