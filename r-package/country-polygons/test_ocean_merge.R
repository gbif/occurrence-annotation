# Quick test of ocean merging logic
library(sf)
library(dplyr)
library(jsonlite)

# Load existing polygon data
json_data <- fromJSON("../../ui/public/country_polygons.json")

# Create sf object from JSON
polygons_list <- lapply(seq_len(nrow(json_data)), function(i) {
  row <- json_data[i, ]
  geom <- st_as_sfc(row$wkt, crs = 4326)
  st_sf(
    identifier = row$identifier,
    type = row$type,
    name = row$name,
    iso2_code = ifelse(is.null(row$iso2) || is.na(row$iso2), "", as.character(row$iso2)),
    geometry = geom
  )
})

polygons_sf <- do.call(rbind, polygons_list)

cat("Original polygon count:", nrow(polygons_sf), "\n")
cat("By type:\n")
print(table(polygons_sf$type))

# Test merge function
iho_count <- sum(polygons_sf$type == "IHO", na.rm = TRUE)
cat("\nIHO polygons to merge:", iho_count, "\n")

if (iho_count > 0) {
  iho_polygons <- polygons_sf %>% filter(type == "IHO")
  non_iho_polygons <- polygons_sf %>% filter(type != "IHO")
  
  cat("Merging IHO polygons...\n")
  
  # Turn off S2 spherical geometry to avoid validation errors
  s2_was_enabled <- sf_use_s2()
  sf_use_s2(FALSE)
  
  # Use st_buffer(0) to fix invalid geometries before union
  ocean_geometry <- iho_polygons %>%
    mutate(geometry = st_buffer(geometry, 0)) %>%
    pull(geometry) %>%
    st_union()
  
  # Restore S2 setting
  sf_use_s2(s2_was_enabled)
  
  ocean_row <- st_sf(
    identifier = "OCEAN",
    type = "IHO",
    name = "Ocean",
    iso2_code = "",
    geometry = ocean_geometry,
    crs = st_crs(polygons_sf)
  )
  
  result <- bind_rows(non_iho_polygons, ocean_row)
  
  cat("\n✓ Merge successful!\n")
  cat("New polygon count:", nrow(result), "\n")
  cat("By type:\n")
  print(table(result$type))
  
  # Check Ocean row
  ocean_check <- result %>% filter(identifier == "OCEAN")
  cat("\nOcean boundary:\n")
  cat("  Identifier:", ocean_check$identifier, "\n")
  cat("  Type:", ocean_check$type, "\n")
  cat("  Name:", ocean_check$name, "\n")
  coords <- st_coordinates(ocean_check$geometry)
  cat("  Vertex count:", nrow(coords), "\n")
} else {
  cat("No IHO polygons found\n")
}
