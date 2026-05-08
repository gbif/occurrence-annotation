skip_on_cran()
skip_if_offline()

test_that("annotate_download adds annotations column without filtering records", {
  # Standard polygon geometry that contains (0,0)
  geometry1 <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Different polygon geometry that contains (0, 50)
  geometry2 <- "POLYGON ((-13.554682731628418 58.93608947097473, 13.164067268371582 58.93608947097473, 13.164067268371582 43.369472173882706, -13.554682731628418 43.369472173882706, -13.554682731628418 58.93608947097473))"
  
  # Create test rules with different annotation types - using high taxonKeys to avoid conflicts
  rule1 <- make_rule(
    taxonKey = 900001,
    annotation = "SUSPICIOUS",
    geometry = geometry1
  )
  
  rule2 <- make_rule(
    taxonKey = 900001,
    annotation = "NATIVE",
    geometry = geometry2
  )
  
  # Create mock download data
  test_download <- data.frame(
    taxonKey = c(900001, 900001, 900002),
    decimalLatitude = c(0, 50, 30),
    decimalLongitude = c(0, 0, 0),
    basisOfRecord = c("HUMAN_OBSERVATION", "PRESERVED_SPECIMEN", "HUMAN_OBSERVATION")
  )
  
  # Annotate the download
  annotated <- annotate_download(test_download)
  
  # Check that all records are present (no filtering)
  expect_equal(nrow(annotated), nrow(test_download))
  
  # Check that annotations column exists
  expect_true("annotations" %in% colnames(annotated))
  
  # Check that matching records have annotations
  expect_equal(annotated$annotations[1], "SUSPICIOUS")
  expect_equal(annotated$annotations[2], "NATIVE")
  
  # Check that non-matching record has NA
  expect_true(is.na(annotated$annotations[3]))
  
  # Clean up
  delete_rule(rule1$id)
  delete_rule(rule2$id)
})

test_that("annotate_download combines multiple annotations with semicolons", {
  # Standard polygon geometry that contains (0,0)
  geometry_large <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Smaller polygon that also contains (0,0)
  geometry_small <- "POLYGON ((-5 5, 5 5, 5 -5, -5 -5, -5 5))"
  
  # Create multiple rules that will match the same record - using high taxonKey
  rule1 <- make_rule(
    taxonKey = 900010,
    annotation = "SUSPICIOUS",
    geometry = geometry_large
  )
  
  rule2 <- make_rule(
    taxonKey = 900010,
    annotation = "INTRODUCED",
    geometry = geometry_large
  )
  
  rule3 <- make_rule(
    taxonKey = 900010,
    annotation = "NATIVE",
    geometry = geometry_small
  )
  
  # Create test download with point that matches all three rules
  test_download <- data.frame(
    taxonKey = 900010,
    decimalLatitude = 0,
    decimalLongitude = 0
  )
  
  annotated <- annotate_download(test_download)
  
  # Check that all three annotations are present, semicolon-delimited
  annotations <- strsplit(annotated$annotations[1], ";")[[1]]
  expect_equal(length(annotations), 3)
  expect_true(all(c("SUSPICIOUS", "INTRODUCED", "NATIVE") %in% annotations))
  
  # Clean up
  delete_rule(rule1$id)
  delete_rule(rule2$id)
  delete_rule(rule3$id)
})

test_that("annotate_download filters by single project_id", {
  # Standard polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create a project
  project <- make_project(
    name = "Test Project for Annotations",
    description = "Testing project filtering"
  )
  
  # Create rules - one in project, one not - using high taxonKeys
  rule_in_project <- make_rule(
    taxonKey = 900020,
    annotation = "NATIVE",
    geometry = geometry,
    projectId = project$id
  )
  
  rule_not_in_project <- make_rule(
    taxonKey = 900020,
    annotation = "INTRODUCED",
    geometry = geometry
  )
  
  # Create test download
  test_download <- data.frame(
    taxonKey = 900020,
    decimalLatitude = 0,
    decimalLongitude = 0
  )
  
  # Annotate with project filter
  annotated <- annotate_download(test_download, project_id = project$id)
  
  # Should only get the NATIVE annotation from the project rule
  expect_equal(annotated$annotations[1], "NATIVE")
  expect_false(grepl("INTRODUCED", annotated$annotations[1]))
  
  # Clean up
  delete_rule(rule_in_project$id)
  delete_rule(rule_not_in_project$id)
  delete_project(project$id)
})

