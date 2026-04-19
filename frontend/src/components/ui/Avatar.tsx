const COLORS = [
  'from-brand-300 to-brand-500 text-white',
  'from-sky-300 to-sky-500 text-white',
  'from-emerald-300 to-emerald-500 text-white',
  'from-violet-300 to-violet-500 text-white',
  'from-amber-300 to-amber-500 text-white',
  'from-pink-300 to-pink-500 text-white',
  'from-teal-300 to-teal-500 text-white',
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const sizes = {
  sm: 'w-6 h-6 text-[11px]',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-16 h-16 text-2xl',
  '2xl': 'w-24 h-24 text-4xl',
};

export default function Avatar({ name, size = 'sm' }: AvatarProps) {
  const initial = (name || '?')[0].toUpperCase();
  const color = hashColor(name || '');

  return (
    <div
      className={`${sizes[size]} bg-gradient-to-br ${color} rounded-full flex items-center justify-center font-semibold shrink-0 shadow-soft-sm ring-1 ring-black/5`}
    >
      {initial}
    </div>
  );
}
