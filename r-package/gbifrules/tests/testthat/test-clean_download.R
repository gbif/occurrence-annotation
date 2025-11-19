library(testthat)
library(dplyr)
library(sf)

# Mock data for testing
create_mock_occurrence_data <- function() {
  data.frame(
    taxonKey = c(0, 0, 0, 8, 8),
    decimalLongitude = c(0, 0, 0, 0, 0),
    decimalLatitude = c(0, 0, 0, 0, 0),
    scientificName = c("Species A", "Species A", "Species B", "Species B", "Species C"),
    stringsAsFactors = FALSE
  )
}

httptest2::with_mock_dir("fixtures/clean_download", {
  
  # Store rule IDs for cleanup
  created_rule_ids <- c()
  
  test_that("clean_download handles actual rules with existing geometries", {
    
    # Create actual rules with existing geometries and taxonKey = 0
    # Normal polygon rule
    # normal_geometry <- "POLYGON ((-116.71875 30.624500755313708, -116.71875 25.554080303743348, -116.71875 20.483659852172988, -116.71875 15.413239400602627, -116.71875 10.342818949032267, -108.45703125 10.342818949032267, -100.1953125 10.342818949032267, -91.93359375 10.342818949032267, -83.671875 10.342818949032267, -83.671875 15.413239400602627, -83.671875 20.483659852172988, -83.671875 25.554080303743348, -83.671875 30.624500755313708, -91.93359375 30.624500755313708, -100.1953125 30.624500755313708, -108.45703125 30.624500755313708, -116.71875 30.624500755313708))"
    normal_geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
    normal_rule_response <- make_rule(
      taxonKey = 0,
      geometry = normal_geometry,
      annotation = "SUSPICIOUS"
    )
    
    mock_data <- create_mock_occurrence_data()
    print(mock_data)
    result <- clean_download(mock_data)
    print(result)
    # Extract rule ID for cleanup
    # if (!is.null(normal_rule_response$id)) {
      # created_rule_ids <<- c(created_rule_ids, normal_rule_response$id)
    # }
    
    # Inverted polygon rule (global with hole)
    # inverted_geometry <- "POLYGON ((-180 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, -180 85.0511287798, -180 -85.0511287798), (-116.71875 30.624500755313708, -116.71875 25.554080303743348, -116.71875 20.483659852172988, -116.71875 15.413239400602627, -116.71875 10.342818949032267, -108.45703125 10.342818949032267, -100.1953125 10.342818949032267, -91.93359375 10.342818949032267, -83.671875 10.342818949032267, -83.671875 15.413239400602627, -83.671875 20.483659852172988, -83.671875 25.554080303743348, -83.671875 30.624500755313708, -91.93359375 30.624500755313708, -100.1953125 30.624500755313708, -108.45703125 30.624500755313708, -116.71875 30.624500755313708))"
    inverted_geometry <- "POLYGON ((-180 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, -180 85.0511287798, -180 -85.0511287798), (-12.3046875 11.723041818049527, -12.3046875 6.134097132761074, -12.3046875 0.5451524474726206, -12.3046875 -5.043792237815833, -12.3046875 -10.632736923104286, -5.44921875 -10.632736923104286, 1.40625 -10.632736923104286, 8.26171875 -10.632736923104286, 15.1171875 -10.632736923104286, 15.1171875 -5.043792237815833, 15.1171875 0.5451524474726206, 15.1171875 6.134097132761074, 15.1171875 11.723041818049527, 8.26171875 11.723041818049527, 1.40625 11.723041818049527, -5.44921875 11.723041818049527, -12.3046875 11.723041818049527))"
    inverted_rule_response <- make_rule(
      taxonKey = 8,
      geometry = inverted_geometry,
      annotation = "SUSPICIOUS"
    )
    
    # Extract rule ID for cleanup
    # if (!is.null(inverted_rule_response$id)) {
      # created_rule_ids <<- c(created_rule_ids, inverted_rule_response$id)
    # }
    
    # Create test data
    # mock_data <- create_mock_occurrence_data()
    
    # Test direct tibble input with normal rule
    # result_normal <- clean_download(mock_data, normal_rule_response)
    # expect_s3_class(result_normal, "data.frame")
    
    # Test list input with both rules
    # result_both <- clean_download(mock_data, list(normal_rule_response, inverted_rule_response))
    # expect_s3_class(result_both, "data.frame")
    
    # Should have created rules successfully
    # expect_true(!is.null(normal_rule_response$id))
    # expect_true(!is.null(inverted_rule_response$id))
  })

  # Cleanup: Delete created rules
  # test_that("cleanup created rules", {
    # for (rule_id in created_rule_ids) {
      # tryCatch({
        # delete_rule(rule_id)
      # }, error = function(e) {
        # Rule may already be deleted or not exist
        # message("Could not delete rule ", rule_id, ": ", e$message)
      # })
    # }
    
    # Reset the vector
    # created_rule_ids <<- c()
    
    # expect_true(TRUE) # Always pass cleanup test
  # })
})