test_that("annotate_download filters by multiple project_ids", {
  # Standard polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create two projects
  project1 <- make_project(
    name = "Test Project 1",
    description = "First test project"
  )
  
  project2 <- make_project(
    name = "Test Project 2",
    description = "Second test project"
  )
  
  # Create rules in different projects - using high taxonKeys
  rule_project1 <- make_rule(
    taxonKey = 900030,
    annotation = "NATIVE",
    geometry = geometry,
    projectId = project1$id
  )
  
  rule_project2 <- make_rule(
    taxonKey = 900030,
    annotation = "INTRODUCED",
    geometry = geometry,
    projectId = project2$id
  )
  
  rule_no_project <- make_rule(
    taxonKey = 900030,
    annotation = "SUSPICIOUS",
    geometry = geometry
  )
  
  # Create test download
  test_download <- data.frame(
    taxonKey = 900030,
    decimalLatitude = 0,
    decimalLongitude = 0
  )
  
  # Annotate with multiple project filter
  annotated <- annotate_download(test_download, project_id = c(project1$id, project2$id))
  
  # Should get both NATIVE and INTRODUCED, but not SUSPICIOUS
  annotations <- strsplit(annotated$annotations[1], ";")[[1]]
  expect_equal(length(annotations), 2)
  expect_true(all(c("NATIVE", "INTRODUCED") %in% annotations))
  expect_false("SUSPICIOUS" %in% annotations)
  
  # Clean up
  delete_rule(rule_project1$id)
  delete_rule(rule_project2$id)
  delete_rule(rule_no_project$id)
  delete_project(project1$id)
  delete_project(project2$id)
})

test_that("annotate_download handles custom project vocabulary annotations", {
  # Standard polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create project with custom vocabulary
  project <- make_project(
    name = "Custom Vocabulary Project",
    description = "Testing custom annotation terms"
  )
  
  # Add custom vocabulary term using update_project_vocab
  custom_vocab_added <- FALSE
  tryCatch({
    # Get current vocabulary
    current_vocab <- get_project_vocab(project$id)
    
    # Add INVASIVE term to the vocabulary
    new_vocab <- list(
      list(term = "INVASIVE", description = "Invasive species", color = "#f97316", locked = FALSE),
      list(term = "SUSPICIOUS", description = "Suspicious record", color = "#ef4444", locked = TRUE)
    )
    
    # Update project vocabulary
    update_project_vocab(project$id, new_vocab)
    custom_vocab_added <- TRUE
  }, error = function(e) {
    message("Could not add custom vocabulary: ", e$message)
  })
  
  # Only run this test if custom vocabulary was successfully added
  if (!custom_vocab_added) {
    skip("Custom vocabulary could not be added to project")
  }
  
  # Create rule with custom annotation - using high taxonKey
  rule_custom <- make_rule(
    taxonKey = 900040,
    annotation = "INVASIVE",
    geometry = geometry,
    projectId = project$id
  )
  
  # Create test download
  test_download <- data.frame(
    taxonKey = 900040,
    decimalLatitude = 0,
    decimalLongitude = 0
  )
  
  # Annotate the download
  annotated <- annotate_download(test_download, project_id = project$id)
  
  # Should get the custom INVASIVE annotation
  expect_equal(annotated$annotations[1], "INVASIVE")
  
  # Clean up
  delete_rule(rule_custom$id)
  delete_project(project$id)
})

test_that("annotate_download respects basisOfRecord filters", {
  # Standard polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create rule that only applies to HUMAN_OBSERVATION - using high taxonKey
  rule_basis <- make_rule(
    taxonKey = 900050,
    annotation = "SUSPICIOUS",
    geometry = geometry,
    basisOfRecord = "HUMAN_OBSERVATION"
  )
  
  # Create test download with different basisOfRecord values
  test_download <- data.frame(
    taxonKey = c(900050, 900050, 900050),
    decimalLatitude = c(0, 0, 0),
    decimalLongitude = c(0, 0, 0),
    basisOfRecord = c("HUMAN_OBSERVATION", "PRESERVED_SPECIMEN", "MACHINE_OBSERVATION")
  )
  
  annotated <- annotate_download(test_download)
  
  # Only the HUMAN_OBSERVATION record should be annotated
  expect_equal(annotated$annotations[1], "SUSPICIOUS")
  expect_true(is.na(annotated$annotations[2]))
  expect_true(is.na(annotated$annotations[3]))
  
  # Clean up
  delete_rule(rule_basis$id)
})

