import { useEffect, useState } from 'react';
import type { PigeonProps } from 'pigeon-maps';
import type { OccurrenceFilterOptions } from './OccurrenceFilters';
import { MapPolygonLayer } from './MapPolygonLayer';
import { useOverlayEntry } from '../utils/overlayRegistry';
import { useOverlayVisibility } from '../utils/useOverlayVisibility';
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
  const [visible, setVisible] = useOverlayVisibility('coordinateLessCountries');
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
          error: 'Country reports unavailable.',
        });
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const current = state.query === query;
  const countries = current ? state.countries : [];
  const countryCount = new Set(countries.map(country => country.code)).size;
  const empty = current && !state.loading && !state.error && countryCount === 0;
  const status = !current || state.loading ? 'loading' : state.error ? 'error' : 'ready';
  useOverlayEntry(!query || empty ? null : {
    id: 'coordinateLessCountries',
    label: status === 'ready' ? `No coordinates: ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}` : 'No coordinates',
    color: '#64748b',
    dashed: true,
    visible,
    setVisible,
    status,
    detail: status === 'error' ? 'Country reports unavailable.' : undefined,
    description: 'GBIF occurrences of this taxon that have no coordinates but do report a country. '
      + 'Shaded countries show where such records exist, not precise locations. '
      + [...new Map(countries.map(country => [country.code, country])).values()]
        .map(country => `${country.name} (${country.count.toLocaleString()})`).join(', '),
  });

  if (!query || !mapState || !latLngToPixel) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <MapPolygonLayer
        polygons={visible ? countries.flatMap(country => country.polygons) : []}
        color="#64748b"
        dashed
        mapState={mapState}
        latLngToPixel={latLngToPixel}
      />
    </div>
  );
}