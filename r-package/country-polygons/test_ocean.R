library(sf)
sf_use_s2(FALSE)

ocean <- st_read('natural-earth-data/ne_110m_ocean.shp', quiet=TRUE)
cat('Testing if land coordinates fall within ocean polygon:\n\n')

test_points <- data.frame(
  lon=c(-100, 0, 51, -74, -70),
  lat=c(40, 51, 50, 40, -30),
  label=c('USA-Kansas', 'UK-London', 'Germany', 'NYC', 'Argentina')
)

test_sf <- st_as_sf(test_points, coords=c('lon','lat'), crs=4326)
ocean_union <- st_union(ocean)

for(i in 1:nrow(test_sf)) {
  within <- st_within(test_sf[i,], ocean_union, sparse=FALSE)[1,1]
  cat(sprintf('%s: %s\n', test_points$label[i], if(within) 'INSIDE ocean' else 'OUTSIDE ocean'))
}
