import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-500 focus:ring-blue-500 focus:ring-offset-slate-100 dark:focus:ring-offset-[#1e1e1e]',
    secondary: 'bg-slate-100 dark:bg-[#252526] text-slate-700 dark:text-[#e6edf3] hover:bg-slate-200 dark:hover:bg-[#2a2d2e] border border-slate-300 dark:border-[#3c3c3c] focus:ring-slate-500 focus:ring-offset-slate-100 dark:focus:ring-offset-[#1e1e1e]',
    danger: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500 focus:ring-offset-slate-100 dark:focus:ring-offset-[#1e1e1e]',
    ghost: 'bg-transparent text-slate-600 dark:text-[#9da7b3] hover:bg-slate-100 dark:hover:bg-[#2a2d2e] hover:text-slate-900 dark:hover:text-[#e6edf3] focus:ring-slate-500',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
};
