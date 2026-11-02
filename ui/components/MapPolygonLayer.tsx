import { useId } from 'react';
import type { PigeonProps } from 'pigeon-maps';
import type { PolygonWithHoles } from '../utils/wktParser';
import { projectPolygon } from '../utils/polygonPath';

interface MapPolygonLayerProps extends PigeonProps {
  polygons: PolygonWithHoles[];
  color: string;
  dashed?: boolean;
}

export function MapPolygonLayer({
  polygons, color, dashed, mapState, latLngToPixel,
}: MapPolygonLayerProps) {
  const clipId = useId();
  if (!mapState || !latLngToPixel) return null;
  const worldWidth = 256 * Math.pow(2, mapState.zoom);
  const [worldLeft, equatorY] = latLngToPixel([0, -180]);
  const worldTop = equatorY - worldWidth / 2;
  // Paths are cached per integer zoom; fractional zoom during animation is a cheap scale.
  const pathZoom = Math.max(0, Math.round(mapState.zoom));
  const scale = Math.pow(2, mapState.zoom - pathZoom);
  return (
    <svg
      width={mapState.width}
      height={mapState.height}
      style={{ display: 'block', overflow: 'hidden' }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={worldLeft} y={worldTop} width={worldWidth} height={worldWidth} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {polygons.flatMap((polygon, index) => {
          const projected = projectPolygon(polygon, pathZoom);
          if (!projected) return [];
          const [minX, minY, maxX, maxY] = projected.bounds;
          const top = worldTop + minY * scale;
          const bottom = worldTop + maxY * scale;
          if (bottom < 0 || top > mapState.height) return [];
          // Keep dateline-crossing parts on both edges, clipped to the single tiled world; skip off-screen copies.
          return [-1, 0, 1].flatMap(copy => {
            const left = worldLeft + copy * worldWidth;
            if (left + maxX * scale < 0 || left + minX * scale > mapState.width) return [];
            return [(
              <path
                key={`${index}-${copy}`}
                d={projected.path}
                transform={`translate(${left},${worldTop}) scale(${scale})`}
                vectorEffect="non-scaling-stroke"
                fill={color}
                fillOpacity={0.12}
                stroke={color}
                strokeOpacity={0.45}
                strokeWidth={0.8}
                strokeDasharray={dashed ? '3 3' : undefined}
                fillRule="evenodd"
              />
            )];
          });
        })}
      </g>
    </svg>
  );
}
