import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  fallback?: string;
  label?: string;
}

export default function BackButton({ fallback = '/home', label = 'Back' }: BackButtonProps) {
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
      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3"
    >
      <span className="text-lg leading-none">&lsaquo;</span>
      {label}
    </button>
  );
}
