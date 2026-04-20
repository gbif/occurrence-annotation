# Ocean Polygon Generator

This directory contains scripts to generate the ocean boundary polygon used by the **Subtract Ocean** feature in the occurrence annotation UI.

## Overview

The script uses Natural Earth 1:110m ocean data to create a simple, clean global ocean polygon that is subtracted from user-drawn polygons to extract only land areas.

**Current Usage**: Ocean polygon generation only (for the Subtract Ocean feature).

**Legacy Capability**: The script also contains country/continent polygon generation code using ISEA3H hexagonal grids and GBIF geocoding, but this is not currently used by the application.

## Requirements

R packages:
- `sf` - Spatial data handling
- `dplyr` - Data manipulation
- `jsonlite` - JSON export

The script will automatically install missing packages.

## Usage

### Regenerate Ocean Polygon Only (Recommended)

```bash
# From command line (fast, <1 minute)
Rscript generate_ocean_polygon.R --mode=ocean
```

This will:
1. Download Natural Earth ocean data (if not cached)
2. Process it into a simplified multipolygon
3. Export to JSON format
4. Copy to UI public directory

### Alternative: Full Generation

```r
# From R console (slower, includes continents)
source("generate_ocean_polygon.R")
main()

# Or from command line
Rscript generate_ocean_polygon.R
```

**Note**: Full generation (continents + ocean) takes 30-120 minutes due to GBIF API geocoding. For the Subtract Ocean feature, only the ocean polygon is needed.

## Output

### Primary Output
- `output/country_polygons.json` - Generated ocean polygon (working copy)
- `../../ui/public/country_polygons.json` - Auto-copied to frontend (served as static asset)

**File size**: ~50-180 KB (depending on whether continents are included)

**Architecture note**: The ocean polygon is served as a static JSON file from the frontend's public directory, eliminating the need for backend API endpoints.

### Format

```json
[
  {
    "identifier": "OCEAN",
    "type": "IHO",
    "name": "Ocean",
    "wkt": "MULTIPOLYGON(((-180 -90, 180 -90, ...)))",
    "vertexCount": 1234
  }
]
```

## Technical Details

### Data Source

- **Ocean**: Natural Earth 1:110m ocean polygons (ne_110m_land.zip)
- Global coverage with simplified coastlines
- Suitable for frontend rendering performance

### Polygon Simplification

Vertices reduced using `sf::st_simplify()` with tolerance of **0.01°** (~1.1 km at equator):
- Balances accuracy vs. frontend rendering performance
- Preserves general coastline shape while reducing file size

### Subtract Ocean Feature

The ocean polygon is used client-side to subtract ocean areas from user-drawn polygons:
1. User draws a polygon on the map
2. Click "Subtract Ocean" button
3. JavaScript uses polygon-clipping library to perform difference operation
4. Result contains only land areas within the original polygon
5. For regions with multiple land masses (e.g., archipelagos), all islands are preserved as separate polygons

## Directory Structure

```
boundary-polygons/
├── generate_ocean_polygon.R     # Main generation script (supports --mode=ocean)
├── natural-earth-data/           # Natural Earth ocean shapefiles (downloaded on first run)
├── output/                       # Generated JSON output
└── README.md                     # This file
```

## Maintenance

To update the ocean polygon (e.g., if Natural Earth releases updated data):

```bash
# Delete cached Natural Earth data
rm -r natural-earth-data/

# Regenerate ocean polygon
Rscript generate_ocean_polygon.R --mode=ocean
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
