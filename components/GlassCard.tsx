
import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  dataDate?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = "", 
  onClick, 
  style, 
  dataDate 
}) => (
  <div 
    onClick={onClick}
    style={style}
    data-date={dataDate}
    className={`relative overflow-hidden bg-white/80 backdrop-blur-2xl border border-white/60 shadow-sm rounded-[24px] transition-all duration-200 ${className}`}
  >
    {children}
  </div>
);
