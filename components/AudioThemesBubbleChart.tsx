import React, { useState, useMemo } from 'react';
import { AudioPlotTheme, AudioSentimentAnalysis } from '../types';

interface AudioThemesBubbleChartProps {
    analysis: AudioSentimentAnalysis | null;
    isLoading: boolean;
    onReanalyze: () => void;
    transcriptsCount: number;
    onNavigateToLore?: () => void;
}

export const AudioThemesBubbleChart: React.FC<AudioThemesBubbleChartProps> = ({
    analysis,
    isLoading,
    onReanalyze,
    transcriptsCount,
    onNavigateToLore
}) => {
    const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
    const [sentimentFilter, setSentimentFilter] = useState<string>('all');
    const [hoveredThemeId, setHoveredThemeId] = useState<string | null>(null);

    const themes = useMemo(() => {
        if (!analysis?.plotThemes) return [];
        if (sentimentFilter === 'all') return analysis.plotThemes;
        return analysis.plotThemes.filter(t => t.sentiment === sentimentFilter);
    }, [analysis, sentimentFilter]);

    // Compute packed circular coordinates for bubbles in SVG viewBox 720 x 420
    const positionedBubbles = useMemo(() => {
        if (!themes.length) return [];

        const width = 720;
        const height = 400;
        const centerX = width / 2;
        const centerY = height / 2;

        // Base radii
        const bubbles = themes.map((theme, i) => {
            const rawRadius = Math.max(26, Math.min(58, (theme.frequency || 30) * 0.95));
            return {
                ...theme,
                radius: rawRadius,
                x: centerX,
                y: centerY,
                vx: 0,
                vy: 0
            };
        });

        // Fixed pleasant constellation layout angles based on count
        const count = bubbles.length;
        const primaryRadius = Math.min(width, height) * 0.32;

        bubbles.forEach((b, idx) => {
            if (idx === 0) {
                // Largest central theme
                b.x = centerX;
                b.y = centerY - 15;
            } else {
                const angle = ((idx - 1) / Math.max(1, count - 1)) * 2 * Math.PI - Math.PI / 2;
                const distance = primaryRadius + (idx % 2 === 0 ? 30 : -25);
                b.x = centerX + Math.cos(angle) * distance;
                b.y = centerY + Math.sin(angle) * (distance * 0.75);
            }
        });

        // Simple relaxation pass to prevent overlaps
        for (let iter = 0; iter < 45; iter++) {
            for (let i = 0; i < bubbles.length; i++) {
                for (let j = i + 1; j < bubbles.length; j++) {
                    const dx = bubbles[j].x - bubbles[i].x;
                    const dy = bubbles[j].y - bubbles[i].y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const minDist = bubbles[i].radius + bubbles[j].radius + 14;

                    if (dist < minDist) {
                        const overlap = (minDist - dist) / dist * 0.5;
                        const adjustX = dx * overlap;
                        const adjustY = dy * overlap;

                        bubbles[i].x -= adjustX;
                        bubbles[i].y -= adjustY;
                        bubbles[j].x += adjustX;
                        bubbles[j].y += adjustY;
                    }
                }

                // Keep inside bounds
                bubbles[i].x = Math.max(bubbles[i].radius + 20, Math.min(width - bubbles[i].radius - 20, bubbles[i].x));
                bubbles[i].y = Math.max(bubbles[i].radius + 20, Math.min(height - bubbles[i].radius - 20, bubbles[i].y));
            }
        }

        return bubbles;
    }, [themes]);

    const activeTheme = useMemo(() => {
        if (!analysis?.plotThemes) return null;
        if (selectedThemeId) {
            return analysis.plotThemes.find(t => t.id === selectedThemeId) || null;
        }
        return analysis.plotThemes[0] || null;
    }, [analysis, selectedThemeId]);

    // Sentiment visual styling maps
    const getSentimentBadge = (sentiment: string) => {
        switch (sentiment) {
            case 'tense':
            case 'negative':
                return {
                    label: 'Tense / Dramatic',
                    bg: 'bg-rose-950/80 text-rose-400 border-rose-800/60',
                    pill: 'bg-rose-500'
                };
            case 'mysterious':
                return {
                    label: 'Mystery / Occult',
                    bg: 'bg-purple-950/80 text-purple-400 border-purple-800/60',
                    pill: 'bg-purple-500'
                };
            case 'positive':
                return {
                    label: 'Hopeful / Alliance',
                    bg: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
                    pill: 'bg-emerald-500'
                };
            default:
                return {
                    label: 'Strategic / Neutral',
                    bg: 'bg-sky-950/80 text-sky-400 border-sky-800/60',
                    pill: 'bg-sky-500'
                };
        }
    };

    const getGradientColors = (sentiment: string) => {
        switch (sentiment) {
            case 'tense':
            case 'negative':
                return { start: '#e11d48', stop: '#4c0519', stroke: '#fb7185' }; // Rose / Crimson
            case 'mysterious':
                return { start: '#a855f7', stop: '#3b0764', stroke: '#c084fc' }; // Purple / Violet
            case 'positive':
                return { start: '#10b981', stop: '#064e3b', stroke: '#34d399' }; // Emerald / Teal
            default:
                return { start: '#0284c7', stop: '#082f49', stroke: '#38bdf8' }; // Sky / Blue
        }
    };

    return (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6">
            {/* Header with Title, Stats & Re-analyze Button */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-neutral-800">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                            <span className="text-lg">🫧</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                Audio Transcripts Plot Themes & Sentiment
                            </h3>
                            <p className="text-[11px] text-neutral-400 font-medium">
                                Visualizing emerging narrative themes, recurring keywords, and emotional volatility across recorded dialogue
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                    <span className="text-[10px] font-mono font-bold text-neutral-400 bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded-lg">
                        🎙️ {transcriptsCount} Audio Recordings
                    </span>
                    <button
                        onClick={onReanalyze}
                        disabled={isLoading}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                    >
                        {isLoading ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Analyzing Audio...</span>
                            </>
                        ) : (
                            <>
                                <span>⚡ Re-Analyze</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Sentiment Volatility Meter */}
            {analysis?.overallSentiment && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-neutral-950/50 p-4 rounded-xl border border-neutral-850">
                    <div className="lg:col-span-4 flex flex-col justify-center space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider">Dominant Sentiment Tone</span>
                        <div className="flex items-center gap-2">
                            <span className="text-base font-black text-white">{analysis.overallSentiment.dominant}</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-purple-950/60 border border-purple-800 text-purple-300">
                                Real-time
                            </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 line-clamp-1">
                            {analysis.summary || "Synthesized from vocal cadence, dialogue markers, and narrative context."}
                        </p>
                    </div>

                    <div className="lg:col-span-8 flex flex-col justify-center space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                            <span className="text-rose-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                                Tense / Conflict ({analysis.overallSentiment.tenseOrNegative}%)
                            </span>
                            <span className="text-purple-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                                Mystery ({analysis.overallSentiment.mysterious}%)
                            </span>
                            <span className="text-emerald-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                Hopeful ({analysis.overallSentiment.positive}%)
                            </span>
                            <span className="text-sky-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                                Neutral ({analysis.overallSentiment.neutral}%)
                            </span>
                        </div>

                        {/* Multi-segment stacked sentiment bar */}
                        <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden flex shadow-inner">
                            <div
                                style={{ width: `${analysis.overallSentiment.tenseOrNegative}%` }}
                                className="h-full bg-gradient-to-r from-rose-600 to-red-600 transition-all duration-700"
                                title={`Tense/Conflict: ${analysis.overallSentiment.tenseOrNegative}%`}
                            />
                            <div
                                style={{ width: `${analysis.overallSentiment.mysterious}%` }}
                                className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-700"
                                title={`Mystery: ${analysis.overallSentiment.mysterious}%`}
                            />
                            <div
                                style={{ width: `${analysis.overallSentiment.positive}%` }}
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                                title={`Hopeful: ${analysis.overallSentiment.positive}%`}
                            />
                            <div
                                style={{ width: `${analysis.overallSentiment.neutral}%` }}
                                className="h-full bg-gradient-to-r from-sky-600 to-blue-600 transition-all duration-700"
                                title={`Neutral: ${analysis.overallSentiment.neutral}%`}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Bubble Chart Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-neutral-500 px-2 py-1 select-none">Filter By Tone:</span>
                    {(['all', 'tense', 'mysterious', 'positive', 'neutral'] as const).map(tone => (
                        <button
                            key={tone}
                            onClick={() => setSentimentFilter(tone)}
                            className={`px-3 py-1 rounded-lg transition-all ${
                                sentimentFilter === tone
                                    ? 'bg-purple-600 text-white shadow-sm font-black'
                                    : 'text-neutral-400 hover:text-neutral-200'
                            }`}
                        >
                            {tone === 'all' ? 'All Themes' : tone}
                        </button>
                    ))}
                </div>

                <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-2">
                    <span className="text-neutral-500">Bubble Size:</span>
                    <span className="font-bold text-white">Mention Weight & Resonance</span>
                </div>
            </div>

            {/* Main Interactive Bubble Chart Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 relative overflow-hidden shadow-inner flex flex-col justify-center min-h-[380px]">
                    {isLoading ? (
                        <div className="py-24 flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-mono text-purple-300 uppercase tracking-widest animate-pulse">
                                Extracting Acoustic Sentiment & Themes via Gemini...
                            </p>
                        </div>
                    ) : positionedBubbles.length > 0 ? (
                        <svg
                            viewBox="0 0 720 400"
                            className="w-full h-auto max-h-[420px] select-none cursor-pointer"
                        >
                            <defs>
                                {positionedBubbles.map(b => {
                                    const colors = getGradientColors(b.sentiment);
                                    return (
                                        <radialGradient
                                            key={`grad-${b.id}`}
                                            id={`grad-${b.id}`}
                                            cx="35%"
                                            cy="35%"
                                            r="65%"
                                        >
                                            <stop offset="0%" stopColor={colors.start} stopOpacity="0.9" />
                                            <stop offset="100%" stopColor={colors.stop} stopOpacity="0.95" />
                                        </radialGradient>
                                    );
                                })}
                                <filter id="bubble-glow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="6" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>

                            {/* Connecting thematic constellation lines */}
                            {positionedBubbles.slice(1).map((b, i) => (
                                <line
                                    key={`link-${b.id}`}
                                    x1={positionedBubbles[0].x}
                                    y1={positionedBubbles[0].y}
                                    x2={b.x}
                                    y2={b.y}
                                    stroke="#3f3f46"
                                    strokeWidth="1"
                                    strokeDasharray="3 4"
                                    strokeOpacity="0.4"
                                />
                            ))}

                            {/* The Bubble Nodes */}
                            {positionedBubbles.map(b => {
                                const isSelected = selectedThemeId === b.id || (!selectedThemeId && b === positionedBubbles[0]);
                                const isHovered = hoveredThemeId === b.id;
                                const colors = getGradientColors(b.sentiment);

                                return (
                                    <g
                                        key={b.id}
                                        transform={`translate(${b.x}, ${b.y})`}
                                        onClick={() => setSelectedThemeId(b.id)}
                                        onMouseEnter={() => setHoveredThemeId(b.id)}
                                        onMouseLeave={() => setHoveredThemeId(null)}
                                        className="transition-transform duration-300"
                                        style={{ transformOrigin: `${b.x}px ${b.y}px` }}
                                    >
                                        {/* Outer selection ring */}
                                        {isSelected && (
                                            <circle
                                                r={b.radius + 7}
                                                fill="none"
                                                stroke={colors.stroke}
                                                strokeWidth="2.5"
                                                strokeDasharray="4 3"
                                                className="animate-spin"
                                                style={{ animationDuration: '12s' }}
                                            />
                                        )}

                                        {/* Main filled bubble */}
                                        <circle
                                            r={b.radius}
                                            fill={`url(#grad-${b.id})`}
                                            stroke={isSelected ? '#ffffff' : colors.stroke}
                                            strokeWidth={isSelected ? '2.5' : isHovered ? '2' : '1'}
                                            filter={isSelected || isHovered ? 'url(#bubble-glow)' : undefined}
                                            className="transition-all duration-300 hover:scale-105 cursor-pointer"
                                        />

                                        {/* Bubble Label Text */}
                                        <text
                                            textAnchor="middle"
                                            dy="-4"
                                            fill="#ffffff"
                                            fontSize={b.radius > 45 ? "11" : b.radius > 35 ? "9.5" : "8"}
                                            fontWeight="900"
                                            className="uppercase tracking-tight pointer-events-none drop-shadow"
                                        >
                                            {b.name.length > (b.radius > 45 ? 18 : 14)
                                                ? b.name.substring(0, b.radius > 45 ? 16 : 12) + '...'
                                                : b.name}
                                        </text>

                                        {/* Frequency and Sentiment pill inside bubble */}
                                        <text
                                            textAnchor="middle"
                                            dy="12"
                                            fill="#cbd5e1"
                                            fontSize="8"
                                            fontFamily="monospace"
                                            fontWeight="bold"
                                            className="pointer-events-none opacity-90"
                                        >
                                            {b.occurrences || Math.round(b.frequency / 8)}x mentions
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    ) : (
                        <div className="py-20 text-center space-y-3">
                            <span className="text-4xl opacity-30">🫧</span>
                            <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                                No emerging plot themes detected for this filter.
                            </p>
                            <button
                                onClick={() => setSentimentFilter('all')}
                                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg"
                            >
                                Reset Tone Filter
                            </button>
                        </div>
                    )}

                    {/* Chart Legend Footer */}
                    <div className="flex flex-wrap items-center justify-between text-[9px] font-mono text-neutral-500 pt-3 border-t border-neutral-850">
                        <span>Click bubble to inspect theme narrative snippet & related characters</span>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-rose-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Tense
                            </span>
                            <span className="flex items-center gap-1 text-purple-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Mystery
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Hopeful
                            </span>
                        </div>
                    </div>
                </div>

                {/* Selected Theme Deep-Dive Card */}
                <div className="lg:col-span-4 bg-neutral-950/90 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="flex justify-between items-start pb-2 border-b border-neutral-800">
                        <div>
                            <span className="text-[9px] font-black uppercase text-purple-400 tracking-widest block">
                                Plot Theme Inspector
                            </span>
                            <h4 className="text-base font-black text-white leading-tight mt-0.5">
                                {activeTheme ? activeTheme.name : "Select a Theme Bubble"}
                            </h4>
                        </div>
                        {activeTheme && (
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${getSentimentBadge(activeTheme.sentiment).bg}`}>
                                {activeTheme.sentiment}
                            </span>
                        )}
                    </div>

                    {activeTheme ? (
                        <div className="space-y-4 text-xs">
                            {/* Category & Valence Score */}
                            <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-xl border border-neutral-850">
                                <div>
                                    <span className="text-[8px] font-black uppercase text-neutral-500 tracking-wider block">Category</span>
                                    <span className="text-xs font-bold text-neutral-200">{activeTheme.category}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[8px] font-black uppercase text-neutral-500 tracking-wider block">Sentiment Valence</span>
                                    <span className={`text-xs font-mono font-bold ${
                                        activeTheme.sentimentScore < -0.3 ? 'text-rose-400' :
                                        activeTheme.sentimentScore > 0.3 ? 'text-emerald-400' : 'text-sky-400'
                                    }`}>
                                        {activeTheme.sentimentScore > 0 ? `+${activeTheme.sentimentScore}` : activeTheme.sentimentScore}
                                    </span>
                                </div>
                            </div>

                            {/* Dialogue / Audio Context Snippet */}
                            <div className="space-y-1.5">
                                <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider flex items-center gap-1.5">
                                    <span>🎙️</span> Transcript Excerpt
                                </span>
                                <div className="p-3 bg-neutral-900/80 rounded-xl border border-neutral-800 italic text-neutral-300 leading-relaxed font-serif text-[11px]">
                                    "{activeTheme.contextSnippet}"
                                </div>
                            </div>

                            {/* Related Characters */}
                            {activeTheme.relatedCharacters && activeTheme.relatedCharacters.length > 0 && (
                                <div className="space-y-1.5">
                                    <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block">
                                        Associated Characters & Speakers
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {activeTheme.relatedCharacters.map((char, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-0.5 bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-md font-mono text-[10px]"
                                            >
                                                👤 {char}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action to Jump to Lore */}
                            {onNavigateToLore && (
                                <div className="pt-2">
                                    <button
                                        onClick={onNavigateToLore}
                                        className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 hover:border-purple-500/50 border border-neutral-800 text-purple-300 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <span>📖 Search Lore Engine for this Theme</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-neutral-500 py-6 text-center">
                            Select any bubble in the graph to view narrative context and character links.
                        </p>
                    )}
                </div>
            </div>

            {/* Recurring Keywords Cloud & Emotional Shift Arc */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Recurring Keywords */}
                <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-850 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                            <span>🔑</span> Common Recurring Dialogue Keywords
                        </span>
                        <span className="text-[9px] font-mono text-neutral-500">Frequency Ranked</span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                        {analysis?.recurringKeywords && analysis.recurringKeywords.length > 0 ? (
                            analysis.recurringKeywords.map((kw, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900 border border-neutral-800 hover:border-purple-500/40 rounded-lg text-xs transition-all"
                                >
                                    <span className="font-bold text-white">{kw.word}</span>
                                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60">
                                        {kw.count}x
                                    </span>
                                </div>
                            ))
                        ) : (
                            <span className="text-xs text-neutral-500 italic">No recurring keywords compiled yet.</span>
                        )}
                    </div>
                </div>

                {/* Emotional Shift Arc */}
                <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-850 space-y-3">
                    <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                        <span>📈</span> Emotional Trajectory & Dramatic Shift
                    </span>

                    <div className="space-y-2 pt-1">
                        {analysis?.sentimentArc && analysis.sentimentArc.length > 0 ? (
                            analysis.sentimentArc.map((arc, i) => (
                                <div key={i} className="flex items-start gap-2.5 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-purple-950 border border-purple-800 text-purple-300 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
                                        {i + 1}
                                    </span>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white">{arc.segment}</span>
                                            <span className="text-[9px] font-mono text-purple-400">({arc.tone})</span>
                                        </div>
                                        <p className="text-[10px] text-neutral-400 leading-snug">{arc.shiftNote}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <span className="text-xs text-neutral-500 italic">No narrative arcs recorded yet.</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
