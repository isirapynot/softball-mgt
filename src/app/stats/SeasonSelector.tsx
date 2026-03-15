'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface Props {
  seasons: string[]; // all available seasons from the server
}

export default function SeasonSelector({ seasons }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Always read active state from the live URL — stays in sync after navigation
  const seasonParam = searchParams.get('season');
  const active: string[] = seasonParam
    ? seasonParam.split(',').map(s => decodeURIComponent(s.trim())).filter(Boolean)
    : [];

  if (seasons.length === 0) return null;

  function toggle(season: string) {
    const next = active.includes(season)
      ? active.filter(s => s !== season)
      : [...active, season];
    router.push(
      next.length
        ? `/stats?season=${next.map(encodeURIComponent).join(',')}`
        : '/stats'
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* All Time pill */}
      <button
        onClick={() => router.push('/stats')}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
          active.length === 0
            ? 'bg-gray-700 text-white border-gray-700'
            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
        }`}
      >
        All Time
      </button>

      {seasons.map(s => {
        const isActive = active.includes(s);
        return (
          <button
            key={s}
            onClick={() => toggle(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              isActive
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-700'
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
