import { useEffect, useState } from 'react';
import type { PigeonProps } from 'pigeon-maps';
import type { OccurrenceFilterOptions } from './OccurrenceFilters';
import {
  coordinateLessCountryQuery, fetchCoordinateLessCountries, type CoordinateLessCountry,
} from '../utils/coordinateLessCountries';

interface CoordinateLessCountryOverlayProps extends PigeonProps {
  taxonKey: string | null;
  filters?: OccurrenceFilterOptions;
  checklistKey?: string;
}

export function CoordinateLessCountryOverlay({
  taxonKey, filters = {}, checklistKey, mapState, latLngToPixel,
}: CoordinateLessCountryOverlayProps) {
  const query = taxonKey ? coordinateLessCountryQuery(taxonKey, filters, checklistKey) : '';
  const [state, setState] = useState<{
    query: string;
    countries: CoordinateLessCountry[];
    loading: boolean;
    error: string | null;
  }>({ query: '', countries: [], loading: false, error: null });

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    setState({ query, countries: [], loading: true, error: null });
    const timer = setTimeout(() => {
      fetchCoordinateLessCountries(query, controller.signal).then(countries => {
        if (!controller.signal.aborted) {
          setState({ query, countries, loading: false, error: null });
        }
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Failed to load countries with coordinate-less occurrences:', error);
        setState({
          query, countries: [], loading: false,
          error: 'Countries with records without coordinates could not be loaded.',
        });
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (!query || !mapState || !latLngToPixel) return null;
  const current = state.query === query;
  const countries = current ? state.countries : [];
  const worldWidth = 256 * Math.pow(2, mapState.zoom);
  const repeats = Math.ceil(mapState.width / worldWidth) + 1;
  const countryCount = new Set(countries.map(country => country.code)).size;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width={mapState.width} height={mapState.height} aria-hidden="true">
        {countries.flatMap(country => country.polygons.flatMap((polygon, index) => {
          // Shift the whole polygon, including holes, to the nearest visible world copy.
          const longitude = polygon.outer[0][1];
          const shift = 360 * Math.round((mapState.center[1] - longitude) / 360);
          const path = [polygon.outer, ...polygon.holes].map(ring =>
            ring.map(([lat, lng], pointIndex) => {
              const [x, y] = latLngToPixel([lat, lng + shift]);
              return `${pointIndex === 0 ? 'M' : 'L'}${x},${y}`;
            }).join(' ') + ' Z'
          ).join(' ');
          return Array.from({ length: repeats * 2 + 1 }, (_, copy) => (
            <path
              key={`${country.code}-${country.name}-${index}-${copy}`}
              d={path}
              transform={`translate(${(copy - repeats) * worldWidth},0)`}
              fill="#64748b"
              fillOpacity={0.12}
              stroke="#64748b"
              strokeOpacity={0.45}
              strokeWidth={0.8}
              strokeDasharray="3 3"
              fillRule="evenodd"
            />
          ));
        }))}
      </svg>
      <div
        role="status"
        className="absolute bottom-10 right-2 max-w-xs rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm"
        style={{ maxWidth: 'calc(100% - 5rem)' }}
      >
        {!current || state.loading ? 'Loading countries with records without coordinates...' :
          state.error ? state.error :
            <><span className="mr-1 inline-block h-2 w-3 border border-dashed border-slate-500 bg-slate-400/20" />
              Records without coordinates: {countryCount} {countryCount === 1 ? 'country' : 'countries'}
              {countryCount > 0 && <span className="block">Country-level reports, not precise locations</span>}
            </>}
      </div>
    </div>
  );
}
