# Integration tests for clean_download function
# These tests use more realistic data scenarios and test the complete workflow

test_that("integration test: clean_download with realistic inverted polygon", {
  skip_if_not_installed("mockery")
  
  # Create realistic GBIF occurrence data
  gbif_data <- data.frame(
    taxonKey = c(rep(2431950, 10), rep(8577, 8)),
    decimalLongitude = c(
      # Points for taxonKey 2431950 (some inside and outside North America hole)
      -100, -80, -75, -120, -90,   # North America region
      10, 50, 100, -150, -170,     # Other global locations
      # Points for taxonKey 8577 (some inside and outside Iceland hole)  
      -20, -15, -25, -18,          # Iceland region (hole)
      30, 45, -60, 120             # Other global locations
    ),
    decimalLatitude = c(
      # Points for taxonKey 2431950
      40, 45, 35, 50, 30,          # North America region  
      55, 60, -30, -45, 10,        # Other global locations
      # Points for taxonKey 8577
      64, 66, 63, 65,              # Iceland region (hole)
      50, -20, 40, -10             # Other global locations
    ),
    scientificName = c(
      rep("Ambystoma mexicanum", 10),
      rep("Calopteryx splendens", 8)
    ),
    year = rep(2020, 18),
    basisOfRecord = rep("HUMAN_OBSERVATION", 18),
    stringsAsFactors = FALSE
  )
  
  # Define realistic rules based on your example
  realistic_rules <- tibble::tibble(
    id = c(30, 32),
    taxonKey = c(2431950, 8577),
    datasetKey = c(NA, NA),
    geometry = c(
      # Inverted polygon for Ambystoma mexicanum (global except North America)
      "POLYGON ((-180 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, -180 85.0511287798, -180 -85.0511287798), (-129.375 39.25421643889693, -129.375 30.28222849662493, -129.375 21.31024055435293, -129.375 12.33825261208093, -129.375 3.3662646698089307, -115.751953125 3.3662646698089307, -102.12890625 3.3662646698089307, -88.505859375 3.3662646698089307, -74.8828125 3.3662646698089307, -74.8828125 12.33825261208093, -74.8828125 21.31024055435293, -74.8828125 30.28222849662493, -74.8828125 39.25421643889693, -88.505859375 39.25421643889693, -102.12890625 39.25421643889693, -115.751953125 39.25421643889693, -129.375 39.25421643889693))",
      # Inverted polygon for Calopteryx splendens (global except Iceland region)
      "POLYGON ((-180 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, -180 85.0511287798, -180 -85.0511287798), (-26.143974502576953 67.16643129022603, -10.124370615561247 67.16643129022603, -10.124370615561247 62.49817377795002, -26.143974502576953 62.49817377795002, -26.143974502576953 67.16643129022603))"
    ),
    annotation = c("SUSPICIOUS", "SUSPICIOUS"),
    basisOfRecord = c(NA, NA),
    basisOfRecordNegated = c(FALSE, FALSE),
    yearRange = c(NA, NA),
    rulesetId = c(NA, NA),
    projectId = c(NA, NA),
    supportedBy = list(character(0), character(0)),
    contestedBy = list(character(0), c("jwaller")),
    created = c("2025-11-13T12:40:26.922+00:00", "2025-11-13T12:55:29.358+00:00"),
    createdBy = c("jwaller", "jwaller"),
    deleted = c(NA, NA),
    deletedBy = c(NA, NA)
  )
  
  # Mock the get_rule function to return our realistic rules
  mockery::stub(clean_download, "get_rule", realistic_rules)
  
  # Test the cleaning process
  result <- clean_download(gbif_data, rm_suspicious = TRUE)
  
  # Verify basic properties
  expect_s3_class(result, "ann_download")
  expect_lt(nrow(result), nrow(gbif_data))  # Some records should be removed
  expect_equal(attr(result, "n_records_org"), 18)
  expect_gt(attr(result, "n_records_removed"), 0)
  
  # Test that points in holes are preserved
  # For Ambystoma mexicanum: points in North America hole should be kept
  ambystoma_points <- result[result$taxonKey == 2431950, ]
  north_america_lons <- ambystoma_points$decimalLongitude
  north_america_lats <- ambystoma_points$decimalLatitude
  
  # Should contain some North American points (in the hole)
  expect_true(any(north_america_lons >= -129 & north_america_lons <= -75 & 
                  north_america_lats >= 12 & north_america_lats <= 39))
  
  # For Calopteryx: points in Iceland hole should be kept  
  calopteryx_points <- result[result$taxonKey == 8577, ]
  iceland_lons <- calopteryx_points$decimalLongitude
  iceland_lats <- calopteryx_points$decimalLatitude
  
  # Should contain Iceland points (in the hole)
  expect_true(any(iceland_lons >= -26 & iceland_lons <= -10 & 
                  iceland_lats >= 62 & iceland_lats <= 67))
})