# test_that("clean_download handles missing coordinates", {
#   mock_data <- create_mock_occurrence_data()
#   mock_data$decimalLongitude[1] <- NA
#   mock_data$decimalLatitude[2] <- NA
  
#   mockery::stub(clean_download, "get_rule", tibble::tibble())
  
#   result <- clean_download(mock_data)
  
#   # Should filter out records with missing coordinates
#   expect_equal(nrow(result), 3)  # 2 records removed due to missing coordinates
# })

# test_that("clean_download filters suspicious records with normal polygon", {
#   mock_data <- create_mock_occurrence_data()
#   mock_rules <- create_mock_rules()
  
#   # Mock get_rule to return only the normal rule
#   mockery::stub(clean_download, "get_rule", mock_rules$normal_rule)
  
#   result <- clean_download(mock_data, rm_suspicious = TRUE)
  
#   # Should remove the record at (-100, 25) which is within the normal polygon
#   expect_s3_class(result, "ann_download")
#   expect_equal(nrow(result), 4)  # 1 record removed
#   expect_equal(attr(result, "n_records_removed"), 1)
#   expect_gt(attr(result, "n_records_removed_pct"), 0)
  
#   # Check that the correct record was removed
#   remaining_coords <- paste(result$decimalLongitude, result$decimalLatitude)
#   expect_false("-100 25" %in% remaining_coords)
# })

# test_that("clean_download handles inverted polygons correctly", {
#   mock_data <- create_mock_occurrence_data()
#   mock_rules <- create_mock_rules()
  
#   # Mock get_rule to return only the inverted rule
#   mockery::stub(clean_download, "get_rule", mock_rules$inverted_rule)
  
#   result <- clean_download(mock_data, rm_suspicious = TRUE)
  
#   # For inverted polygon: points outside the hole should be suspicious
#   # The hole is at (-30 to -10, 60 to 70)
#   # Point (-20, 65) should NOT be suspicious (it's in the hole)
#   # Other points should be suspicious
#   expect_s3_class(result, "ann_download")
  
#   # Check that the point in the hole was NOT removed
#   remaining_coords <- paste(result$decimalLongitude, result$decimalLatitude)
#   expect_true("-20 65" %in% remaining_coords)  # This point is in the hole
# })

# test_that("clean_download ignores deleted rules", {
#   mock_data <- create_mock_occurrence_data()
#   mock_rules <- create_mock_rules()
  
#   # Mock get_rule to return all rules including deleted ones
#   all_rules <- dplyr::bind_rows(
#     mock_rules$normal_rule,
#     mock_rules$deleted_rule
#   )
  
#   mockery::stub(clean_download, "get_rule", all_rules)
  
#   result <- clean_download(mock_data, rm_suspicious = TRUE)
  
#   # Should only apply non-deleted rules
#   expect_equal(nrow(result), 4)  # Only 1 record removed (by normal_rule)
# })

# test_that("clean_download ignores non-suspicious annotations", {
#   mock_data <- create_mock_occurrence_data()
#   mock_rules <- create_mock_rules()
  
#   # Mock get_rule to return rules with different annotations
#   mixed_rules <- dplyr::bind_rows(
#     mock_rules$normal_rule,
#     mock_rules$native_rule
#   )
  
#   mockery::stub(clean_download, "get_rule", mixed_rules)
  
#   result <- clean_download(mock_data, rm_suspicious = TRUE)
  
#   # Should only apply SUSPICIOUS rules, ignore NATIVE
#   expect_equal(nrow(result), 4)  # Only 1 record removed (by normal_rule)
# })

# test_that("clean_download with rm_suspicious = FALSE keeps suspicious records", {
#   mock_data <- create_mock_occurrence_data()
#   mock_rules <- create_mock_rules()
  
#   mockery::stub(clean_download, "get_rule", mock_rules$normal_rule)
  
#   result <- clean_download(mock_data, rm_suspicious = FALSE)
  
#   # Should keep all records
#   expect_equal(nrow(result), 5)
#   expect_equal(attr(result, "n_records_removed"), 0)
# })

# test_that("get_suspicious_annotations detects inverted polygons correctly", {
#   # Test the inverted polygon detection logic directly
#   mock_data <- data.frame(
#     decimalLongitude = c(-20, 150),
#     decimalLatitude = c(65, -30),
#     taxonKey = c(8577, 8577),
#     record_id = c("8577_65_-20", "8577_-30_150")
#   )
  
#   mock_rules <- create_mock_rules()
  
#   # Mock get_rule to return the inverted rule
#   mockery::stub(get_suspicious_annotations, "get_rule", mock_rules$inverted_rule)
  
#   result <- get_suspicious_annotations(mock_data)
  
