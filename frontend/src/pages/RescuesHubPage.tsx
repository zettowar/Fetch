import { Link } from 'react-router-dom';
import { PawPrint as DogIcon, HousePlus, Map as MapIcon } from 'lucide-react';

export default function RescuesHubPage() {
  return (
    <div className="px-4 pt-5 pb-8 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <HousePlus size={20} aria-hidden className="text-brand-500" /> Rescues
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Find a forever home — or the rescue that has one.
        </p>
      </div>

      <Link
        to="/app/rescues/browse"
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white p-3.5 shadow-soft-lg hover:shadow-[0_10px_30px_-8px_rgba(147,51,234,0.5)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
      >
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xs uppercase tracking-widest opacity-80">Adoptables</p>
            <p className="text-base font-bold mt-0.5">Browse rescues</p>
            <p className="text-xs opacity-90 mt-0.5 truncate">
              Verified rescues and their adoptable pets
            </p>
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <DogIcon size={20} aria-hidden />
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-5 -bottom-5 w-20 h-20 rounded-full bg-white/10 blur-xl"
        />
      </Link>

      <Link
        to="/app/rescues/map"
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-3.5 shadow-soft-lg hover:shadow-[0_10px_30px_-8px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
      >
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xs uppercase tracking-widest opacity-80">Nearby</p>
            <p className="text-base font-bold mt-0.5">Rescue map</p>
            <p className="text-xs opacity-90 mt-0.5 truncate">
              See rescues plotted near you
            </p>
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <MapIcon size={20} aria-hidden />
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-5 -bottom-5 w-20 h-20 rounded-full bg-white/10 blur-xl"
        />
      </Link>
    </div>
  );
}
