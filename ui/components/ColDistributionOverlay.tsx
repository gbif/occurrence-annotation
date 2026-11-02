import { useEffect, useState } from 'react';
import type { PigeonProps } from 'pigeon-maps';
import { fetchColDistributions, type ColDistributionResult } from '../utils/colDistributions';
import { MapPolygonLayer } from './MapPolygonLayer';
import { useOverlayEntry } from '../utils/overlayRegistry';
import { useOverlayVisibility } from '../utils/useOverlayVisibility';

interface ColDistributionOverlayProps extends PigeonProps {
  taxonKey: string | null;
  isColTaxon?: boolean;
}

export function ColDistributionOverlay({
  taxonKey, isColTaxon = taxonKey !== null && !/^\d+$/.test(taxonKey), mapState, latLngToPixel,
}: ColDistributionOverlayProps) {
  const [visible, setVisible] = useOverlayVisibility('colDistribution');
  const query = taxonKey ? `${isColTaxon ? 'col' : 'gbif'}:${taxonKey}` : '';
  const [state, setState] = useState<{
    query: string; result: ColDistributionResult; loading: boolean; error: string | null;
  }>({ query: '', result: { areas: [], unmapped: [] }, loading: false, error: null });

  useEffect(() => {
    if (!taxonKey) return;
    const controller = new AbortController();
    setState({ query, result: { areas: [], unmapped: [] }, loading: true, error: null });
    const timer = setTimeout(() => {
      fetchColDistributions(taxonKey, controller.signal, isColTaxon).then(result => {
        if (!controller.signal.aborted) setState({ query, result, loading: false, error: null });
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Failed to load COL distributions:', error);
        setState({
          query, result: { areas: [], unmapped: [] }, loading: false,
          error: 'COL range unavailable.',
        });
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, taxonKey, isColTaxon]);

  const current = state.query === query;
  const areas = current ? state.result.areas : [];
  const unmapped = current ? state.result.unmapped : [];
  const empty = current && !state.loading && !state.error && areas.length === 0 && unmapped.length === 0;
  const means = [...new Set(areas.flatMap(area => area.establishmentMeans))];
  const status = !current || state.loading ? 'loading' : state.error ? 'error' : 'ready';
  useOverlayEntry(!query || empty ? null : {
    id: 'colDistribution',
    label: status === 'ready' ? `COL range: ${areas.length} mapped ${areas.length === 1 ? 'area' : 'areas'}` : 'COL range',
    color: '#ECAC7C',
    visible,
    setVisible,
    status,
    detail: status === 'error' ? 'COL range unavailable.' : means.join(', ') || undefined,
    description: 'Catalogue of Life published range for this taxon (not occurrence records or precise locations). '
      + 'Shaded areas: ' + areas.map(area =>
        `${area.name}${area.establishmentMeans.length ? ` (${area.establishmentMeans.join(', ')})` : ''}`
      ).join('; '),
    unmapped,
  });

  if (!query || !mapState || !latLngToPixel) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <MapPolygonLayer
        polygons={visible ? areas.flatMap(area => area.polygons) : []}
        color="#ECAC7C"
        mapState={mapState}
        latLngToPixel={latLngToPixel}
      />
    </div>
  );
}