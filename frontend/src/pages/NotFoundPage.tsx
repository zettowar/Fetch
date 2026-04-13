import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <span className="text-5xl mb-3">{'\ud83d\udc36'}</span>
      <h1 className="text-2xl font-bold text-gray-700 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-6">Looks like this page ran off. Let's get you back.</p>
      <Link to="/home">
        <Button>Go Home</Button>
      </Link>
    </div>
  );
}
