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
  
  # Records with missing coordinates should be filtered out during processing
  # but the original number of rows might change - check that function doesn't error
  expect_true("annotations" %in% colnames(annotated))
  
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
