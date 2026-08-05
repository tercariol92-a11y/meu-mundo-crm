import React from 'react';

interface MascotProps {
  className?: string;
  size?: number | string;
}

export default function Mascot({ className = "", size = 100 }: MascotProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm"
      >
        <defs>
          <linearGradient id="mascot-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2F5BFF" />
            <stop offset="100%" stopColor="#0B1F3A" />
          </linearGradient>
          <clipPath id="sphere-clip">
            <circle cx="50" cy="50" r="48" />
          </clipPath>
        </defs>

        {/* Base Sphere */}
        <circle cx="50" cy="50" r="48" fill="#0B1F3A" />
        
        <g clipPath="url(#sphere-clip)">
          {/* Subtle Atmosphere Glow */}
          <circle cx="20" cy="20" r="60" fill="white" fillOpacity="0.05" />
          
          {/* Management Rings / Data Paths */}
          <ellipse 
            cx="50" cy="50" rx="42" ry="12" 
            stroke="#2F5BFF" strokeWidth="1.5" strokeOpacity="0.6" 
            transform="rotate(-25 50 50)" 
          />
          <ellipse 
            cx="50" cy="50" rx="42" ry="12" 
            stroke="#2F5BFF" strokeWidth="1.5" strokeOpacity="0.4" 
            transform="rotate(45 50 50)" 
          />
          
          {/* Central Control Core */}
          <path
            d="M35 50 C35 30 65 30 65 50 C65 70 35 70 35 50Z"
            fill="#2F5BFF"
            className="animate-pulse"
            style={{ animationDuration: '3s' }}
          />
          
          {/* Connecting Nodes (Control Points) */}
          <circle cx="50" cy="50" r="4" fill="white" />
          <circle cx="85" cy="35" r="2.5" fill="#2F5BFF" />
          <circle cx="15" cy="65" r="2.5" fill="#2F5BFF" />
          <circle cx="65" cy="82" r="2" fill="#2F5BFF" stroke="white" strokeWidth="0.5" />
          
          {/* Digital Grid Pulse */}
          <path 
            d="M10 50 H90" 
            stroke="white" 
            strokeWidth="0.2" 
            strokeOpacity="0.1" 
          />
          <path 
            d="M50 10 V90" 
            stroke="white" 
            strokeWidth="0.2" 
            strokeOpacity="0.1" 
          />
        </g>
        
        {/* Outer Tech Ring */}
        <circle 
          cx="50" cy="50" r="49" 
          stroke="#2F5BFF" 
          strokeWidth="0.5" 
          strokeDasharray="4 8" 
          strokeOpacity="0.5" 
        />
      </svg>
    </div>
  );
}
