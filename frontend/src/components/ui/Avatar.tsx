// Brand tints with navy ink. Gold (earned) and pink (rescue) are reserved,
// so a person's initial never borrows them.
const COLORS = [
  'bg-brand-100 text-navy',
  'bg-navy-100 text-navy',
  'bg-green-100 text-navy',
  'bg-brand-200 text-navy',
  'bg-biscuit-deep text-navy',
  'bg-navy-200 text-navy',
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
      className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-extrabold shrink-0 ring-2 ring-navy dark:ring-white/25`}
    >
      {initial}
    </div>
  );
}
