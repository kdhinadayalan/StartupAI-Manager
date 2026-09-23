import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#1e1e1e] border ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-[#3c3c3c] focus:border-[#007acc] focus:ring-[#007acc]'
        } rounded-lg text-slate-900 dark:text-[#e6edf3] placeholder-slate-400 dark:placeholder-[#6e7681] text-sm focus:outline-none focus:ring-1 transition-all ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
};
