import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPublicTag } from '../api/tags';
import { isNotFound } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { Spinner } from '../components/ui/Skeleton';
import BrandIcon from '../components/brand/BrandIcon';
import { useAuth } from '../store/AuthContext';
import FoundPetForm from './FoundPetForm';

/** The collar tag, drawn, on a soft Ball Orange disc. Plain, not playful. */
function TagMark() {
  return (
    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-navy dark:bg-brand-500/20 dark:text-biscuit">
      <BrandIcon name="tag" size={32} />
    </span>
  );
}

export default function TagLandingPage() {
  const { code } = useParams();
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-tag', code],
    queryFn: () => getPublicTag(code!),
    enabled: !!code,
    retry: (n, err) => !isNotFound(err) && n < 2,
  });
  useDocumentTitle('Pet tag · Fetchpawz');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner />
      </div>
    );
  }

  // Linked to a public pet → send them straight to the profile. The tag code
  // rides along so the share page can offer the "I found this pet" relay:
  // holding the tag is what authorises contacting the owner.
  if (data?.assigned && data.pet) {
    return <Navigate to={`/pets/${data.pet.id}?tag=${encodeURIComponent(code!)}`} replace />;
  }

  // Registered tag whose pet is hidden from the public share page. The owner
  // still wants to hear that their pet was found — "don't list me" is not
  // "don't tell me" — so the relay is offered here instead of the profile.
  if (data?.assigned && !data.pet) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="text-center">
          <TagMark />
          {/* Someone is standing there holding a stranger's pet: the calm
              register, plain type. */}
          <h1 className="mt-5 font-plain text-2xl text-navy dark:text-biscuit text-balance">
            This pet&rsquo;s profile is private
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            The tag is registered. You can still let their owner know they&rsquo;re
            safe.
          </p>
        </div>
        <div className="mt-8">
          <FoundPetForm code={code!} petName="this pet" />
        </div>
      </div>
    );
  }

  let title: string;
  let body: string;
  if (isError && isNotFound(error)) {
    title = 'Tag not recognized';
    body = "This tag code isn't in our system. Double-check the code, or the tag may be damaged.";
  } else if (isError) {
    title = "Couldn't load this tag";
    body = 'Something went wrong on our end. Try again in a moment.';
  } else {
    title = "This tag isn't linked yet";
    body = isAuthenticated
      ? 'If this is your tag, open your pet and link it under “QR tag”.'
      : 'If this is your tag, log in and link it to your pet from the pet’s page.';
  }

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <TagMark />
      <h1 className="mt-5 font-plain text-2xl text-navy dark:text-biscuit text-balance">{title}</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-300">{body}</p>
      {code && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Tag code:{' '}
          <span className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-navy dark:border-white/10 dark:bg-night-surface dark:text-biscuit">
            {code.toUpperCase()}
          </span>
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {!data?.assigned && !isAuthenticated && (
          <Link to="/login" className="btn btn-primary">
            Log in to link
          </Link>
        )}
        {!data?.assigned && isAuthenticated && (
          <Link to="/app/pets" className="btn btn-primary">
            Go to my pets
          </Link>
        )}
        <Link to="/" className="btn btn-secondary">
          Meet Fetchpawz
        </Link>
      </div>
    </div>
  );
}
