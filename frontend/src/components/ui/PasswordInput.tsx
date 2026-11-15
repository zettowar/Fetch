import { InputHTMLAttributes, forwardRef, useId, useState } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  showStrength?: boolean;
}

function getStrength(pw: string): { level: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-danger-500' };
  if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-brand-400' };
  if (score <= 3) return { level: 3, label: 'Good', color: 'bg-brand-500' };
  if (score <= 4) return { level: 4, label: 'Strong', color: 'bg-green-500' };
  return { level: 5, label: 'Very strong', color: 'bg-green-600' };
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, showStrength, className = '', id: externalId, value, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId || generatedId;
    const [visible, setVisible] = useState(false);

    const strength = showStrength && typeof value === 'string' && value.length > 0
      ? getStrength(value)
      : null;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-2xs font-extrabold uppercase tracking-[0.1em] text-gray-600 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            value={value}
            className={`w-full min-h-[48px] rounded-lg border-2 bg-white dark:bg-night-surface px-3.5 py-2.5 pr-16 text-base font-semibold text-navy dark:text-biscuit placeholder:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-[border-color,box-shadow] duration-150 ${
              error
                ? 'border-danger-500 focus:ring-4 focus:ring-danger-500/20 dark:border-danger-400'
                : 'border-navy/25 hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:focus:border-brand-400'
            } ${className}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-extrabold text-gray-600 hover:bg-navy/5 hover:text-navy dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-biscuit"
            tabIndex={-1}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
        {strength && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1.5 bg-navy/10 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${strength.color}`}
                style={{ width: `${(strength.level / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{strength.label}</span>
          </div>
        )}
        {error && <p className="text-sm font-semibold text-danger-700 dark:text-danger-300">{error}</p>}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
