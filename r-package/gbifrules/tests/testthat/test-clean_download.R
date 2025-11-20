library(testthat)
library(dplyr)
library(sf)

httptest2::with_mock_dir("fixtures/clean_download", {
    
  test_that("clean_download handles actual rules with existing geometries", {
    
    # Test inverted polygon only to isolate the issue
    d_inverted <- data.frame(
      taxonKey = c(8, 8, 8, 8, 8),
      decimalLongitude = c(0, 0, 0, 0, 0),
      decimalLatitude = c(0, 0, 0, 0, 0),
      scientificName = c("Species D", "Species D", "Species E", "Species E", "Species F"),
      stringsAsFactors = FALSE
    )

    inverted_geometry <- "POLYGON ((-180 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, -180 85.0511287798, -180 -85.0511287798), (-12.3046875 11.723041818049527, -12.3046875 6.134097132761074, -12.3046875 0.5451524474726206, -12.3046875 -5.043792237815833, -12.3046875 -10.632736923104286, -5.44921875 -10.632736923104286, 1.40625 -10.632736923104286, 8.26171875 -10.632736923104286, 15.1171875 -10.632736923104286, 15.1171875 -5.043792237815833, 15.1171875 0.5451524474726206, 15.1171875 6.134097132761074, 15.1171875 11.723041818049527, 8.26171875 11.723041818049527, 1.40625 11.723041818049527, -5.44921875 11.723041818049527, -12.3046875 11.723041818049527))"
    
    inverted_rule_res <- make_rule(
      taxonKey = 8,
      geometry = inverted_geometry,
      annotation = "SUSPICIOUS"
    )
    r_inverted <- clean_download(d_inverted)
    
    expect_s3_class(r_inverted, "data.frame")
    expect_equal(nrow(r_inverted), 5)    
    expect_type(inverted_rule_res, "list")
    expect_equal(length(inverted_rule_res), 16)

  })

  test_that("clean_download removes records with normal polygon rule", {
    
    # Test normal polygon - coordinates at (0,0) should be INSIDE and removed
    d_normal <- data.frame(
      taxonKey = c(0, 0, 0, 0, 0),
      decimalLongitude = c(0, 0, 0, 0, 0),
      decimalLatitude = c(0, 0, 0, 0, 0),
      scientificName = c("Species A", "Species B", "Species C", "Species D", "Species E"),
      stringsAsFactors = FALSE
    )

    # Normal polygon geometry that contains (0,0)
    normal_geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
    
    normal_rule_res <- make_rule(
      taxonKey = 0,
      geometry = normal_geometry,
      annotation = "SUSPICIOUS"
    )
    
    r_normal <- clean_download(d_normal)
    
    # For normal polygon: points at (0,0) are INSIDE the polygon, so they should be removed
    # All 5 records should be removed because they're inside the polygon (suspicious)
    expect_equal(nrow(r_normal), 0)
    
    # Verify rule creation
    expect_type(normal_rule_res, "list")
    expect_equal(normal_rule_res$taxonKey, 0)
    expect_equal(normal_rule_res$annotation, "SUSPICIOUS")
    expect_equal(normal_rule_res$geometry, normal_geometry)
  })


})

