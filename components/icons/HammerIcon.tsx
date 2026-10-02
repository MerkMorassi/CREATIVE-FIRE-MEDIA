
import React from 'react';

export const HammerIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
        <path d="m15 12-8.373 8.373a1 1 0 1 1-1.414-1.414L12.172 12" />
        <path d="M18 15 6 3" />
        <path d="m21 18-3-3" />
        <path d="M9.5 14.5 3 21" />
    </svg>
);
