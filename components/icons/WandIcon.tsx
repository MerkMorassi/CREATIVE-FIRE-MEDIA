import React from 'react';

export const WandIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
    >
        <path d="M15 4V2" />
        <path d="M15 10V8" />
        <path d="M12.5 7.5h-1" />
        <path d="M17.5 7.5h-1" />
        <path d="M3 21 12 12" />
        <path d="M9 21h.01" />
        <path d="M21 9h.01" />
        <path d="M21 3h.01" />
        <path d="M3 9h.01" />
        <path d="m21 15-6-6" />
    </svg>
);
