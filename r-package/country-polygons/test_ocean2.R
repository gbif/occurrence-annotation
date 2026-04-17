library(sf)
sf_use_s2(FALSE)

ocean <- st_read('natural-earth-data/ne_110m_ocean.shp', quiet=TRUE)
cat('Testing ocean water coordinates:\n\n')

test_points <- data.frame(
  lon=c(-40, -120, 150, 10, -100, -74, 100),
  lat=c(30, 30, 30, 30, 40, 40, 35),
  label=c('Atlantic', 'Pacific', 'Pacific-West', 'Atlantic-East', 'USA-Kansas-LAND', 'NYC-LAND', 'China-LAND')
)

test_sf <- st_as_sf(test_points, coords=c('lon','lat'), crs=4326)
ocean_union <- st_union(ocean)

for(i in 1:nrow(test_sf)) {
  within <- st_within(test_sf[i,], ocean_union, sparse=FALSE)[1,1]
  cat(sprintf('%-20s: %s\n', test_points$label[i], if(within) 'INSIDE ocean polygon' else 'OUTSIDE ocean polygon'))
}

cat('\nExpected: Ocean water should be INSIDE, land should be OUTSIDE\n')
