import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  title,
  description 
}) => {
  return (
    <div className={`bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/60 p-6 transition-all duration-300 hover:border-slate-600/80 hover:shadow-xl hover:shadow-blue-900/20 ${className}`}>
      {title && (
        <div className="mb-6 pb-4 border-b border-slate-700/40">
          <h3 className="text-lg font-bold text-slate-100 tracking-tight">{title}</h3>
          {description && (
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};
