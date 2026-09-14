import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
}) => {
  return (
    <div className={`bg-white dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/60 rounded-xl p-5 shadow-sm dark:shadow-none backdrop-blur-sm transition-colors duration-150 ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700/50">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
