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
          <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300 tracking-tight">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-xl border bg-white dark:bg-gray-800 px-4 py-2.5 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-all duration-200 ease-soft-out shadow-soft-sm ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:border-red-500/60 dark:focus:ring-red-500/30'
              : 'border-gray-200 hover:border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:hover:border-gray-600 dark:focus:border-brand-400 dark:focus:ring-brand-500/30'
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 animate-fade-in-up">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
