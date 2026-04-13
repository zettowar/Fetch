const COLORS = [
  'bg-brand-200 text-brand-700',
  'bg-blue-200 text-blue-700',
  'bg-green-200 text-green-700',
  'bg-purple-200 text-purple-700',
  'bg-amber-200 text-amber-700',
  'bg-pink-200 text-pink-700',
  'bg-teal-200 text-teal-700',
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
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

export default function Avatar({ name, size = 'sm' }: AvatarProps) {
  const initial = (name || '?')[0].toUpperCase();
  const color = hashColor(name || '');

  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-bold shrink-0`}>
      {initial}
    </div>
  );
}