#   expect_s3_class(result, "data.frame")
#   expect_true("is_suspicious" %in% names(result))
#   expect_true("has_conflict" %in% names(result))
  
#   # Point in hole (-20, 65) should NOT be suspicious
#   # Point outside hole (150, -30) should be suspicious
#   hole_record <- result[result$record_id == "8577_65_-20", ]
#   outside_record <- result[result$record_id == "8577_-30_150", ]
  
#   expect_false(hole_record$is_suspicious)
#   expect_true(outside_record$is_suspicious)
# })

# test_that("inverted polygon detection method works", {
#   # Test cases for different polygon types
#   test_cases <- list(
#     normal = "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))",
#     inverted = "POLYGON ((-180 -85, 180 -85, 180 85, -180 85, -180 -85), (-30 60, -10 60, -10 70, -30 70, -30 60))",
#     small_with_hole = "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0), (2 2, 8 2, 8 8, 2 8, 2 2))"
#   )
  
#   # Test normal polygon
#   geom_sf <- sf::st_as_sfc(test_cases$normal, crs = 4326)
#   coords <- sf::st_coordinates(geom_sf[[1]])
#   is_multi_ring <- "L2" %in% colnames(coords) && max(coords[,"L2"]) > 1
#   expect_false(is_multi_ring)
  
#   # Test inverted polygon
#   geom_sf <- sf::st_as_sfc(test_cases$inverted, crs = 4326)
#   coords <- sf::st_coordinates(geom_sf[[1]])
#   is_multi_ring <- "L2" %in% colnames(coords) && max(coords[,"L2"]) > 1
#   expect_true(is_multi_ring)
  
#   if (is_multi_ring) {
#     outer_ring <- coords[coords[,"L2"] == 1, c("X", "Y")]
#     x_range <- max(outer_ring[,"X"]) - min(outer_ring[,"X"])
#     y_range <- max(outer_ring[,"Y"]) - min(outer_ring[,"Y"])
#     is_inverted <- x_range > 300 && y_range > 150
#     expect_true(is_inverted)
#   }
  
#   # Test small polygon with hole (should not be considered inverted)
#   geom_sf <- sf::st_as_sfc(test_cases$small_with_hole, crs = 4326)
#   coords <- sf::st_coordinates(geom_sf[[1]])
#   is_multi_ring <- "L2" %in% colnames(coords) && max(coords[,"L2"]) > 1
#   expect_true(is_multi_ring)
  
#   if (is_multi_ring) {
#     outer_ring <- coords[coords[,"L2"] == 1, c("X", "Y")]
#     x_range <- max(outer_ring[,"X"]) - min(outer_ring[,"X"])
#     y_range <- max(outer_ring[,"Y"]) - min(outer_ring[,"Y"])
#     is_inverted <- x_range > 300 && y_range > 150
#     expect_false(is_inverted)  # Small polygon should not be inverted
#   }
# })

# test_that("print method works for ann_download", {
#   mock_data <- create_mock_occurrence_data()
#   mockery::stub(clean_download, "get_rule", tibble::tibble())
  
#   result <- clean_download(mock_data)
  
#   # Test that print method works without errors
#   expect_output(print(result), "Cleaning Summary")
#   expect_output(print(result), "Number of records in original download")
#   expect_output(print(result), "Number of suspicious records removed")
#   expect_output(print(result), "Percentage of records removed")
#   expect_output(print(result), "Number of records remaining")
# })

# test_that("clean_download handles empty dataset", {
#   empty_data <- data.frame(
#     taxonKey = integer(0),
#     decimalLongitude = numeric(0),
#     decimalLatitude = numeric(0)
#   )
  
#   mockery::stub(clean_download, "get_rule", tibble::tibble())
  
#   result <- clean_download(empty_data)
  
#   expect_s3_class(result, "ann_download")
#   expect_equal(nrow(result), 0)
#   expect_equal(attr(result, "n_records_org"), 0)
#   expect_equal(attr(result, "n_records_removed"), 0)
# })

# test_that("clean_download handles geometry parsing errors gracefully", {
#   mock_data <- create_mock_occurrence_data()
  
#   # Create a rule with invalid geometry
#   invalid_rule <- tibble::tibble(
#     id = 99,
#     taxonKey = 2431950,
#     datasetKey = NA,
#     geometry = "INVALID_WKT_GEOMETRY",
#     annotation = "SUSPICIOUS",
#     rulesetId = NA,
#     projectId = NA,
#     created = "2025-11-13T15:54:04.101+00:00",
#     createdBy = "test_user",
#     deleted = NA,
#     deletedBy = NA,
#     supportedBy = list(character(0)),
#     contestedBy = list(character(0))
#   )
  
#   mockery::stub(clean_download, "get_rule", invalid_rule)
  
#   # Should not error, but handle gracefully
#   expect_message(
#     result <- clean_download(mock_data),
#     "Geometry parsing failed"
#   )
  
#   expect_s3_class(result, "ann_download")
# })
