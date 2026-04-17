# Quick script to add country names to existing geocode cache
# This avoids re-geocoding all 21k points by doing one lookup per country

library(dplyr)
library(httr)
library(jsonlite)

GEOCODE_CACHE_FILE <- "cache/geocode_results.rds"
GBIF_GEOCODE_API <- "https://api.gbif.org/v1/geocode/reverse"
RATE_LIMIT_DELAY <- 0.05

message("Loading existing geocode cache...")
geocode_results <- readRDS(GEOCODE_CACHE_FILE)
message(sprintf("Loaded %d geocode results", nrow(geocode_results)))

# Check if country_name column already exists
if ("country_name" %in% names(geocode_results)) {
  message("Country names already present in cache. Checking for missing values...")
  missing_count <- sum(is.na(geocode_results$country_name) | geocode_results$country_name == "")
  if (missing_count == 0) {
    message("✓ All country names are populated!")
    quit(save = "no", status = 0)
  }
  message(sprintf("Found %d entries with missing names, will update...", missing_count))
} else {
  message("Adding country_name column...")
  geocode_results$country_name <- NA_character_
}

# Get unique countries
unique_countries <- unique(geocode_results$iso2_code)
message(sprintf("Found %d unique countries", length(unique_countries)))

# For each country, fetch name from geocode API
country_name_map <- list()

message("Fetching country names from GBIF geocode API...")
for (i in seq_along(unique_countries)) {
  iso2 <- unique_countries[i]
  
  # Find a sample point for this country
  sample_point <- geocode_results %>%
    filter(iso2_code == iso2) %>%
    slice(1)
  
  url <- sprintf("%s?lat=%f&lng=%f", GBIF_GEOCODE_API, sample_point$lat, sample_point$lon)
  
  tryCatch({
    response <- GET(url)
    
    if (status_code(response) == 200) {
      content_list <- content(response, as = "parsed")
      
      # Find Political type result with matching ISO2 code
      for (location in content_list) {
        if (!is.null(location$type) && location$type == "Political" && 
            !is.null(location$isoCountryCode2Digit) &&
            location$isoCountryCode2Digit == iso2) {
          
          country_name <- if (!is.null(location$title)) {
            as.character(location$title)
          } else {
            iso2
          }
          
          country_name_map[[iso2]] <- country_name
          message(sprintf("  %d/%d: %s = %s", i, length(unique_countries), iso2, country_name))
          break
        }
      }
    }
    
    # Fallback to ISO2 if not found
    if (is.null(country_name_map[[iso2]])) {
      country_name_map[[iso2]] <- iso2
      message(sprintf("  %d/%d: %s = %s (fallback)", i, length(unique_countries), iso2, iso2))
    }
    
  }, error = function(e) {
    country_name_map[[iso2]] <- iso2
    message(sprintf("  %d/%d: %s = %s (error)", i, length(unique_countries), iso2, iso2))
  })
  
  Sys.sleep(RATE_LIMIT_DELAY)
}

# Update all rows with country names
message("\nUpdating geocode cache with country names...")
for (iso2 in names(country_name_map)) {
  geocode_results$country_name[geocode_results$iso2_code == iso2] <- country_name_map[[iso2]]
}

# Save updated cache
message("Saving updated cache...")
saveRDS(geocode_results, GEOCODE_CACHE_FILE)

# Show summary
message("\n========================================")
message("Summary:")
message(sprintf("Updated %d countries with names", length(country_name_map)))
message(sprintf("Sample names:"))
head(unique(geocode_results[, c("iso2_code", "country_name")]), 10) %>% print()
message("========================================")
message("✓ Cache updated! Country names are now available for export.\n")
