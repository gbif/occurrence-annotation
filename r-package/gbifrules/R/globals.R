# Declare global variables to avoid R CMD check NOTEs
# These are column names used in dplyr/tidyverse operations
utils::globalVariables(c(
  "annotation",
  "basisOfRecord",
  "decimalLatitude",
  "decimalLongitude",
  "deleted",
  "has_conflict",
  "id",
  "is_suspicious",
  "lat",
  "lon",
  "record_id",
  "taxonKey"
))
