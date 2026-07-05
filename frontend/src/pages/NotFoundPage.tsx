import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import DogIllustration from '../components/flair/DogIllustration';
import { useAuth } from '../store/AuthContext';

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <DogIllustration name="digging" className="mb-4 h-32 w-auto text-gray-400 dark:text-gray-500" />
      <h1 className="text-2xl font-bold tracking-tight text-gray-700 dark:text-gray-300 mb-2">Page not found</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        We dug everywhere but couldn't find that page.
      </p>
      <Link to={isAuthenticated ? '/app/home' : '/'}>
        <Button>Go Home</Button>
      </Link>
    </div>
  );
}
