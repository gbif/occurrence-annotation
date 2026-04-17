library(sf)
library(jsonlite)
sf_use_s2(FALSE)

# Load ocean from generated JSON
json_data <- fromJSON('output/country_polygons.json')
ocean_data <- json_data[json_data$identifier == 'OCEAN',]
ocean_geom <- st_as_sfc(ocean_data$wkt, crs = 4326)

cat('Testing NEW ocean polygon (from JSON):\n\n')

test_points <- data.frame(
  lon=c(-40, -120, 150, 10, -100, -74, 100, -70),
  lat=c(30, 30, 30, 30, 40, 40, 35, -30),
  label=c('Atlantic-water', 'Pacific-water', 'Pacific-West-water', 'Atlantic-East-water', 
          'USA-Kansas-LAND', 'NYC-LAND', 'China-LAND', 'Argentina-LAND')
)

test_sf <- st_as_sf(test_points, coords=c('lon','lat'), crs=4326)

for(i in 1:nrow(test_sf)) {
  within <- st_within(test_sf[i,], ocean_geom, sparse=FALSE)[1,1]
  expected <- grepl('water', test_points$label[i])
  correct <- (within == expected)
  cat(sprintf('%-25s: %s %s\n', 
    test_points$label[i], 
    if(within) 'INSIDE ocean' else 'OUTSIDE ocean',
    if(correct) '✓' else '✗ WRONG'))
}

cat('\nExpected: Water should be INSIDE, land should be OUTSIDE\n')