test_that("annotate_download handles negated basisOfRecord rules", {
  skip_on_cran()
  
  # Standard polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create test download with different basisOfRecord values
  test_download <- data.frame(
    taxonKey = c(-16, -16, -16, -16),
    decimalLatitude = c(0, 0, 0, 0),
    decimalLongitude = c(0, 0, 0, 0),
    basisOfRecord = c("HUMAN_OBSERVATION", "PRESERVED_SPECIMEN", "HUMAN_OBSERVATION", "MACHINE_OBSERVATION")
  )
  
  # Create a negated basisOfRecord rule: this should annotate all records
  # EXCEPT those with basisOfRecord == PRESERVED_SPECIMEN
  existing_rules <- get_rule(taxonKey = -16,
                             geometry = geometry,
                             annotation = "SUSPICIOUS",
                             basisOfRecord = "PRESERVED_SPECIMEN",
                             yearRange = "null",
                             datasetKey = "null",
                             basisOfRecordNegated = TRUE)
  
  if (nrow(existing_rules) == 0) {
    negated_rule <- make_rule(
      taxonKey = -16,
      geometry = geometry,
      annotation = "SUSPICIOUS",
      basisOfRecord = "PRESERVED_SPECIMEN",
      basisOfRecordNegated = TRUE
    )
    expect_type(negated_rule, "list")
  }
  
  annotated <- annotate_download(test_download)
  
  # All records EXCEPT PRESERVED_SPECIMEN should be annotated
  expect_equal(annotated$annotations[1], "SUSPICIOUS")  # HUMAN_OBSERVATION
  expect_true(is.na(annotated$annotations[2]))          # PRESERVED_SPECIMEN (not annotated)
  expect_equal(annotated$annotations[3], "SUSPICIOUS")  # HUMAN_OBSERVATION
  expect_equal(annotated$annotations[4], "SUSPICIOUS")  # MACHINE_OBSERVATION
})

test_that("annotate_download respects datasetKey filters", {
  # Standard polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create rule that only applies to specific dataset - using high taxonKey
  test_dataset_key <- "50c9509d-22c7-4a22-a47d-8c48425ef4a7"
  
  rule_dataset <- make_rule(
    taxonKey = 900060,
    annotation = "SUSPICIOUS",
    geometry = geometry,
    datasetKey = test_dataset_key
  )
  
  # Create test download with different datasetKey values
  test_download <- data.frame(
    taxonKey = c(900060, 900060),
    decimalLatitude = c(0, 0),
    decimalLongitude = c(0, 0),
    datasetKey = c(test_dataset_key, "other-dataset-key-12345")
  )
  
  annotated <- annotate_download(test_download)
  
  # Only the matching dataset record should be annotated
  expect_equal(annotated$annotations[1], "SUSPICIOUS")
  expect_true(is.na(annotated$annotations[2]))
  
  # Clean up
  delete_rule(rule_dataset$id)
})

test_that("annotate_download handles records with no coordinates gracefully", {
  # Standard polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create rule - using high taxonKey
  rule <- make_rule(
    taxonKey = 900070,
    annotation = "NATIVE",
    geometry = geometry
  )
  
  # Create test download with some records missing coordinates
  test_download <- data.frame(
    taxonKey = c(900070, 900070, 900070),
    decimalLatitude = c(0, NA, 50),
    decimalLongitude = c(0, 0, NA)
  )
  
  annotated <- annotate_download(test_download)
  
  # Records with missing coordinates should be preserved in output
  expect_equal(nrow(annotated), nrow(test_download))
  expect_true("annotations" %in% colnames(annotated))
  
  # Record with valid coordinates inside polygon should be annotated
  expect_equal(annotated$annotations[1], "NATIVE")  # (0,0) inside polygon
  
  # Records with missing coordinates should have NA annotations
  expect_true(is.na(annotated$annotations[2]))  # NA latitude
  expect_true(is.na(annotated$annotations[3]))  # NA longitude
  
  # Clean up
  delete_rule(rule$id)
})

test_that("annotate_download returns all annotation types", {
  # Standard polygon geometry that contains (0,0)
  geometry1 <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Polygon geometry that contains (0, 50)
  geometry2 <- "POLYGON ((-13.554682731628418 58.93608947097473, 13.164067268371582 58.93608947097473, 13.164067268371582 43.369472173882706, -13.554682731628418 43.369472173882706, -13.554682731628418 58.93608947097473))"
  
  # Polygon geometry that contains (50, 0)
  geometry3 <- "POLYGON ((45 5, 55 5, 55 -5, 45 -5, 45 5))"
  
  # Create rules with various standard annotation types - using high taxonKeys
  rule_suspicious <- make_rule(
    taxonKey = 900080,
    annotation = "SUSPICIOUS",
    geometry = geometry1
  )
  
  rule_native <- make_rule(
    taxonKey = 900081,
    annotation = "NATIVE",
    geometry = geometry2
  )
  
  rule_introduced <- make_rule(
    taxonKey = 900082,
    annotation = "INTRODUCED",
    geometry = geometry3
  )
  
  # Create test download
  test_download <- data.frame(
    taxonKey = c(900080, 900081, 900082),
    decimalLatitude = c(0, 50, 0),
    decimalLongitude = c(0, 0, 50)
  )
  
  annotated <- annotate_download(test_download)
  
  # Check all annotation types are preserved
  expect_equal(annotated$annotations[1], "SUSPICIOUS")
  expect_equal(annotated$annotations[2], "NATIVE")
  expect_equal(annotated$annotations[3], "INTRODUCED")
  
  # Clean up
  delete_rule(rule_suspicious$id)
  delete_rule(rule_native$id)
  delete_rule(rule_introduced$id)
})

