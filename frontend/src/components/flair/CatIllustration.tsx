import { Doodle } from './DogIllustration';
import type { IllustrationName } from './PetIllustration';

interface CatIllustrationProps {
  name: IllustrationName;
  className?: string;
  title?: string;
}

/**
 * The cat doodles: the same five moments as the dogs (sleeping, yarn,
 * sniffing, batting, meowing), same pen, same grid. See DogIllustration.
 */
export default function CatIllustration({ name, className = 'h-32 w-auto', title }: CatIllustrationProps) {
  return <Doodle species="cat" name={name} className={className} title={title} />;
}
