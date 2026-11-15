import { Link } from 'react-router-dom';
import DogIllustration from '../components/flair/DogIllustration';
import { useAuth } from '../store/AuthContext';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found · Fetchpawz');
  const { isAuthenticated } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <DogIllustration name="digging" className="mb-4 h-32 w-auto" />
      {/* Errors take the calm register: plain type, no Bagel. */}
      <h1 className="font-plain text-[26px] leading-tight text-navy dark:text-biscuit mb-2">Page not found</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        We dug everywhere but couldn't find that page.
      </p>
      <Link to={isAuthenticated ? '/app/home' : '/'} className="btn btn-primary">
        Go home
      </Link>
    </div>
  );
}