test_that("annotate_download preserves all original columns", {
  # Standard polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create rule - using high taxonKey
  rule <- make_rule(
    taxonKey = 900090,
    annotation = "NATIVE",
    geometry = geometry
  )
  
  # Create test download with various columns
  test_download <- data.frame(
    taxonKey = 900090,
    decimalLatitude = 0,
    decimalLongitude = 0,
    scientificName = "Test species",
    basisOfRecord = "HUMAN_OBSERVATION",
    year = 2024,
    country = "US"
  )
  
  annotated <- annotate_download(test_download)
  
  # Check that all original columns are preserved
  expect_true(all(c("taxonKey", "decimalLatitude", "decimalLongitude", 
                     "scientificName", "basisOfRecord", "year", "country") %in% colnames(annotated)))
  
  # Check that annotations column was added
  expect_true("annotations" %in% colnames(annotated))
  
  # Check that temporary columns are not present
  expect_false("record_id" %in% colnames(annotated))
  expect_false("lon" %in% colnames(annotated))
  expect_false("lat" %in% colnames(annotated))
  
  # Clean up
  delete_rule(rule$id)
})

test_that("annotate_download handles inverted geometries correctly", {
  # Inverted polygon: global extent with a hole around (0,0)
  # Points inside the hole should NOT be annotated
  # Points in the solid area (outside the hole) should be annotated
  inverted_geometry <- "POLYGON ((-180 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, -180 85.0511287798, -180 -85.0511287798), (-12.3046875 11.723041818049527, -12.3046875 6.134097132761074, -12.3046875 0.5451524474726206, -12.3046875 -5.043792237815833, -12.3046875 -10.632736923104286, -5.44921875 -10.632736923104286, 1.40625 -10.632736923104286, 8.26171875 -10.632736923104286, 15.1171875 -10.632736923104286, 15.1171875 -5.043792237815833, 15.1171875 0.5451524474726206, 15.1171875 6.134097132761074, 15.1171875 11.723041818049527, 8.26171875 11.723041818049527, 1.40625 11.723041818049527, -5.44921875 11.723041818049527, -12.3046875 11.723041818049527))"
  
  # Create rule with inverted geometry - using high taxonKey
  rule_inverted <- make_rule(
    taxonKey = 900100,
    annotation = "INTRODUCED",
    geometry = inverted_geometry
  )
  
  # Create test download with points in different locations
  # Points at (0,0) are inside the hole - should NOT be annotated
  # Points at (0,50) are in the solid area - should be annotated
  # Points at (100,0) are in the solid area - should be annotated
  test_download <- data.frame(
    taxonKey = c(900100, 900100, 900100, 900100, 900100),
    decimalLatitude = c(0, 0, 0, 50, 0),
    decimalLongitude = c(0, 0, 0, 0, 100)
  )
  
  annotated <- annotate_download(test_download)
  
  # All records should be preserved (no filtering)
  expect_equal(nrow(annotated), nrow(test_download))
  
  # Points inside the hole (first three records at 0,0) should NOT be annotated
  expect_true(is.na(annotated$annotations[1]))
  expect_true(is.na(annotated$annotations[2]))
  expect_true(is.na(annotated$annotations[3]))
  
  # Points in the solid area should be annotated
  expect_equal(annotated$annotations[4], "INTRODUCED")  # (0,50) - in solid area
  expect_equal(annotated$annotations[5], "INTRODUCED")  # (100,0) - in solid area
  
  # Clean up
  delete_rule(rule_inverted$id)
})

test_that("annotate_download adds annotations using higher taxonomy", {
  skip_on_cran()
  skip_if_offline()
  
  # Standard polygon geometry containing (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create rule for taxonKey -12 (fake class level)
  existing_rule <- get_rule(taxonKey = -12, geometry = geometry, annotation = "SUSPICIOUS")
  
  if (nrow(existing_rule) == 0) {
    rule_class <- make_rule(
      taxonKey = -12,
      geometry = geometry,
      annotation = "SUSPICIOUS"
    )
    expect_type(rule_class, "list")
  }
  
  # Create download with species records that have classKey = -12
  # Using taxonKey -13 as the species-level key
  test_download <- data.frame(
    taxonKey = c(-13, -13, -13),
    classKey = c(-12, -12, -12),  # Class level matches rule taxonKey
    decimalLongitude = c(0, 0, 50),
    decimalLatitude = c(0, 50, 0)
  )
  
  # Test with use_higher_taxonomy = TRUE
  # Records at (0,0) should get SUSPICIOUS annotation (inside polygon, match via classKey)
  annotated_with_higher <- annotate_download(test_download, use_higher_taxonomy = TRUE)
  expect_true("annotations" %in% colnames(annotated_with_higher))
  expect_equal(nrow(annotated_with_higher), 3)
  expect_equal(annotated_with_higher$annotations[1], "SUSPICIOUS")  # (0,0) inside polygon
  expect_true(is.na(annotated_with_higher$annotations[2]))  # (0,50) outside polygon
  expect_true(is.na(annotated_with_higher$annotations[3]))  # (50,0) outside polygon
  
  # Test with use_higher_taxonomy = FALSE (default)
  # No annotations because rule taxonKey -12 doesn't match species taxonKey -13
  annotated_without_higher <- annotate_download(test_download, use_higher_taxonomy = FALSE)
  expect_true("annotations" %in% colnames(annotated_without_higher))
  expect_equal(nrow(annotated_without_higher), 3)
  expect_true(all(is.na(annotated_without_higher$annotations)))  # No matches
})

