library(sf)
library(jsonlite)
sf_use_s2(FALSE)

# Load ocean from generated JSON
json_data <- fromJSON('output/country_polygons.json')
ocean_data <- json_data[json_data$identifier == 'OCEAN',]
ocean_geom <- st_as_sfc(ocean_data$wkt, crs = 4326)

cat('Testing NEW ocean polygon with precise coordinates:\n\n')

test_points <- data.frame(
  lon=c(-40, -120, 150, -100, -73.5, 100, -70, -60, 0),
  lat=c(30, 30, 30, 40, 40.7, 35, -30, -10, 0),
  label=c('Atlantic-Ocean', 'Pacific-Ocean', 'Pacific-West-Ocean', 
          'USA-Kansas', 'NYC', 'China-Inland', 'Argentina', 
          'Amazon-Basin', 'Equator-Atlantic')
)

test_sf <- st_as_sf(test_points, coords=c('lon','lat'), crs=4326)

for(i in 1:nrow(test_sf)) {
  within <- st_within(test_sf[i,], ocean_geom, sparse=FALSE)[1,1]
  status <- if(within) 'INSIDE ocean (water)' else 'OUTSIDE ocean (land)'
  cat(sprintf('%-20s (%6.1f, %5.1f): %s\n', 
    test_points$label[i], 
    test_points$lon[i],
    test_points$lat[i],
    status))
}

cat('\nContinents loaded from JSON:\n')
cont_data <- json_data[json_data$type == 'Continent',]
cat(paste(sort(cont_data$identifier), collapse=', '), '\n')
