import { useNavigate } from 'react-router-dom';
import BrandIcon from '../brand/BrandIcon';

interface BackButtonProps {
  fallback?: string;
  label?: string;
}

export default function BackButton({ fallback = '/app/home', label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate(fallback);
        }
      }}
      className="group mb-3 inline-flex items-center gap-2 rounded-full text-sm font-bold text-gray-700 transition-colors hover:text-navy dark:text-gray-200 dark:hover:text-biscuit"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-navy/30 transition-colors group-hover:border-navy dark:border-white/30 dark:group-hover:border-biscuit">
        <BrandIcon name="back" size={16} />
      </span>
      {label}
    </button>
  );
}