test_that("annotate_download respects use_higher_taxonomy = FALSE default", {
  skip_on_cran()
  skip_if_offline()
  
  # Standard polygon geometry containing (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create rule for taxonKey -14 (fake class level)
  existing_rule <- get_rule(taxonKey = -14, geometry = geometry, annotation = "SUSPICIOUS")
  
  if (nrow(existing_rule) == 0) {
    rule_class <- make_rule(
      taxonKey = -14,
      geometry = geometry,
      annotation = "SUSPICIOUS"
    )
    expect_type(rule_class, "list")
  }
  
  # Create download with species records but including classKey
  test_download <- data.frame(
    taxonKey = c(-15, -15),
    classKey = c(-14, -14),
    decimalLongitude = c(0, 50),
    decimalLatitude = c(0, 0)
  )
  
  # Default behavior (use_higher_taxonomy = FALSE) - no parameter specified
  annotated_default <- annotate_download(test_download)
  expect_true("annotations" %in% colnames(annotated_default))
  expect_equal(nrow(annotated_default), 2)
  # Should NOT match via classKey when use_higher_taxonomy is not enabled
  expect_true(all(is.na(annotated_default$annotations)))
  
  # Explicitly set to FALSE - same result
  annotated_explicit_false <- annotate_download(test_download, use_higher_taxonomy = FALSE)
  expect_true("annotations" %in% colnames(annotated_explicit_false))
  expect_true(all(is.na(annotated_explicit_false$annotations)))
  
  # With TRUE - should match
  annotated_explicit_true <- annotate_download(test_download, use_higher_taxonomy = TRUE)
  expect_equal(annotated_explicit_true$annotations[1], "SUSPICIOUS")  # (0,0) matches
  expect_true(is.na(annotated_explicit_true$annotations[2]))  # (50,0) outside
})

# Vote-based filtering tests

test_that("annotate_download includes vote counts when requested", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a test rule with support and contest from same user is not possible
  # Create two rules - one with support, one with contest
  rule_supported <- make_rule(
    taxonKey = -1100,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  # Add 1 support to the rule (API only allows 1 support per user)
  support_rule(rule_supported$id)
  Sys.sleep(1)
  
  # Create download data
  d <- data.frame(
    taxonKey = c(-1100, -1100, -1100),
    decimalLongitude = c(20, 25, 5),  # 2 inside, 1 outside
    decimalLatitude = c(45, 42, 45),
    basisOfRecord = rep("HUMAN_OBSERVATION", 3)
  )
  
  # Without include_vote_counts
  result_no_counts <- annotate_download(d)
  expect_false("support_count" %in% colnames(result_no_counts))
  expect_false("contest_count" %in% colnames(result_no_counts))
  
  # With include_vote_counts = TRUE
  result_with_counts <- annotate_download(d, include_vote_counts = TRUE)
  expect_true("support_count" %in% colnames(result_with_counts))
  expect_true("contest_count" %in% colnames(result_with_counts))
  
  # Check vote counts for annotated records
  annotated_records <- result_with_counts[!is.na(result_with_counts$annotations), ]
  expect_equal(nrow(annotated_records), 2)  # 2 inside records
  expect_equal(unique(annotated_records$support_count), 1)  # 1 support from test user
  expect_equal(unique(annotated_records$contest_count), 0)  # 0 contests
  
  # Check vote counts for non-annotated record
  non_annotated <- result_with_counts[is.na(result_with_counts$annotations), ]
  expect_equal(nrow(non_annotated), 1)
  expect_true(is.na(non_annotated$support_count))
  expect_true(is.na(non_annotated$contest_count))
  
  # Cleanup
  delete_rule(rule_supported$id)
})

