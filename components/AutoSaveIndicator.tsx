import React from 'react';

export type SaveStatus = 'saving' | 'saved' | 'idle' | 'error';

export interface AutoSaveIndicatorProps {
    status: SaveStatus;
    lastSavedTime?: Date | null;
    onRetry?: () => void;
    className?: string;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
    status,
    lastSavedTime,
    onRetry,
    className = ''
}) => {
    const formatTime = (date?: Date | null) => {
        if (!date) return '';
        const now = new Date();
        const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
        
        if (diffSec < 5) return 'just now';
        if (diffSec < 60) return `${diffSec}s ago`;
        
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div 
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium transition-all duration-300 select-none ${
                status === 'saving'
                    ? 'bg-blue-950/50 border-blue-500/40 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                    : status === 'saved'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                    : status === 'error'
                    ? 'bg-red-950/50 border-red-500/40 text-red-300'
                    : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-400'
            } ${className}`}
            title="Auto-saving status for local storage & synchronization service"
        >
            {status === 'saving' && (
                <>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="font-semibold tracking-wide animate-pulse">Auto-saving...</span>
                </>
            )}

            {(status === 'saved' || status === 'idle') && (
                <>
                    <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium text-emerald-300/90">
                        All changes saved
                    </span>
                    {lastSavedTime && (
                        <span className="text-[10px] text-neutral-500 font-mono pl-1 border-l border-neutral-700/60">
                            {formatTime(lastSavedTime)}
                        </span>
                    )}
                </>
            )}

            {status === 'error' && (
                <>
                    <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Save failed</span>
                    {onRetry && (
                        <button 
                            onClick={onRetry} 
                            className="ml-1 text-[10px] underline hover:text-white transition-colors"
                        >
                            Retry
                        </button>
                    )}
                </>
            )}
        </div>
    );
};
