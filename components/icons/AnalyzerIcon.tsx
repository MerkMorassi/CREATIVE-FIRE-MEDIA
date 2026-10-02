
import React from 'react';

export const AnalyzerIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
        <path d="m13.2 8.8-1.2-1.2" />
        <path d="m10.8 11.2 1.2 1.2" />
        <path d="m8.8 13.2-1.2-1.2" />
        <path d="m11.2 10.8 1.2 1.2" />
        <circle cx="12" cy="12" r="10" />
        <path d="m18 12-1.8-1.8" />
        <path d="m6 12 1.8 1.8" />
    </svg>
);