test_that("annotate_download filters rules by minimum support", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a rule with 1 support (using fake taxonKey -1101)
  rule <- make_rule(
    taxonKey = -1101,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  # Add 1 support
  support_rule(rule$id)
  Sys.sleep(1)
  
  # Create download data
  d <- data.frame(
    taxonKey = c(-1101, -1101),
    decimalLongitude = c(20, 5),
    decimalLatitude = c(45, 45),
    basisOfRecord = rep("HUMAN_OBSERVATION", 2)
  )
  
  # Without min_support, rule should apply
  result_no_filter <- annotate_download(d)
  expect_equal(sum(!is.na(result_no_filter$annotations)), 1)  # 1 inside record annotated
  
  # With min_support = 1, rule should still apply
  result_min_1 <- annotate_download(d, min_support = 1)
  expect_equal(sum(!is.na(result_min_1$annotations)), 1)
  
  # With min_support = 2, rule should be filtered out (only 1 support)
  result_min_2 <- suppressWarnings(annotate_download(d, min_support = 2))
  expect_equal(sum(!is.na(result_min_2$annotations)), 0)  # No annotations
  
  # Cleanup
  delete_rule(rule$id)
})

test_that("annotate_download excludes contested rules", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a rule with contests (using fake taxonKey -1102)
  rule <- make_rule(
    taxonKey = -1102,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  contest_rule(rule$id)
  Sys.sleep(1)
  
  # Create download data
  d <- data.frame(
    taxonKey = c(-1102, -1102),
    decimalLongitude = c(20, 5),
    decimalLatitude = c(45, 45),
    basisOfRecord = rep("HUMAN_OBSERVATION", 2)
  )
  
  # Without exclude_contested, rule should apply
  result_no_filter <- annotate_download(d)
  expect_equal(sum(!is.na(result_no_filter$annotations)), 1)
  
  # With exclude_contested = TRUE, rule should be filtered out
  result_exclude <- suppressWarnings(annotate_download(d, exclude_contested = TRUE))
  expect_equal(sum(!is.na(result_exclude$annotations)), 0)
  
  # Cleanup
  delete_rule(rule$id)
})

test_that("annotate_download shows vote counts for most-supported rule when multiple match", {
  skip_if_offline()
  skip_on_cran()
  
  # Create two overlapping rules for the same taxonKey
  # One with support, one without
  rule1 <- make_rule(
    taxonKey = -1103,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  rule2 <- make_rule(
    taxonKey = -1103,
    geometry = "POLYGON((15 38, 35 38, 35 52, 15 52, 15 38))",  # Overlapping
    annotation = "NATIVE"
  )
  
  # Rule1: Add 1 support
  support_rule(rule1$id)
  Sys.sleep(1)
  
  # Rule2: No votes (0 supports, 0 contests)
  
  # Create download data with a point inside both polygons
  d <- data.frame(
    taxonKey = -1103,
    decimalLongitude = 20,
    decimalLatitude = 45,
    basisOfRecord = "HUMAN_OBSERVATION"
  )
  
  # Get annotations with vote counts
  result <- annotate_download(d, include_vote_counts = TRUE)
  
  # Should have both annotations
  expect_true(grepl("SUSPICIOUS", result$annotations[1]))
  expect_true(grepl("NATIVE", result$annotations[1]))
  
  # Should show counts for most-supported rule (rule1 with 1 support)
  expect_equal(result$support_count[1], 1)
  expect_equal(result$contest_count[1], 0)
  
  # Cleanup
  delete_rule(rule1$id)
  delete_rule(rule2$id)
})

test_that("annotate_download combines vote filtering with higher taxonomy", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a rule at class level with support (using fake taxonKey -1104)
  rule <- make_rule(
    taxonKey = -1104,  # Class level
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  # Add 1 support
  support_rule(rule$id)
  Sys.sleep(1)
  
  # Create download data with species-level record
  d <- data.frame(
    taxonKey = -1105,  # Species level (different from rule)
    classKey = -1104,   # Matches rule at class level
    decimalLongitude = 20,
    decimalLatitude = 45,
    basisOfRecord = "HUMAN_OBSERVATION"
  )
  
  # Without higher taxonomy, no match
  result_no_higher <- annotate_download(d, min_support = 1)
  expect_true(is.na(result_no_higher$annotations[1]))
  
  # With higher taxonomy and min_support = 1, should match
  result_higher <- annotate_download(d, use_higher_taxonomy = TRUE, min_support = 1)
  expect_equal(result_higher$annotations[1], "SUSPICIOUS")
  
  # With higher taxonomy but min_support = 2, should not match (only 1 support)
  result_too_high <- suppressWarnings(annotate_download(d, use_higher_taxonomy = TRUE, min_support = 2))
  expect_true(is.na(result_too_high$annotations[1]))
  
  # Cleanup
  delete_rule(rule$id)
})

test_that("annotate_download handles NA supportedBy/contestedBy correctly", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a new rule with no votes (using fake taxonKey -1106)
  rule <- make_rule(
    taxonKey = -1106,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  # Don't add any votes
  Sys.sleep(1)
  
  # Create download data
  d <- data.frame(
    taxonKey = -1106,
    decimalLongitude = 20,
    decimalLatitude = 45,
    basisOfRecord = "HUMAN_OBSERVATION"
  )
  
  # Rule with 0 supports should be filtered out by min_support = 1
  result_min_1 <- suppressWarnings(annotate_download(d, min_support = 1))
  expect_true(is.na(result_min_1$annotations[1]))
  
  # Rule with 0 contests should pass exclude_contested
  result_exclude <- annotate_download(d, exclude_contested = TRUE)
  expect_equal(result_exclude$annotations[1], "SUSPICIOUS")
  
  # With include_vote_counts, should show 0 for both counts (not NA)
  result_counts <- annotate_download(d, exclude_contested = TRUE, include_vote_counts = TRUE)
  expect_equal(result_counts$support_count[1], 0)
  expect_equal(result_counts$contest_count[1], 0)
  
  # Cleanup
  delete_rule(rule$id)
})

test_that("annotate_download warns when all rules filtered by vote requirements", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a rule with only 1 support (using fake taxonKey -1107)
  rule <- make_rule(
    taxonKey = -1107,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  support_rule(rule$id)
  Sys.sleep(1)
  
  # Create download data
  d <- data.frame(
    taxonKey = -1107,
    decimalLongitude = 20,
    decimalLatitude = 45,
    basisOfRecord = "HUMAN_OBSERVATION"
  )
  
  # Expect warning when min_support filters out all rules
  expect_warning(
    annotate_download(d, min_support = 5),
    "All 1 rules were filtered out by vote requirements"
  )
  
  # Cleanup
  delete_rule(rule$id)
})

test_that("annotate_download preserves all records when filtering rules", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a contested rule (using fake taxonKey -1108)
  rule <- make_rule(
    taxonKey = -1108,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  contest_rule(rule$id)
  Sys.sleep(1)
  
  # Create download data
  d <- data.frame(
    taxonKey = c(-1108, -1108, -1108),
    decimalLongitude = c(20, 25, 5),
    decimalLatitude = c(45, 42, 45),
    basisOfRecord = rep("HUMAN_OBSERVATION", 3)
  )
  
  # With exclude_contested, rule is filtered but all records preserved
  result <- suppressWarnings(annotate_download(d, exclude_contested = TRUE))
  expect_equal(nrow(result), 3)  # All records present
  expect_equal(sum(!is.na(result$annotations)), 0)  # No annotations (rule filtered)
  
  # Cleanup
  delete_rule(rule$id)
})

# ==============================================================================
# Comprehensive yearRange filtering tests for annotations
# ==============================================================================

test_that("annotate_download handles yearRange '*,1799' (less than 1800)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1400, 6),
    decimalLongitude = c(0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1700, 1799, 1800, 1900, 2000, 1700),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "*,1799"
  rule <- make_rule(
    taxonKey = -1400,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "*,1799"
  )
  
  result <- annotate_download(d)
  
  # Filter to annotated records only
  annotated <- result[!is.na(result$annotations), ]
  
  # Should annotate only records with year <= 1799 that are inside polygon (1700, 1799)
  expect_equal(nrow(annotated), 2)
  expect_true(all(annotated$year <= 1799))
  expect_true(all(annotated$decimalLongitude == 0))
  expect_true(all(annotated$annotations == "SUSPICIOUS"))
  
  delete_rule(rule$id)
})

