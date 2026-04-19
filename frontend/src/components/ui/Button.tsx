import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variants = {
  primary:
    'bg-brand-500 text-white shadow-soft-sm hover:bg-brand-600 hover:shadow-brand-glow active:bg-brand-700',
  secondary:
    'bg-white text-gray-800 border border-gray-200 shadow-soft-sm hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:active:bg-gray-900',
  danger:
    'bg-red-500 text-white shadow-soft-sm hover:bg-red-600 active:bg-red-700',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white dark:active:bg-gray-900',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-base rounded-xl',
  lg: 'px-6 py-3 text-lg rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-soft-out transform-gpu active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-none ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="inline-block h-4 w-4 flex-shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      <span className={loading ? 'opacity-90' : ''}>{children}</span>
    </button>
  );
}
