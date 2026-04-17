# Country Polygon Generator

This directory contains scripts to generate country boundary polygons from the ISEA3H hexagonal grid (resolution-7) using GBIF's reverse geocoding API.

## Overview

The pipeline:
1. Downloads ISEA3H resolution-7 hexagonal grid (~16,000 hexagons)
2. Generates 3×3 sample point grid within each hexagon (~80-144k points)
3. Geocodes each point using GBIF API to determine country
4. Assigns each hexagon to a country (majority vote for border hexagons)
5. Dissolves hexagons into country-level multipolygons
6. Simplifies polygons and exports as WKT/JSON

## Requirements

R packages:
- `sf` - Spatial data handling
- `dplyr` - Data manipulation
- `httr` - HTTP requests
- `jsonlite` - JSON export
- `stringr` - String operations

The script will automatically install missing packages.

## Usage

### Running the Script

```r
# From R console
source("generate_country_polygons.R")
main()

# Or from command line
Rscript generate_country_polygons.R
```

### First Run

Expected runtime: **30-120 minutes** (depends on network speed and GBIF API response time)

The script includes:
- **Rate limiting**: ~20 requests/second to respect GBIF API
- **Caching**: Geocode results saved to `cache/geocode_results.rds`
- **Checkpoints**: Progress saved every 10,000 points
- **Resume capability**: Re-running continues from last checkpoint

### Subsequent Runs

If the cache file exists, the script will skip already-geocoded points and only process new ones. To completely regenerate:

```bash
# Delete cache to force re-geocoding
rm -r cache/
```

## Output

### Primary Output
- `output/country_polygons.json` - Generated country polygons (working copy)
- `../../ui/public/country_polygons.json` - Auto-copied to frontend (served as static asset)

**File size**: ~180 KB (suitable for frontend serving)

**Architecture note**: Country polygons are served as a static JSON file from the frontend's public directory, eliminating the need for backend API endpoints.

### Format

```json
[
  {
    "iso2": "US",
    "name": "United States",
    "wkt": "MULTIPOLYGON(((-179.9 51.2, -179.8 51.3, ...)))",
    "vertexCount": 2543
  },
  ...
]
```

### Cache Files

- `cache/geocode_results.rds` - Geocoded point results (lat, lon, iso2_code)
- `isea3h-data/resolution-7.*` - Downloaded ISEA3H shapefiles

## Technical Details

### Geocoding Strategy

For hexagons spanning multiple countries (typically at borders):
- **Majority vote**: Country with most sample points wins the hexagon
- Ensures cleaner, more predictable boundaries
- Reduces polygon complexity

### Polygon Simplification

Vertices reduced using `sf::st_simplify()` with tolerance of **0.01°** (~1.1 km at equator):
- Balances accuracy vs. frontend rendering performance
- Preserves general shape while reducing file size
- Typical result: 100-5000 vertices per country

### Coordinate System

All data transformed to **WGS84 (EPSG:4326)** to match the application's coordinate system.

## Troubleshooting

### "Rate limited" messages

The GBIF API has rate limits. The script automatically waits and retries. If you see many rate limit errors:
- Increase `RATE_LIMIT_DELAY` in the script (currently 0.05 = 50ms)
- Wait a few minutes and re-run (cache ensures no duplicate work)

### Memory issues

Processing ~16k hexagons is memory-intensive. If R crashes:
- Close other applications
- Increase R memory limit: `memory.limit(size = 16000)` (Windows)
- Process in chunks by modifying the hexagon subset

### ISEA3H download fails

If GitHub download fails, manually download from:
https://github.com/jhnwllr/ISEA3H-shapefiles/tree/main/resolution-7

Place all files (`.shp`, `.shx`, `.dbf`, `.prj`) in `isea3h-data/`

### GBIF API changes

If geocode API format changes, update the geocoding section in the script. Current API:
```
https://api.gbif.org/v1/geocode/reverse?lat={lat}&lng={lng}
```

## Updating Country Data

Re-run the script when:
- ISEA3H grid updates to a new version
- You want different polygon simplification tolerance
- Country boundaries change (though ISEA3H grid itself is stable)

## Performance Tips

**First run optimization:**
- Run overnight or during low-activity hours
- Stable internet connection recommended
- Monitor progress in console (updates every 100 points)

**Incremental updates:**
- Keep `cache/` directory to avoid re-geocoding
- Only delete cache if you need fresh geocode data

## Integration with Backend

The script automatically copies the output to:
```
backend-service/src/main/resources/countries/country_polygons.json
```

After running:
1. Rebuild backend: `cd backend-service && docker-compose up -d --build backend`
2. Verify API endpoint: http://localhost:8080/swagger-ui/index.html
3. Test: `GET /occurrence/experimental/annotation/countries/geometries`

## License

Same as parent project (Apache 2.0).