test_that("integration test: clean_download performance with large dataset", {
  skip_if_not_installed("mockery")
  skip_on_cran()  # Skip on CRAN due to time constraints
  
  # Create a larger dataset to test performance
  set.seed(123)
  n_records <- 1000
  
  large_dataset <- data.frame(
    taxonKey = sample(c(2431950, 8577, 1234567), n_records, replace = TRUE),
    decimalLongitude = runif(n_records, -180, 180),
    decimalLatitude = runif(n_records, -85, 85),
    scientificName = sample(c("Species A", "Species B", "Species C"), n_records, replace = TRUE),
    stringsAsFactors = FALSE
  )
  
  # Simple rule for testing
  simple_rule <- tibble::tibble(
    id = 1,
    taxonKey = 2431950,
    datasetKey = NA,
    geometry = "POLYGON ((-10 -10, 10 -10, 10 10, -10 10, -10 -10))",
    annotation = "SUSPICIOUS",
    rulesetId = NA,
    projectId = NA,
    created = "2025-11-13T15:54:04.101+00:00",
    createdBy = "test_user",
    deleted = NA,
    deletedBy = NA,
    supportedBy = list(character(0)),
    contestedBy = list(character(0))
  )
  
  mockery::stub(clean_download, "get_rule", simple_rule)
  
  # Test that the function completes in reasonable time
  start_time <- Sys.time()
  result <- clean_download(large_dataset)
  end_time <- Sys.time()
  
  expect_s3_class(result, "ann_download")
  expect_lt(as.numeric(end_time - start_time, units = "secs"), 30)  # Should complete within 30 seconds
})

test_that("integration test: multiple inverted polygons with conflicts", {
  skip_if_not_installed("mockery")
  
  # Create data with overlapping rules
  conflict_data <- data.frame(
    taxonKey = rep(2431950, 5),
    decimalLongitude = c(-100, -80, 10, 50, 150),
    decimalLatitude = c(40, 45, 55, 60, -30),
    scientificName = rep("Test species", 5),
    stringsAsFactors = FALSE
  )
  
  # Two overlapping inverted rules for the same taxon
  conflict_rules <- tibble::tibble(
    id = c(1, 2),
    taxonKey = c(2431950, 2431950),
    datasetKey = c(NA, NA),
    geometry = c(
      # First inverted polygon (global except North America)
      "POLYGON ((-180 -85, 180 -85, 180 85, -180 85, -180 -85), (-120 35, -80 35, -80 50, -120 50, -120 35))",
      # Second inverted polygon (global except Europe) 
      "POLYGON ((-180 -85, 180 -85, 180 85, -180 85, -180 -85), (0 50, 40 50, 40 65, 0 65, 0 50))"
    ),
    annotation = c("SUSPICIOUS", "SUSPICIOUS"),
    rulesetId = c(NA, NA),
    projectId = c(NA, NA),
    created = c("2025-11-13T12:40:26.922+00:00", "2025-11-13T12:41:26.922+00:00"),
    createdBy = c("user1", "user2"),
    deleted = c(NA, NA),
    deletedBy = c(NA, NA),
    supportedBy = list(character(0), character(0)),
    contestedBy = list(character(0), character(0))
  )
  
  mockery::stub(clean_download, "get_rule", conflict_rules)
  
  # Test conflict handling
  result <- clean_download(conflict_data, handle_conflicts = "favor_suspicious")
  
  expect_s3_class(result, "ann_download")
  
  # Points in holes should be kept, others should be removed
  remaining_coords <- paste(result$decimalLongitude, result$decimalLatitude)
  
  # North America hole: (-100, 40) and (-80, 45) should be kept
  expect_true("-100 40" %in% remaining_coords)
  expect_true("-80 45" %in% remaining_coords)
  
  # Europe hole: (10, 55) should be kept
  expect_true("10 55" %in% remaining_coords)
})

test_that("integration test: edge cases and boundary conditions", {
  skip_if_not_installed("mockery")
  
  # Test edge cases
  edge_cases <- data.frame(
    taxonKey = c(2431950, 2431950, 2431950, 2431950),
    decimalLongitude = c(-180, 180, 0, -0.0001),  # Boundary coordinates
    decimalLatitude = c(-85, 85, 0, 0.0001),
    scientificName = rep("Edge species", 4),
    stringsAsFactors = FALSE
  )
  
  # Global polygon without holes (everything suspicious)
  global_rule <- tibble::tibble(
    id = 1,
    taxonKey = 2431950,
    datasetKey = NA,
    geometry = "POLYGON ((-180 -85, 180 -85, 180 85, -180 85, -180 -85))",
    annotation = "SUSPICIOUS",
    rulesetId = NA,
    projectId = NA,
    created = "2025-11-13T15:54:04.101+00:00",
    createdBy = "test_user",
    deleted = NA,
    deletedBy = NA,
    supportedBy = list(character(0)),
    contestedBy = list(character(0))
  )
  
  mockery::stub(clean_download, "get_rule", global_rule)
  
  result <- clean_download(edge_cases, rm_suspicious = TRUE)
  
  # All points should be removed (global coverage, no holes)
  expect_equal(nrow(result), 0)
  expect_equal(attr(result, "n_records_removed"), 4)
  
  # Test with rm_suspicious = FALSE
  result_keep <- clean_download(edge_cases, rm_suspicious = FALSE)
  expect_equal(nrow(result_keep), 4)
  expect_equal(attr(result_keep, "n_records_removed"), 0)
})
