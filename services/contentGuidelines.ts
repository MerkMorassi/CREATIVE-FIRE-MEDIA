
/**
 * CONTENT_GUIDELINES
 * Repository of technical prompts enforcing MPA (Motion Picture Association) standards
 * and industry-standard medium formats.
 */
export const CONTENT_GUIDELINES = {
  RATINGS: {
    "G": {
      name: "G (General Audiences)",
      positive: "Violence: Slapstick, comedic violence, cartoon physics, harmless pratfalls, minimal peril, conflict resolved without injury. Sexual Content: Platonic affection, holding hands, hugging, brief chaste kissing, wholesome relationships. Language: Polite conversation, very mild epithets (darn, heck), pure speech. Substance Use: Sobriety, clean atmosphere. Themes: Wholesome, educational, moral lessons, innocence, optimism, cheerfulness.",
      negative: "Violence: Realistic violence, blood, visible wounds, suffering, weapons used to harm, scary imagery, death scenes. Sexual Content: Sexual innuendo, sexual references, nudity, partial nudity, crude humor, romantic complexity beyond innocence. Language: Profanity, cursing, swearing, blasphemy, insults, slang. Substance Use: Alcohol, tobacco, drugs, intoxication, bars/taverns. Themes: Nihilism, existential dread, trauma, controversy, cynicism, horror."
    },
    "PG": {
      name: "PG (Parental Guidance Suggested)",
      positive: "Violence: Moderate fantasy violence, sci-fi action, comedic combat, intense moments without graphic detail, off-screen injury, emotionally low-impact death. Sexual Content: Mild innuendo, flirtation, brief non-sexual nudity, romantic tension. Language: Infrequent mild profanity (hell, damn, bastard), rare use of moderate terms (shit, bitch). Substance Use: Incidental alcohol/tobacco use by adults. Themes: Emotional complexity, bullying, loss, mild suspense, coming-of-age.",
      negative: "Violence: Realistic gore, blood spatter, torture, persistent brutality, sexual violence. Sexual Content: Sexual intercourse, graphic sexual acts, sexualized nudity, heavy petting, prolonged sexual noises. Language: F-word (even once), sexual slurs, frequent profanity. Substance Use: Illegal drug use, teen substance abuse, glamorized addiction. Themes: Graphic horror, disturbing psychological abuse, hopeless tragedy."
    },
    "PG-13": {
      name: "PG-13 (Parents Strongly Cautioned)",
      positive: "Violence: Intense sequences of action/violence, gunplay, martial arts, explosions, implied suicide, brief blood. Sexual Content: Sexual references, crude humor, implied sexual activity (morning after), brief partial nudity. Language: Moderate profanity (shit, bitch, ass), single use of the F-word (non-sexual context). Substance Use: Implied drug use, irresponsible teen drinking/smoking (if consequences shown). Themes: Darker narratives, domestic issues, war, alienation, romance, psychological thriller elements.",
      negative: "Violence: Realistic mutilation, dismemberment, pervasive gore, sadistic violence, sexual assault, rape. Sexual Content: Graphic sex, full frontal nudity, explicit fetishism. Language: Frequent F-words, pervasive offensive language. Substance Use: Explicit hard drug injection/use. Themes: Extreme nihilism, hopelessness without redemption."
    },
    "R": {
      name: "R (Restricted)",
      positive: "Violence: Realistic combat, bloody consequences, intense psychological horror, war realism. Sexual Content: Sexual situations, nudity (non-pornographic), complex adult relationships. Language: Realistic dialogue including strong profanity. Substance Use: Realistic depiction of drug/alcohol use and consequences. Themes: Mature subjects, complex morality, crime, trauma, existentialism, political corruption.",
      negative: "Violence: Gratuitous torture porn, sexual violence as entertainment. Sexual Content: Hardcore pornography, genitals in arousal. Themes: Hate speech, promotion of illegal acts without narrative context."
    },
    "NC-17": {
      name: "NC-17 (Adults Only)",
      positive: "Violence: Unflinching realism, extreme horror. Sexual Content: Explicit sexual scenes, full nudity, exploring taboos. Language: Unrestricted. Themes: Highly controversial, disturbing, or experimental content intended for adult artistic consumption.",
      negative: "Illegal content, non-consensual sexual violence presented as positive."
    }
  },
  FORMATS: {
    "Feature_Film": "Structure: Three-Act Structure (110-120 pages). Pacing: Steady build-up, major mid-point, climactic finale. Focus: Complete character arc within a single story.",
    "Netflix_Limited": "Structure: 6-8 Episodes. Pacing: Binge-worthy hooks at end of every sequence. Focus: Deep character dive, multiple POVs, slow-burn mystery.",
    "AppleTV_Prestige": "Structure: 10 Episodes. Pacing: Slow, atmospheric, character-driven. Focus: High production value, philosophical themes, visual storytelling.",
    "Network_Procedural": "Structure: 42 minutes (4-Act). Pacing: Fast, plot-driven, repetitive beats. Focus: Problem/Solution within one unit, consistent character voices.",
    "Indie_Experimental": "Structure: Non-linear or Vignettes. Pacing: Unpredictable, mood-based. Focus: Atmosphere, metaphor, subverting expectations.",
    "Short_Film": "Structure: One Act (10-15 pages). Pacing: Immediate incident, quick escalation, twist ending. Focus: Single strong idea or emotion."
  }
};
