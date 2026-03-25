import React from 'react';
import duck from '../assets/duck.png';

interface UpcomingFeatureProps {
  title: string;
}

export default function UpcomingFeature({ title }: UpcomingFeatureProps) {
  return (
    // We use overflow-hidden and a fixed height to make the effect fill the exact space
    <div className="relative flex min-h-[calc(100vh-4rem)] w-full items-center justify-center overflow-hidden bg-slate-50">
      
      {/* --- FULL SCREEN AMBIENT MESH EFFECT --- */}
      {/* These massive, blurred circles use Tailwind's arbitrary values (e.g., blur-[120px]) to create a seamless, fluid background */}
      <div 
        className="absolute -top-[10%] -left-[10%] h-[60%] w-[60%] animate-pulse rounded-full bg-indigo-200/50 blur-[120px]" 
        style={{ animationDuration: '4s' }}
      />
      <div 
        className="absolute -bottom-[10%] -right-[5%] h-[60%] w-[50%] animate-pulse rounded-full bg-blue-200/50 blur-[120px]" 
        style={{ animationDuration: '7s' }}
      />
      <div 
        className="absolute top-[20%] left-[20%] h-[40%] w-[40%] animate-pulse rounded-full bg-emerald-100/50 blur-[120px]" 
        style={{ animationDuration: '5s' }}
      />

      {/* --- CONTENT (Frosted Glass Card) --- */}
      {/* backdrop-blur-md and bg-white/40 give it that translucent Apple-like glass effect */}
      <div className="relative z-10 flex max-w-lg flex-col items-center rounded-3xl border border-white/60 bg-white/40 p-10 text-center shadow-xl backdrop-blur-md sm:p-16">
        
        <img 
          src={duck} 
          alt="Coming soon" 
          className="mb-8 h-auto w-36 drop-shadow-md"
        />

        <span className="mb-4 inline-block rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-600 shadow-sm backdrop-blur-sm">
          Coming Soon
        </span>
        
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
          {title}
        </h1>

        <p className="mt-3 text-sm font-medium text-slate-500">
          This module is currently being wired up. Visit again!
        </p>

        <button 
          onClick={() => window.history.back()}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          ← Go Back
        </button>
      </div>
      
    </div>
  );
}