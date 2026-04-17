library(sf)
library(jsonlite)
sf_use_s2(FALSE)

# Load Natural Earth land
land <- st_read('natural-earth-data/ne_110m_land.shp', quiet=TRUE)
cat('Natural Earth 1:110m land features:', nrow(land), '\n\n')

# Test New Zealand coordinates
nz_points <- data.frame(
  lon=c(174.0, 172.0, 169.0, 171.5),
  lat=c(-41.5, -42.0, -44.0, -43.5),
  label=c('North Island', 'South Island-North', 'South Island-South', 'South Island-Center')
)

nz_sf <- st_as_sf(nz_points, coords=c('lon','lat'), crs=4326)
land_union <- st_union(land)

cat('Testing New Zealand points in Natural Earth LAND:\n')
for(i in 1:nrow(nz_sf)) {
  within <- st_within(nz_sf[i,], land_union, sparse=FALSE)[1,1]
  cat(sprintf('  %-25s: %s\n', 
    nz_points$label[i], 
    if(within) 'Found in land data ✓' else 'MISSING from land ✗'))
}

# Now test against generated ocean
cat('\nTesting same points in generated OCEAN polygon:\n')
json_data <- fromJSON('output/country_polygons.json')
ocean_data <- json_data[json_data$identifier == 'OCEAN',]
ocean_geom <- st_as_sfc(ocean_data$wkt, crs=4326)

for(i in 1:nrow(nz_sf)) {
  within <- st_within(nz_sf[i,], ocean_geom, sparse=FALSE)[1,1]
  cat(sprintf('  %-25s: %s\n', 
    nz_points$label[i], 
    if(within) 'IN OCEAN ✗ WRONG' else 'NOT in ocean ✓'))
}

# Check bounding box of land data
cat('\nNatural Earth land bounding box:\n')
bbox <- st_bbox(land_union)
cat(sprintf('  Longitude: %.1f to %.1f\n', bbox['xmin'], bbox['xmax']))
cat(sprintf('  Latitude: %.1f to %.1f\n', bbox['ymin'], bbox['ymax']))
