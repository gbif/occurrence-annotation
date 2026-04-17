library(sf)
library(jsonlite)
sf_use_s2(FALSE)

# Load the ocean polygon from JSON
json_data <- fromJSON('output/country_polygons.json')
ocean_data <- json_data[json_data$identifier == 'OCEAN',]
ocean_geom <- st_as_sfc(ocean_data$wkt, crs = 4326)

cat('Ocean polygon loaded\n')
cat('  Vertices:', ocean_data$vertexCount, '\n\n')

# Create a user-drawn box around New Zealand
# New Zealand is roughly: 165-179 E, 47-34 S
nz_box <- st_as_sfc("POLYGON((165 -47, 179 -47, 179 -34, 165 -34, 165 -47))", crs = 4326)
cat('User box around New Zealand:\n')
cat('  Longitude: 165 to 179 E\n')
cat('  Latitude: 34 to 47 S\n\n')

# Subtract ocean from the user box (should leave only land)
cat('Subtracting ocean from user box...\n')
result <- st_difference(nz_box, ocean_geom)

cat('\nResult:\n')
if (st_is_empty(result)) {
  cat('  EMPTY - entire box was ocean (WRONG!)\n')
} else {
  cat('  NOT EMPTY - land was retained ✓\n')
  
  # Export to WKT to visualize
  result_wkt <- st_as_text(result)
  writeLines(result_wkt, 'test_nz_result.wkt')
  cat('  WKT saved to: test_nz_result.wkt\n')
  
  # Check if result is multipolygon
  geom_type <- st_geometry_type(result)
  cat(sprintf('  Geometry type: %s\n', geom_type))
  
  # Count number of polygons
  if (grepl('MULTI', geom_type)) {
    n_polys <- length(st_cast(result, "POLYGON"))
    cat(sprintf('  Number of pieces: %d\n', n_polys))

  }
}

# Also test specific NZ points
cat('\n--- Testing specific NZ locations ---\n')
nz_points <- data.frame(
  lon=c(174.0, 172.0, 169.0, 171.5, 168.5),
  lat=c(-41.5, -42.0, -44.0, -43.5, -45.5),
  label=c('North Island', 'South Island-North', 'South Island-South', 'South Island-Center', 'South Island-SW')
)

nz_sf <- st_as_sf(nz_points, coords=c('lon','lat'), crs=4326)

for(i in 1:nrow(nz_sf)) {
  in_ocean <- st_within(nz_sf[i,], ocean_geom, sparse=FALSE)[1,1]
  in_result <- if (!st_is_empty(result)) {
    st_within(nz_sf[i,], result, sparse=FALSE)[1,1]
  } else {
    FALSE
  }
  
  cat(sprintf('%-25s: Ocean=%s, Result=%s %s\n', 
    nz_points$label[i], 
    if(in_ocean) 'YES' else 'NO ',
    if(in_result) 'YES' else 'NO ',
    if(!in_ocean && in_result) '✓' else if(in_ocean) '(should be ocean)' else '✗ LOST'))
}
