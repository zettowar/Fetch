import type { Species } from '../../types';
import DogIllustration, { type DogIllustrationName } from './DogIllustration';
import CatIllustration from './CatIllustration';

/** Shared pose name for both species' line-art. */
export type IllustrationName = DogIllustrationName;

interface PetIllustrationProps {
  name: IllustrationName;
  species?: Species;
  className?: string;
  title?: string;
}

/**
 * Species-aware line-art: renders the cat set for cats, the dog set otherwise.
 * Both sets share pose names, viewBox, and stroke style, so this is a drop-in
 * replacement for a bare DogIllustration wherever a pet's species is known.
 */
export default function PetIllustration({
  species = 'dog',
  name,
  className,
  title,
}: PetIllustrationProps) {
  const Illo = species === 'cat' ? CatIllustration : DogIllustration;
  return <Illo name={name} className={className} title={title} />;
}
