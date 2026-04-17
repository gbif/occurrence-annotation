# Quick test of export with country names
library(sf)
library(dplyr)
library(jsonlite)

sf::sf_use_s2(FALSE)

# Load the cache files from previous run
geocode_results <- readRDS("cache/geocode_results.rds")

# Create a simple lookup table
country_lookup <- geocode_results %>%
  select(iso2_code, country_name) %>%
  distinct() %>%
  arrange(iso2_code)

cat("Country lookup table:\n")
print(head(country_lookup, 10))

# Load existing JSON
json_data <- jsonlite::fromJSON("../../ui/public/country_polygons.json")

cat("\nUpdating", nrow(json_data), "countries with proper names...\n")

# Update names
for (i in 1:nrow(json_data)) {
  iso2 <- json_data$iso2[i]
  match <- country_lookup$country_name[country_lookup$iso2_code == iso2]
  
  if (length(match) > 0 && !is.na(match[1])) {
    json_data$name[i] <- as.character(match[1])
  }
}

# Write back
json_str <- toJSON(json_data, pretty = TRUE, auto_unbox = TRUE)
writeLines(json_str, "../../ui/public/country_polygons.json")

cat("\nSample results:\n")
print(head(json_data[, c("iso2", "name")], 15))

cat("\n✓ Country names updated successfully!\n")