test_that("annotate_download handles yearRange '1901,*' (greater than 1900)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1401, 6),
    decimalLongitude = c(0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1800, 1900, 1901, 2000, 2100, 2050),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "1901,*"
  rule <- make_rule(
    taxonKey = -1401,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1901,*"
  )
  
  result <- annotate_download(d)
  
  # Filter to annotated records only
  annotated <- result[!is.na(result$annotations), ]
  
  # Should annotate only records with year > 1900 that are inside polygon (1901, 2000, 2100)
  expect_equal(nrow(annotated), 3)
  expect_true(all(annotated$year > 1900))
  expect_true(all(annotated$decimalLongitude == 0))
  expect_true(all(annotated$annotations == "SUSPICIOUS"))
  
  delete_rule(rule$id)
})

test_that("annotate_download handles yearRange '1900,2000' (closed range)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1402, 7),
    decimalLongitude = c(0, 0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0, 0),
    year = c(1800, 1899, 1900, 1950, 2000, 2001, 1950),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "1900,2000"
  rule <- make_rule(
    taxonKey = -1402,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1900,2000"
  )
  
  result <- annotate_download(d)
  
  # Filter to annotated records only
  annotated <- result[!is.na(result$annotations), ]
  
  # Should annotate only records with 1900 <= year <= 2000 that are inside polygon (1900, 1950, 2000)
  expect_equal(nrow(annotated), 3)
  annotated_years <- annotated$year
  expect_true(all(annotated_years >= 1900 & annotated_years <= 2000))
  expect_true(all(annotated$decimalLongitude == 0))
  
  delete_rule(rule$id)
})

