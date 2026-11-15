import { InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId || generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-2xs font-extrabold uppercase tracking-[0.1em] text-gray-600 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full min-h-[48px] rounded-lg border-2 bg-white dark:bg-night-surface px-3.5 py-2.5 text-base font-semibold text-navy dark:text-biscuit placeholder:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out disabled:cursor-not-allowed disabled:border-dashed disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-night ${
            error
              ? 'border-danger-500 focus:ring-4 focus:ring-danger-500/20 dark:border-danger-400'
              : 'border-navy/25 hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:hover:border-white/35 dark:focus:border-brand-400'
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="text-sm font-semibold text-danger-700 dark:text-danger-300 animate-fade-in-up">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
