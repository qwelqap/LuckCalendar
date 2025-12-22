
import React from 'react';
import { Entry } from '../types';

interface HeatmapProps {
  entries: Entry[];
}

export const Heatmap: React.FC<HeatmapProps> = ({ entries }) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  const paddingDays = Array.from({ length: firstDay }, (_, i) => ({ type: 'pad' as const, key: `pad-${i}` }));
  const actualDays = Array.from({ length: daysInMonth }, (_, i) => ({ type: 'day' as const, day: i + 1, key: `day-${i+1}` }));

  const getDayScore = (day: number) => {
    const targetDateStr = new Date(year, month, day).toDateString();
    const dayEntries = entries.filter(e => new Date(e.date).toDateString() === targetDateStr);
    return dayEntries.length === 0 ? null : dayEntries.reduce((acc, cur) => acc + cur.actualValue, 0);
  };

  const getDayColor = (score: number | null) => {
    if (score === null) return 'bg-slate-100/50';
    if (score >= 5) return 'bg-emerald-500 shadow-emerald-500/20';
    if (score >= 1) return 'bg-emerald-300';
    if (score === 0) return 'bg-slate-300';
    if (score <= -5) return 'bg-rose-500 shadow-rose-500/20';
    if (score <= -1) return 'bg-rose-300';
    return 'bg-slate-100';
  };

  return (
    <div className="w-full max-w-[300px]">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((h, i) => (
          <div key={i} className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{h}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 w-full">
        {[...paddingDays, ...actualDays].map((cell, idx) => {
          if (cell.type === 'pad') return <div key={`empty-${idx}`} className="aspect-square"></div>;
          const score = getDayScore(cell.day);
          return (
            <div 
              key={cell.key} 
              className={`aspect-square rounded-[6px] transition-all flex items-center justify-center text-[10px] ${getDayColor(score)} ${score !== null ? 'shadow-sm text-white font-bold cursor-pointer hover:scale-110 active:scale-95' : 'text-slate-300'}`}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
};