test_that("annotate_download handles yearRange '*,1950' (open start)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1403, 6),
    decimalLongitude = c(0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1800, 1900, 1950, 1951, 2000, 1950),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "*,1950"
  rule <- make_rule(
    taxonKey = -1403,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "*,1950"
  )
  
  result <- annotate_download(d)
  
  # Filter to annotated records only
  annotated <- result[!is.na(result$annotations), ]
  
  # Should annotate only records with year <= 1950 that are inside polygon (1800, 1900, 1950)
  expect_equal(nrow(annotated), 3)
  expect_true(all(annotated$year <= 1950))
  expect_true(all(annotated$decimalLongitude == 0))
  
  delete_rule(rule$id)
})

test_that("annotate_download handles yearRange '1950,*' (open end)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1404, 6),
    decimalLongitude = c(0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1800, 1900, 1949, 1950, 2000, 1950),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "1950,*"
  rule <- make_rule(
    taxonKey = -1404,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1950,*"
  )
  
  result <- annotate_download(d)
  
  # Filter to annotated records only
  annotated <- result[!is.na(result$annotations), ]
  
  # Should annotate only records with year >= 1950 that are inside polygon (1950, 2000)
  expect_equal(nrow(annotated), 2)
  expect_true(all(annotated$year >= 1950))
  expect_true(all(annotated$decimalLongitude == 0))
  
  delete_rule(rule$id)
})

test_that("annotate_download handles missing year column gracefully", {
  skip_on_cran()
  
  # Test data WITHOUT year column
  d <- data.frame(
    taxonKey = rep(-1405, 4),
    decimalLongitude = c(0, 0, 10, 10),
    decimalLatitude = c(0, 0, 0, 0),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange (should be ignored since data has no year column)
  rule <- make_rule(
    taxonKey = -1405,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1900,2000"
  )
  
  result <- annotate_download(d)
  
  # All records should be present
  expect_equal(nrow(result), nrow(d))
  # All records inside polygon should be annotated (no year filtering since column missing)
  annotated <- result[!is.na(result$annotations), ]
  expect_equal(nrow(annotated), 2)
  expect_true(all(annotated$decimalLongitude == 0))
  expect_true(all(annotated$annotations == "SUSPICIOUS"))
  
  delete_rule(rule$id)
})

test_that("annotate_download handles NA year values correctly", {
  skip_on_cran()
  
  # Test data with NA year values
  d <- data.frame(
    taxonKey = rep(-1406, 6),
    decimalLongitude = c(0, 0, 0, 0, 10, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1900, 1950, 2000, NA, 1950, NA),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "1900,2000"
  rule <- make_rule(
    taxonKey = -1406,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1900,2000"
  )
  
  result <- annotate_download(d)
  
  # Filter to annotated records only
  annotated <- result[!is.na(result$annotations), ]
  
  # Should annotate only records with 1900 <= year <= 2000 (1900, 1950, 2000)
  # NA year values should NOT be annotated even if inside polygon
  expect_equal(nrow(annotated), 3)
  expect_true(all(!is.na(annotated$year)))
  expect_true(all(annotated$year >= 1900 & annotated$year <= 2000))
  
  delete_rule(rule$id)
})

test_that("annotate_download combines yearRange with basisOfRecord", {
  skip_on_cran()
  
  # Test data with multiple filter dimensions
  d <- data.frame(
    taxonKey = rep(-1407, 8),
    decimalLongitude = c(0, 0, 0, 0, 0, 0, 10, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0, 0, 0),
    year = c(1900, 1900, 1950, 1950, 2001, 2001, 1950, 1950),
    basisOfRecord = c("PRESERVED_SPECIMEN", "HUMAN_OBSERVATION", 
                     "PRESERVED_SPECIMEN", "HUMAN_OBSERVATION",
                     "PRESERVED_SPECIMEN", "HUMAN_OBSERVATION",
                     "PRESERVED_SPECIMEN", "HUMAN_OBSERVATION"),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with both yearRange and basisOfRecord
  rule <- make_rule(
    taxonKey = -1407,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1900,2000",
    basisOfRecord = "PRESERVED_SPECIMEN"
  )
  
  result <- annotate_download(d)
  
  # Filter to annotated records only
  annotated <- result[!is.na(result$annotations), ]
  
  # Should annotate only records that are:
  # - Inside polygon AND
  # - 1900 <= year <= 2000 AND
  # - basisOfRecord = "PRESERVED_SPECIMEN"
  # This annotates: (0,0) + 1900 + PRESERVED_SPECIMEN, (0,0) + 1950 + PRESERVED_SPECIMEN
  expect_equal(nrow(annotated), 2)
  expect_true(all(annotated$basisOfRecord == "PRESERVED_SPECIMEN"))
  expect_true(all(annotated$year >= 1900 & annotated$year <= 2000))
  expect_true(all(annotated$decimalLongitude == 0))
  expect_true(all(annotated$annotations == "SUSPICIOUS"))
  
  delete_rule(rule$id)
})

