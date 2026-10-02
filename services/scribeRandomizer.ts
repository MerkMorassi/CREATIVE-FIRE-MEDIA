import { MythosData } from './mythosData';

export interface ScribeConfig {
    title: string;
    theme: string;
    setting: string;
    tone: string;
    cast: string;
    beatSheet: string;
    genre: string;
    rating?: string;
    format?: string; 
    workingTitle: string;
    logline: string;
    treatment: string;
    fundamentalStoryQuestions: string;
    archetypalCharacters: string;
    sceneGenerationQuestions: string;
}

const GENRE_SETTING_MAP: Record<string, string[]> = {
    western: ["High Desert Saloon", "Abandoned Mine", "Steam Train at Sunset", "Dusty Sheriff's Office", "Canyon Ambush Point"],
    sci_fi: ["Orbital Space Station", "Neon-Drenched Cyber Slum", "Terraforming Colony", "AI Server Farm", "Derelict Starship"],
    horror: ["Haunted Victorian Manor", "Isolated Cabin in Woods", "Abandoned Asylum", "Foggy Graveyard", "Suburban Basement"],
    crime: ["Rainy Alleyway", "Police Interrogation Room", "Smoke-Filled Jazz Club", "Mob Front Pizzeria", "High-Rise Penthouse"],
    fantasy: ["Ancient Wizard's Spire", "Enchanted Forest Clearing", "Dragon's Lair", "Bustling Medieval Tavern", "Crystal Cave"],
    action: ["Skyscraper Rooftop", "High-Speed Highway", "Secret Military Base", "Exploding Warehouse", "Jungle Guerilla Camp"],
    comedy: ["Suburban Living Room", "Chaotic Office Space", "Road Trip Diner", "High School Cafeteria", "Wedding Reception"],
    drama: ["Quiet Coffee Shop", "Courtroom", "Hospital Waiting Room", "Family Dining Table", "City Park Bench"],
    experimental: ["A White Void", "A Dreamscape of Melting Clocks", "Infinite Hallway of Mirrors", "Static TV Screen", "The Subconscious Mind"]
};

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickKey = (obj: any) => {
    const keys = Object.keys(obj);
    if (keys.length === 0) return null;
    return keys[Math.floor(Math.random() * keys.length)];
};

export const generateRandomConfig = (constraints: Partial<ScribeConfig> = {}): ScribeConfig => {
    const { genres, themes, structures } = MythosData;

    const mainGenreKey = constraints.genre || pickKey(genres) || 'drama'; 
    const subGenreObject = genres[mainGenreKey]?.subgenres || {};
    const subGenreKey = pickKey(subGenreObject) || 'contemporary'; 
    const genreInfo = subGenreObject[subGenreKey] || { definition: "A human story." };

    const possibleSettings = GENRE_SETTING_MAP[mainGenreKey] || ["An Unnamed Location"];
    const selectedSetting = constraints.setting || pick(possibleSettings);

    const themeKey = constraints.theme || pickKey(themes.core_themes) || 'identity_crisis';
    const themeData = themes.core_themes[themeKey];
    const philosophies = themeData.philosophies?.core_questions || ["What makes us human?"];
    const coreQuestion = pick(philosophies);

    const structureKey = pickKey(structures) || 'comprehensive_feature_film';
    const structure = structures[structureKey];
    const openingBeat = structure.beats?.find((b: any) => 
        b.label.toLowerCase().includes("opening") || 
        b.label.toLowerCase().includes("ordinary")
    ) || structure.beats[0];

    const displayGenreName = subGenreKey.replace(/_/g, ' ').toUpperCase();
    const tone = `${mainGenreKey.toUpperCase()} // ${displayGenreName}`;
    const titleStub = constraints.title || `PROJ_${subGenreKey.toUpperCase()}_${Math.floor(Math.random() * 999)}`;

    const formats = ["Feature_Film", "Netflix_Limited", "AppleTV_Prestige", "Network_Procedural", "Indie_Experimental", "Short_Film"];
    const selectedFormat = constraints.format || pick(formats);

    const cast = constraints.cast || `
--- ROLE: PROTAGONIST ---
ARCHETYPE: The Hero 
NOTE: Must embody the traits of the ${displayGenreName} sub-genre.

--- ROLE: ANTAGONIST ---
ARCHETYPE: The Shadow
NOTE: Represents the psychological antithesis of: "${coreQuestion}"
    `.trim();

    const beatSheet = constraints.beatSheet || `
--- GENRE PROTOCOL: ${displayGenreName} ---
${genreInfo.definition}

--- THEMATIC ANCHOR ---
"${coreQuestion}"

--- SEQUENCE START: ${openingBeat.label.toUpperCase()} ---
ACTION: ${openingBeat.instruction}
ENVIRONMENT: ${selectedSetting}
    `.trim();

    return {
        title: titleStub,
        genre: mainGenreKey,
        theme: themeKey, 
        setting: selectedSetting,
        tone: tone,
        cast: cast, 
        beatSheet: beatSheet,
        rating: constraints.rating || "R",
        format: selectedFormat,
        workingTitle: titleStub,
        logline: themeData.logline || `A ${displayGenreName} exploration of ${themeKey.replace(/_/g, ' ')}.`,
        treatment: `The narrative sequence initiates in ${selectedSetting}. We observe our protagonist grappling with the physical manifestations of "${coreQuestion}" within a ${displayGenreName} context.`,
        fundamentalStoryQuestions: `1. ${coreQuestion}\n2. How does the environment of ${selectedSetting} test the protagonist's resolve?`,
        archetypalCharacters: `Protagonist: The Hero / Seeker\nAntagonist: The Shadow / System`,
        sceneGenerationQuestions: `1. What visual motif in ${selectedSetting} represents the theme?\n2. How does the lighting reflect the ${tone} tone?`
    };
};