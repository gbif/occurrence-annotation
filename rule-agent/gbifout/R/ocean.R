ocean_polygon_path <- function() {
  system.file("extdata", "ocean_polygon.json", package = "gbifout")
}

read_ocean_polygon <- function(oceanPath) {
  if (!file.exists(oceanPath)) {
    stop("Ocean polygon file does not exist: ", oceanPath)
  }
  ocean_json <- jsonlite::fromJSON(oceanPath)
  ocean_wkt <- ocean_json$wkt[ocean_json$identifier == "OCEAN"][1]
  if (is.na(ocean_wkt) || !nzchar(ocean_wkt)) {
    stop("Ocean polygon JSON has no OCEAN WKT: ", oceanPath)
  }
  terra::vect(sf::st_as_sfc(ocean_wkt, crs = 4326))
}

clip_wkt_to_land <- function(wkts, oceanPath) {
  ocean <- read_ocean_polygon(oceanPath)
  world <- terra::vect(sf::st_as_sfc(
    "POLYGON((-180 -90, 180 -90, 180 90, -180 90, -180 -90))", crs = 4326
  ))
  land <- terra::erase(world, ocean)
  clipped <- lapply(wkts, function(wkt) {
    tryCatch({
      cell <- terra::vect(sf::st_as_sfc(wkt, crs = 4326))
      intersection <- terra::intersect(cell, land)
      if (is.null(intersection) || nrow(intersection) == 0) return(NA_character_)
      simplified <- sf::st_simplify(
        sf::st_as_sf(intersection), dTolerance = 0.05, preserveTopology = TRUE
      )
      result <- sf::st_as_text(simplified$geometry)[1]
      if (is.na(result) || !nzchar(result)) NA_character_ else result
    }, error = function(e) NA_character_)
  })
  unlist(clipped)
}
