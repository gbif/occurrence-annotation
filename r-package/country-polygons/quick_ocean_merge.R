# Quick ocean merge from existing JSON
# This loads the current 251 polygons and merges the 23 IHO into 1 Ocean
library(sf)
library(dplyr)
library(jsonlite)

cat("========================================\n")
cat("Quick Ocean Merge\n")
cat("========================================\n\n")

# Load existing polygon data
cat("[1/5] Loading existing polygon data...\n")
json_data <- fromJSON("../../ui/public/country_polygons.json")
cat(sprintf("  Loaded %d polygons\n", nrow(json_data)))

# Create sf object from JSON
cat("[2/5] Converting to spatial format...\n")
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

cat(sprintf("  Original: Political=%d, Continent=%d, IHO=%d\n",
            sum(polygons_sf$type == "Political"),
            sum(polygons_sf$type == "Continent"),
            sum(polygons_sf$type == "IHO")))

# Merge IHO polygons
cat("[3/5] Merging 23 IHO polygons into single Ocean...\n")
iho_polygons <- polygons_sf %>% filter(type == "IHO")
non_iho_polygons <- polygons_sf %>% filter(type != "IHO")

# Turn off S2 for union operation
s2_was_enabled <- sf_use_s2()
sf_use_s2(FALSE)

# Union with geometry fix
ocean_geometry <- iho_polygons %>%
  mutate(geometry = st_buffer(geometry, 0)) %>%
  pull(geometry) %>%
  st_union()

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
cat(sprintf("  Result: Political=%d, Continent=%d, Ocean=%d\n",
            sum(result$type == "Political"),
            sum(result$type == "Continent"),
            sum(result$type == "IHO")))

# Convert to JSON  
cat("[4/5] Converting to JSON...\n")
export_data <- list()
for (i in seq_len(nrow(result))) {
  row <- result[i, ]
  geom <- row$geometry
  wkt <- st_as_text(geom)
  coords <- st_coordinates(geom)
  vertex_count <- nrow(coords)
  
  export_data[[i]] <- list(
    identifier = as.character(row$identifier),
    type = as.character(row$type),
    name = as.character(row$name),
    wkt = wkt,
    vertexCount = vertex_count,
    iso2 = as.character(row$iso2_code)
  )
}

# Save output
cat("[5/5] Saving output files...\n")
json_str <- toJSON(export_data, pretty = TRUE, auto_unbox = TRUE)

# Save to both locations
output_file <- "output/country_polygons.json"
frontend_file <- "../../ui/public/country_polygons.json"

dir.create("output", showWarnings = FALSE, recursive = TRUE)
writeLines(json_str, output_file)
cat(sprintf("  ✓ Saved to: %s\n", output_file))

frontend_dir <- dirname(frontend_file)
dir.create(frontend_dir, showWarnings = FALSE, recursive = TRUE)
writeLines(json_str, frontend_file)
cat(sprintf("  ✓ Copied to frontend: %s\n", frontend_file))

# Summary
file_size_mb <- file.size(frontend_file) / (1024 * 1024)
total_vertices <- sum(sapply(export_data, function(x) x$vertexCount))

cat("\n========================================\n")
cat("Summary\n")
cat("========================================\n")
cat(sprintf("Total boundaries: %d\n", length(export_data)))
cat(sprintf("  Political: %d\n", sum(sapply(export_data, function(x) x$type == "Political"))))
cat(sprintf("  Continent: %d\n", sum(sapply(export_data, function(x) x$type == "Continent"))))
cat(sprintf("  Ocean: %d\n", sum(sapply(export_data, function(x) x$type == "IHO"))))
cat(sprintf("Total vertices: %d\n", total_vertices))
cat(sprintf("File size: %.2f MB\n", file_size_mb))
cat("========================================\n")
