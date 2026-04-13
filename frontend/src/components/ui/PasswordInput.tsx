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

  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-400' };
  if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-amber-400' };
  if (score <= 3) return { level: 3, label: 'Good', color: 'bg-yellow-400' };
  if (score <= 4) return { level: 4, label: 'Strong', color: 'bg-green-400' };
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
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            value={value}
            className={`w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-10 text-base outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-200 ${
              error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''
            } ${className}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
            tabIndex={-1}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
        {strength && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${strength.color}`}
                style={{ width: `${(strength.level / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{strength.label}</span>
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
