# Declare global variables to avoid R CMD check NOTEs
# These are column names used in dplyr/tidyverse operations
utils::globalVariables(c(
  "annotation",
  "basisOfRecord",
  "contest_count",
  "contestedBy",
  "decimalLatitude",
  "decimalLongitude",
  "deleted",
  "has_conflict",
  "id",
  "is_suspicious",
  "lat",
  "locked",
  "lon",
  "record_id",
  "rule_annotation",
  "rule_contest_count",
  "rule_support_count",
  "support_count",
  "supportedBy",
  "taxonKey"
))
