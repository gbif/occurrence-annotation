library(testthat)
library(dplyr)
library(sf)

test_that("clean_download handles simple polygon geometries", {
  skip_on_cran()

  # Test simple polygon - some points inside, some outside
  # Points at (0,0) are INSIDE and should be removed (suspicious)
  # Points at (50,50) are OUTSIDE and should be kept
  d_simple <- data.frame(
    taxonKey = c(-1200, -1200, -1200, -1200, -1200),
    decimalLongitude = c(0, 0, 0, 50, 50),  # 3 inside, 2 outside
    decimalLatitude = c(0, 0, 0, 50, 50),
    scientificName = c("Species -1200", "Species -1200", "Species -1200", "Species -1200", "Species -1200"),
    stringsAsFactors = FALSE
  )

  # Simple rectangular polygon around origin
  simple_geometry <- "POLYGON ((-10 -10, 10 -10, 10 10, -10 10, -10 -10))"
  
  # Check if rule already exists for taxonKey = -1200, annotation = "SUSPICIOUS"
  existing_rules <- get_rule(
                    taxonKey = -1200, 
                    annotation = "SUSPICIOUS",
                    basisOfRecord = "null",
                    datasetKey = "null",
                    yearRange = "null"
                    ) 
  
  if (nrow(existing_rules) == 0) {
    simple_rule_res <- make_rule(
      taxonKey = -1200,
      geometry = simple_geometry,
      annotation = "SUSPICIOUS"
    )
    expect_type(simple_rule_res, "list")
  }
  
  r_simple <- clean_download(d_simple)
  
  expect_s3_class(r_simple, "data.frame")
  expect_equal(nrow(r_simple), 2)  # Only 2 outside points kept
  expect_true(all(r_simple$decimalLongitude == 50))
  expect_true(all(r_simple$decimalLatitude == 50))
  expect_true(all(r_simple$scientificName == "Species -1200"))
})

test_that("clean_download handles normal geometries", {
  skip_on_cran()
  
  # Test normal polygon - all coordinates at (0,0) should be INSIDE and removed
  d_normal <- data.frame(
    taxonKey = c(-2, -2, -2, -2, -2),
    decimalLongitude = c(0, 0, 0, 0, 0),
    decimalLatitude = c(50, 50, 0, 0, 0),
    scientificName = c("Species -2", "Species -2", "Species -2", "Species -2", "Species -2"),
    stringsAsFactors = FALSE
  )

  # Normal polygon geometry that contains (0,0)
  normal_geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Check if rule already exists for taxonKey = 0, annotation = "SUSPICIOUS"
  existing_rules <- get_rule(
                    taxonKey = -2, 
                    annotation = "SUSPICIOUS",
                    geometry=normal_geometry,
                    basisOfRecord = "null",
                    datasetKey = "null",
                    yearRange = "null"
                    ) 
  
  if (nrow(existing_rules) == 0) {
    normal_rule_res <- make_rule(
      taxonKey = -2,
      geometry = normal_geometry,
      annotation = "SUSPICIOUS"
    )
    expect_type(normal_rule_res, "list")
  }
  
  r_normal <- clean_download(d_normal)
  
  expect_s3_class(r_normal, "data.frame")
  expect_equal(nrow(r_normal), 2)
  expect_true(all(r_normal$decimalLongitude == 0))
  expect_true(all(r_normal$decimalLatitude == 50))
  expect_true(all(r_normal$scientificName == "Species -2"))
})


test_that("clean_download removes PRESERVED_SPECIMEN records with basisOfRecord rule", {
  skip_on_cran()
  
  # Test basisOfRecord filtering - only PRESERVED_SPECIMEN records inside polygon should be removed
  d <- data.frame(
    taxonKey = c(-3, -3, -3, -3, -3, -3),  # Using taxonKey = 11 to avoid conflicts
    decimalLongitude = c(0, 0, 0, 0, 0, 0),  # All at (0,0) - inside the polygon
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    basisOfRecord = c("PRESERVED_SPECIMEN", "PRESERVED_SPECIMEN", "HUMAN_OBSERVATION", 
                     "MACHINE_OBSERVATION", "HUMAN_OBSERVATION", "LITERATURE"),
    scientificName = c("Species -3", "Species -3", "Species -3", "Species -3", "Species -3", "Species -3"),
    stringsAsFactors = FALSE
  )
  
  # Normal polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Check if rule already exists for taxonKey = 11, annotation = "SUSPICIOUS" with basisOfRecord PRESERVED_SPECIMEN
  existing_rules <- get_rule(taxonKey = -3,
                             geometry = geometry, 
                             annotation = "SUSPICIOUS",
                             basisOfRecord = "PRESERVED_SPECIMEN",
                             yearRange = "null",
                             datasetKey = "null"
                             ) 
  
  # Check if we have a rule with the correct basisOfRecord filtering
  if(nrow(existing_rules) == 0) {
    basis_rule_res <- make_rule(
      taxonKey = -3,
      geometry = geometry,
      annotation = "SUSPICIOUS",
      basisOfRecord = c("PRESERVED_SPECIMEN")
    )
    expect_type(basis_rule_res, "list")
  }

  r <- clean_download(d)
  
  # Should remove only the 3 PRESERVED_SPECIMEN records that are inside the polygon
  # Should keep the 3 records with other basisOfRecord values (HUMAN_OBSERVATION, MACHINE_OBSERVATION, LITERATURE)
  expect_equal(nrow(r), 4)
  expect_true(all(r$basisOfRecord != "PRESERVED_SPECIMEN"))
  expect_true(all(r$scientificName == "Species -3"))
  
})


test_that("clean_download handles multipolygons", {
  skip_on_cran()
  
  geometry <- "MULTIPOLYGON (((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527)), ((-13.0078125 56.08786093009717, 11.25 56.08786093009717, 11.25 41.13383173207349, -13.0078125 41.13383173207349, -13.0078125 56.08786093009717)))"
  # Data with taxonKey that has no rules
  d <- data.frame(
    taxonKey = c(-4, -4, -4),
    decimalLongitude = c(0, 0, 50),
    decimalLatitude = c(0, 50, 0),
    scientificName = c("Species -4", "Species -4", "Species -4"),
    stringsAsFactors = FALSE
  )
  
  existing_rules <- get_rule(
                    taxonKey = -4, 
                    annotation = "SUSPICIOUS",
                    geometry=geometry,  
                    basisOfRecord = "null",
                    datasetKey = "null",
                    yearRange = "null"
                    )

  if (nrow(existing_rules) == 0) {
    multipolygon_rule_res <- make_rule(
      taxonKey = -4,
      geometry = geometry,
      annotation = "SUSPICIOUS"
    )
    expect_type(multipolygon_rule_res, "list")
  }
  r <- clean_download(d)
  
  expect_s3_class(r, "data.frame")
  expect_equal(nrow(r), 1)
  expect_true(all(r$taxonKey == -4))
  expect_true(all(r$scientificName == "Species -4"))
  expect_true(all(r$decimalLongitude == 50))
  expect_true(all(r$decimalLatitude == 0))

})


test_that("clean_download handles yearRanges", {
  skip_on_cran()
  
  # Test yearRange filtering: records inside polygon with year <= 1799 should be removed
  d <- data.frame(
    taxonKey = c(-5, -5, -5, -5, -5),
    decimalLongitude = c(0, 0, 0, 0, 0),
    decimalLatitude = c(50, 0, 0, 0, 0),
    scientificName = c("Species -5", "Species -5", "Species -5", "Species -5", "Species -5"),
    year = c(1700, 1700, 2000, 2000, 2000),
    stringsAsFactors = FALSE
  )

  # Normal polygon geometry that contains (0,0) but not (0,50)
  normal_geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Check if rule already exists for taxonKey = -5, annotation = "SUSPICIOUS"
  existing_rules <- get_rule(
                    taxonKey = -5, 
                    annotation = "SUSPICIOUS",
                    geometry=normal_geometry,
                    basisOfRecord = "null",
                    datasetKey = "null",
                    yearRange = "*,1799"
                    ) 
  
  if (nrow(existing_rules) == 0) {
    res <- make_rule(
      taxonKey = -5,
      geometry = normal_geometry,
      annotation = "SUSPICIOUS",
      yearRange = "*,1799"
    )
    expect_type(res, "list")
  }
  
  r <- clean_download(d)
  
  expect_s3_class(r, "data.frame")
  # Should keep: 1 record outside polygon (lat=50, year=1700) + 3 records inside polygon with year > 1799
  # Should remove: 1 record inside polygon with year <= 1799 (lat=0, year=1700)
  expect_equal(nrow(r), 4)
  
  # Verify the removed record
  removed_records <- r[r$decimalLatitude == 0 & r$year == 1700, ]
  expect_equal(nrow(removed_records), 0)  # Should be removed
  
  # Verify records with year > 1799 are kept
  year_2000_records <- r[r$year == 2000, ]
  expect_equal(nrow(year_2000_records), 3)
  
  # Verify record outside polygon is kept regardless of year
  outside_records <- r[r$decimalLatitude == 50, ]
  expect_equal(nrow(outside_records), 1)
  expect_equal(outside_records$year, 1700)
})

test_that("clean_download remove records with datasetKey", {
  skip_on_cran()
  
  # Test basisOfRecord filtering - only PRESERVED_SPECIMEN records inside polygon should be removed
  d <- data.frame(
    taxonKey = c(-6, -6, -6, -6, -6),  # negative taxonKey to avoid conflicts
    decimalLongitude = c(0, 0, 0, 0, 0),  # All at (0,0) - inside the polygon
    decimalLatitude = c(0, 0, 0, 0, 0),
    scientificName = c("Species -6", "Species -6", "Species -6", "Species -6", "Species -6"),
    datasetKey = c("4fa7b334-ce0d-4e88-aaae-2e0c138d049e", 
                   "4fa7b334-ce0d-4e88-aaae-2e0c138d049e",
                   "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
                   "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
                   "50c9509d-22c7-4a22-a47d-8c48425ef4a7"),
    stringsAsFactors = FALSE
  )
  # Normal polygon geometry that contains (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Check if rule already exists for taxonKey = 11, annotation = "SUSPICIOUS" with basisOfRecord PRESERVED_SPECIMEN
  existing_rules <- get_rule(taxonKey = -6,
                             geometry = geometry, 
                             annotation = "SUSPICIOUS",
                             basisOfRecord = "null",
                             yearRange = "null",
                             datasetKey = "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"
                             ) 
  
  # Check if we have a rule with the correct basisOfRecord filtering
  if(nrow(existing_rules) == 0) {
    rule <- make_rule(
      taxonKey = -6,
      geometry = geometry,
      annotation = "SUSPICIOUS",
      datasetKey = "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"
    )
    expect_type(rule, "list")
  }

  r <- clean_download(d)
  # Should only keep non-eBird uuids   
  expect_equal(nrow(r), 3)
  expect_true(all(r$datasetKey != "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"))
  expect_true(all(r$scientificName == "Species -6"))
  
})

test_that("clean_download handles complex data and multiple rules", {
  skip_on_cran()
  
  d <- data.frame(
    taxonKey = c(-7, -7, -8, -8, -8),  # negative taxonKey to avoid conflicts
    decimalLongitude = c(0, 50, 50, 50, 0),  # All at (0,0) - inside the polygon
    decimalLatitude = c(50, 0, 0, 0, 0),
    scientificName = c("Species -7", "Species -7", "Species -8", "Species -8", "Species -8"),
    basisOfRecord = c("PRESERVED_SPECIMEN", "HUMAN_OBSERVATION", "PRESERVED_SPECIMEN", "HUMAN_OBSERVATION", "PRESERVED_SPECIMEN"),
    year = c(1700, 1700, 1700, 2000, 2000),
    datasetKey = c("4fa7b334-ce0d-4e88-aaae-2e0c138d049e", 
                   "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
                   "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
                   "4fa7b334-ce0d-4e88-aaae-2e0c138d049e",
                   "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"),
    stringsAsFactors = FALSE
  )

  geometry1 <- "MULTIPOLYGON (((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527)), ((-13.0078125 56.08786093009717, 11.25 56.08786093009717, 11.25 41.13383173207349, -13.0078125 41.13383173207349, -13.0078125 56.08786093009717)))"
  geometry2 <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  existing_rules1 <- get_rule(taxonKey = -7,
                            geometry = geometry1, 
                            annotation = "SUSPICIOUS",
                            basisOfRecord = "PRESERVED_SPECIMEN",
                            yearRange = "1801,*",
                            datasetKey = "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"
                            ) 

  existing_rules2 <- get_rule(taxonKey = -8,
                            geometry = geometry2, 
                            annotation = "SUSPICIOUS",
                            basisOfRecord = "null",
                            yearRange = "null",
                            datasetKey = "null"
                            )

  if(nrow(existing_rules1) == 0) {
    rule1 <- make_rule(
      taxonKey = -7,
      geometry = geometry1,
      annotation = "SUSPICIOUS",
      basisOfRecord = c("PRESERVED_SPECIMEN"),
      yearRange = "1801,*",
      datasetKey = "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"
    )
    expect_type(rule1, "list")
  }

  if(nrow(existing_rules2) == 0) {
    rule2 <- make_rule(
      taxonKey = -8,
      geometry = geometry2,
      annotation = "SUSPICIOUS"
    )
    expect_type(rule2, "list")
  }
  
  # Suppress expected coercion warning from internal data processing
  r <- suppressWarnings(clean_download(d))
  expect_s3_class(r, "data.frame")
  # With yearRange="1801,*", row 1 (year=1700) doesn't match, so only row 5 is removed by rule2
  expect_equal(nrow(r), 4)
  expect_true(all(r$taxonKey %in% c(-7, -8)))
}) 


test_that("clean_download handles negated basisOfRecord rules", {
  skip_on_cran()
  
  d <- data.frame(
    taxonKey = c(-9, -9, -9, -9),
    decimalLongitude = c(0, 0, 0, 0),
    decimalLatitude = c(0, 0, 0, 0),
    scientificName = c("Species -9", "Species -9", "Species -9", "Species -9"),
    basisOfRecord = c("HUMAN_OBSERVATION", "PRESERVED_SPECIMEN", "HUMAN_OBSERVATION", "HUMAN_OBSERVATION"),
    year = c(2000, 2000, 2000, 2000),
    stringsAsFactors = FALSE
  )

  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  # Ensure a negated basisOfRecord rule exists: this should target all records
  # except those with basisOfRecord == PRESERVED_SPECIMEN
  existing_rules <- get_rule(taxonKey = -9,
                             geometry = geometry,
                             annotation = "SUSPICIOUS",
                             basisOfRecord = "PRESERVED_SPECIMEN",
                             yearRange = "null",
                             datasetKey = "null", 
                             basisOfRecordNegated = TRUE
)

  if (nrow(existing_rules) == 0) {
    negated_rule_res <- make_rule(
      taxonKey = -9,
      geometry = geometry,
      annotation = "SUSPICIOUS",
      basisOfRecord = c("PRESERVED_SPECIMEN"),
      basisOfRecordNegated = TRUE
    )
    expect_type(negated_rule_res, "list")
  }

  r <- clean_download(d)
  expect_s3_class(r, "data.frame")
  expect_equal(nrow(r), 1)
  expect_true(all(r$basisOfRecord == "PRESERVED_SPECIMEN"))
  expect_true(all(r$scientificName == "Species -9"))
})


test_that("clean_download handles project_id filtering", {
  skip_on_cran()
  
  d <- data.frame(
    taxonKey = c(-10, -10, -10, -10),
    decimalLongitude = c(0, 0, 0, 0),
    decimalLatitude = c(0, 0, 50, 50),
    scientificName = c("Species -10", "Species -10", "Species -10", "Species -10"),
    stringsAsFactors = FALSE
  )
  # box around 0,0 
  geometry1 <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  geometry2 <- "POLYGON ((-13.554682731628418 58.93608947097473, 13.164067268371582 58.93608947097473, 13.164067268371582 43.369472173882706, -13.554682731628418 43.369472173882706, -13.554682731628418 58.93608947097473))"

  # Create a rule in project 1 that marks (0,0) as SUSPICIOUS
  existing_rules_proj1 <- get_rule(taxonKey = -10,
                                   geometry = geometry1,
                                   annotation = "SUSPICIOUS",
                                   basisOfRecord = "null",
                                   yearRange = "null",
                                   datasetKey = "null",
                                   projectId = 1
                                   )
  existing_rules_proj2 <- get_rule(taxonKey = -10,
                                   geometry = geometry2,
                                   annotation = "SUSPICIOUS",
                                   basisOfRecord = "null",  
                                   yearRange = "null",
                                   datasetKey = "null",
                                   projectId = 2
                                   )
  # existing projects
  get_project1 <- get_project(1)
  get_project2 <- get_project(2)
  if(nrow(get_project1) == 0) {
    make_project(1, "Test Project 1")
  }
  if(nrow(get_project2) == 0) {
    make_project(2, "Test Project 2")
  }
  if (nrow(existing_rules_proj1) == 0) {
    rule_proj1 <- make_rule(
      taxonKey = -10,
      geometry = geometry1,
      annotation = "SUSPICIOUS",
      projectId = 1
    )
    expect_type(rule_proj1, "list")
  }
  if( nrow(existing_rules_proj2) == 0) {
    rule_proj2 <- make_rule(
      taxonKey = -10,
      geometry = geometry2,
      annotation = "SUSPICIOUS",
      projectId = 2
    )
    expect_type(rule_proj2, "list")
  }
  
  # Clean download using only rules from project 1
  r1 <- clean_download(d, project_id = 1)
  r2 <- clean_download(d, project_id = c(1,2))
  r3 <- clean_download(d)
  r4 <- clean_download(d, project_id = 2)

  expect_s3_class(r1, "data.frame")
  expect_equal(nrow(r1), 2)
  expect_true(all(r1$decimalLongitude == 0))
  expect_true(all(r1$decimalLatitude == 50))
  expect_true(all(r1$scientificName == "Species -10"))

  expect_s3_class(r2, "data.frame")
  expect_equal(nrow(r2), 0)

  expect_s3_class(r3, "data.frame")
  expect_equal(nrow(r3), 0)

  expect_s3_class(r4, "data.frame")
  expect_equal(nrow(r4), 2)
  expect_true(all(r4$decimalLongitude == 0))
  expect_true(all(r4$decimalLatitude == 0))
  expect_true(all(r4$scientificName == "Species -10"))
})

test_that("clean_download filters suspicious records using higher taxonomy", {
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
  d <- data.frame(
    taxonKey = c(-13, -13, -13),
    classKey = c(-12, -12, -12),  # Class level matches rule taxonKey
    decimalLongitude = c(0, 0, 50),
    decimalLatitude = c(0, 50, 0),
    scientificName = c("Test species -13", "Test species -13", "Test species -13"),
    stringsAsFactors = FALSE
  )
  
  # Test with use_higher_taxonomy = TRUE (default)
  # Records at (0,0) should be filtered (inside polygon, match via classKey)
  r_with_higher <- clean_download(d, use_higher_taxonomy = TRUE)
  expect_s3_class(r_with_higher, "data.frame")
  expect_equal(nrow(r_with_higher), 2)  # Only (0,50) and (50,0) remain (outside polygon)
  
  # Test with use_higher_taxonomy = FALSE
  # No records should be filtered (rule taxonKey -12 doesn't match species taxonKey -13)
  r_without_higher <- clean_download(d, use_higher_taxonomy = FALSE)
  expect_s3_class(r_without_higher, "data.frame")
  expect_equal(nrow(r_without_higher), 3)  # All records remain
})

test_that("clean_download handles missing higher taxonomy columns gracefully", {
  skip_on_cran()
  skip_if_offline()
  
  # Standard polygon geometry containing (0,0)
  geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Create rule for a test taxonKey
  existing_rule <- get_rule(taxonKey = -11, geometry = geometry, annotation = "SUSPICIOUS")
  
  if (nrow(existing_rule) == 0) {
    rule_test <- make_rule(
      taxonKey = -11,
      geometry = geometry,
      annotation = "SUSPICIOUS"
    )
    expect_type(rule_test, "list")
  }
  
  # Create download with some taxonomy columns missing (NA values)
  d <- data.frame(
    taxonKey = c(-11, -11, -11),
    classKey = c(NA, 212, NA),  # Some NA values
    decimalLongitude = c(0, 0, 50),
    decimalLatitude = c(0, 50, 0),
    scientificName = c("Test species 1", "Test species 2", "Test species 3"),
    stringsAsFactors = FALSE
  )
  
  # Should not crash with NA values in taxonomy columns
  expect_no_error(r <- clean_download(d, use_higher_taxonomy = TRUE))
  expect_s3_class(r, "data.frame")
  
  # Record at (0,0) with taxonKey -11 should be filtered
  expect_true(nrow(r) < 3)
})

# Vote-based filtering tests

test_that("clean_download filters rules by minimum support", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a test rule with support (using fake taxonKey -666)
  rule <- make_rule(
    taxonKey = -666,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  # Add 1 support to the rule (API only allows 1 support per user)
  support_rule(rule$id)
  Sys.sleep(2)
  
  # Create download data with records inside and outside the polygon
  d <- data.frame(
    taxonKey = c(-666, -666, -666, -666),
    decimalLongitude = c(20, 25, 5, 35),  # 2 inside, 2 outside
    decimalLatitude = c(45, 42, 45, 45),
    basisOfRecord = c("HUMAN_OBSERVATION", "HUMAN_OBSERVATION", "HUMAN_OBSERVATION", "HUMAN_OBSERVATION")
  )
  
  # Without min_support, rule should apply
  result_no_filter <- clean_download(d, rm_suspicious = TRUE)
  expect_equal(nrow(result_no_filter), 2)  # 2 outside records kept
  
  # With min_support = 1, rule should still apply (has exactly 1 support)
  result_min_1 <- clean_download(d, rm_suspicious = TRUE, min_support = 1)
  expect_equal(nrow(result_min_1), 2)  # 2 outside records kept
  
  # With min_support = 2, rule should be filtered out (only 1 support)
  result_min_2 <- suppressWarnings(clean_download(d, rm_suspicious = TRUE, min_support = 2))
  expect_equal(nrow(result_min_2), 4)  # All records kept (no rules applied)
  
  # Cleanup
  delete_rule(rule$id)
})

test_that("clean_download excludes contested rules", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a test rule with contests (using fake taxonKey -777)
  rule <- make_rule(
    taxonKey = -777,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  # Add 1 contest to the rule
  contest_rule(rule$id)
  Sys.sleep(2)
  
  # Create download data
  d <- data.frame(
    taxonKey = c(-777, -777, -777, -777),
    decimalLongitude = c(20, 25, 5, 35),
    decimalLatitude = c(45, 42, 45, 45),
    basisOfRecord = c("HUMAN_OBSERVATION", "HUMAN_OBSERVATION", "HUMAN_OBSERVATION", "HUMAN_OBSERVATION")
  )
  
  # Without exclude_contested, rule should apply
  result_no_filter <- clean_download(d, rm_suspicious = TRUE)
  expect_equal(nrow(result_no_filter), 2)  # 2 outside records kept
  
  # With exclude_contested = TRUE, rule should be filtered out
  result_exclude <- suppressWarnings(clean_download(d, rm_suspicious = TRUE, exclude_contested = TRUE))
  expect_equal(nrow(result_exclude), 4)  # All records kept (no rules applied)
  
  # Cleanup
  delete_rule(rule$id)
})

test_that("clean_download handles rules with both supports and contests", {
  skip_if_offline()
  skip_on_cran()
  
  # Create two rules - one with support, one with contest
  rule_supported <- make_rule(
    taxonKey = -888,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  rule_contested <- make_rule(
    taxonKey = -889,
    geometry = "POLYGON((40 40, 60 40, 60 50, 40 50, 40 40))",
    annotation = "SUSPICIOUS"
  )
  
  # Rule 1: Add 1 support (API allows 1 support per user)
  support_rule(rule_supported$id)
  Sys.sleep(2)
  
  # Rule 2: Add 1 contest (API allows 1 contest per user)
  contest_rule(rule_contested$id)
  Sys.sleep(2)
  
  # Create download data with both taxonKeys
  d <- data.frame(
    taxonKey = c(-888, -888, -889, -889),
    decimalLongitude = c(20, 5, 50, 35),  # 1 inside each polygon
    decimalLatitude = c(45, 45, 45, 45),
    basisOfRecord = rep("HUMAN_OBSERVATION", 4)
  )
  
  # Rule with support passes min_support = 1
  result_min_support <- clean_download(d, rm_suspicious = TRUE, min_support = 1)
  expect_equal(nrow(result_min_support), 3)  # 1 record removed by rule_supported, rule_contested not applied
  
  # Rule with contest fails exclude_contested
  result_exclude <- clean_download(d, rm_suspicious = TRUE, exclude_contested = TRUE)
  expect_equal(nrow(result_exclude), 3)  # 1 record removed by rule_supported (no contests)
  
  # Both filters together
  result_both <- clean_download(d, rm_suspicious = TRUE, min_support = 1, exclude_contested = TRUE)
  expect_equal(nrow(result_both), 3)  # Only rule_supported applies
  
  # Cleanup
  delete_rule(rule_supported$id)
  delete_rule(rule_contested$id)
})

test_that("clean_download handles NA and empty supportedBy/contestedBy correctly", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a new rule with no votes (using fake taxonKey -999)
  rule <- make_rule(
    taxonKey = -999,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  # Don't add any votes - supportedBy and contestedBy should be NA or empty
  Sys.sleep(2)
  
  # Create download data
  d <- data.frame(
    taxonKey = c(-999, -999, -999, -999),
    decimalLongitude = c(20, 25, 5, 35),
    decimalLatitude = c(45, 42, 45, 45),
    basisOfRecord = c("HUMAN_OBSERVATION", "HUMAN_OBSERVATION", "HUMAN_OBSERVATION", "HUMAN_OBSERVATION")
  )
  
  # Rule with 0 supports should be filtered out by min_support = 1
  result_min_1 <- suppressWarnings(clean_download(d, rm_suspicious = TRUE, min_support = 1))
  expect_equal(nrow(result_min_1), 4)  # All records kept (rule filtered out)
  
  # Rule with 0 contests should pass exclude_contested
  result_exclude <- clean_download(d, rm_suspicious = TRUE, exclude_contested = TRUE)
  expect_equal(nrow(result_exclude), 2)  # Rule applies, suspicious records removed
  
  # Cleanup
  delete_rule(rule$id)
})

test_that("clean_download warns when all rules filtered by vote requirements", {
  skip_if_offline()
  skip_on_cran()
  
  # Create a rule with only 1 support (using fake taxonKey -1000)
  rule <- make_rule(
    taxonKey = -1000,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  support_rule(rule$id)
  Sys.sleep(2)
  
  # Create download data
  d <- data.frame(
    taxonKey = c(-1000, -1000),
    decimalLongitude = c(20, 25),
    decimalLatitude = c(45, 42),
    basisOfRecord = c("HUMAN_OBSERVATION", "HUMAN_OBSERVATION")
  )
  
  # Expect warning when min_support filters out all rules
  expect_warning(
    clean_download(d, rm_suspicious = TRUE, min_support = 5),
    "All 1 rules were filtered out by vote requirements"
  )
  
  # Cleanup
  delete_rule(rule$id)
})

test_that("clean_download combines min_support and exclude_contested correctly", {
  skip_if_offline()
  skip_on_cran()
  
  # Create two rules
  rule1 <- make_rule(
    taxonKey = -1001,
    geometry = "POLYGON((10 40, 30 40, 30 50, 10 50, 10 40))",
    annotation = "SUSPICIOUS"
  )
  
  rule2 <- make_rule(
    taxonKey = -1002,
    geometry = "POLYGON((40 40, 60 40, 60 50, 40 50, 40 40))",
    annotation = "SUSPICIOUS"
  )
  
  # Rule1: 1 support, 0 contests (should pass both filters with min_support=1)
  support_rule(rule1$id)
  Sys.sleep(2)
  
  # Rule2: 0 supports, 1 contest (should fail both filters)
  contest_rule(rule2$id)
  Sys.sleep(2)
  
  # Create download data with both taxonKeys
  d <- data.frame(
    taxonKey = c(-1001, -1001, -1002, -1002),
    decimalLongitude = c(20, 5, 50, 35),  # 1 inside each polygon
    decimalLatitude = c(45, 45, 45, 45),
    basisOfRecord = rep("HUMAN_OBSERVATION", 4)
  )
  
  # Apply both filters - only rule1 should apply
  result <- clean_download(d, rm_suspicious = TRUE, min_support = 1, exclude_contested = TRUE)
  expect_equal(nrow(result), 3)  # 1 record removed by rule1, rule2 filtered out
  
  # Verify the right record was removed (the one inside rule1's polygon)
  expect_true(-1001 %in% result$taxonKey)  # taxonKey -1001 should still be present (outside record)
  expect_equal(sum(result$taxonKey == -1001), 1)  # Only 1 of 2 records for -1001
  expect_equal(sum(result$taxonKey == -1002), 2)  # Both records for -1002 kept (rule filtered)
  
  # Cleanup
  delete_rule(rule1$id)
  delete_rule(rule2$id)
})

# ==============================================================================
# Comprehensive yearRange filtering tests
# ==============================================================================

test_that("clean_download handles yearRange '*,1799' (less than 1800)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1300, 6),
    decimalLongitude = c(0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1700, 1799, 1800, 1900, 2000, 1700),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "*,1799"
  rule <- make_rule(
    taxonKey = -1300,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "*,1799"
  )
  
  result <- clean_download(d, rm_suspicious = TRUE)
  
  # Should remove records with year <= 1799 that are inside polygon (1700, 1799)
  # Should keep: year 1800, 1900, 2000 (inside but year > 1799) + year 1700 outside polygon
  expect_equal(nrow(result), 4)
  expect_true(all(result$year > 1799 | result$decimalLongitude == 10))
  
  delete_rule(rule$id)
})

test_that("clean_download handles yearRange '1901,*' (greater than 1900)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1301, 6),
    decimalLongitude = c(0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1800, 1900, 1901, 2000, 2100, 1950),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "1901,*"
  rule <- make_rule(
    taxonKey = -1301,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1901,*"
  )
  
  result <- clean_download(d, rm_suspicious = TRUE)
  
  # Should remove records with year > 1900 that are inside polygon (1901, 2000, 2100)
  # Should keep: year 1800, 1900 (inside but year <= 1900) + year 1950 outside polygon
  expect_equal(nrow(result), 3)
  expect_true(all(result$year <= 1900 | result$decimalLongitude == 10))
  
  delete_rule(rule$id)
})

test_that("clean_download handles yearRange '1900,2000' (closed range)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1302, 7),
    decimalLongitude = c(0, 0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0, 0),
    year = c(1800, 1899, 1900, 1950, 2000, 2001, 1950),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "1900,2000"
  rule <- make_rule(
    taxonKey = -1302,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1900,2000"
  )
  
  result <- clean_download(d, rm_suspicious = TRUE)
  
  # Should remove records with 1900 <= year <= 2000 that are inside polygon (1900, 1950, 2000)
  # Should keep: year 1800, 1899, 2001 (inside but outside range) + year 1950 outside polygon
  expect_equal(nrow(result), 4)
  kept_years <- result$year
  inside_kept <- kept_years[result$decimalLongitude == 0]
  expect_true(all(inside_kept < 1900 | inside_kept > 2000))
  
  delete_rule(rule$id)
})

test_that("clean_download handles yearRange '*,1950' (open start)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1303, 6),
    decimalLongitude = c(0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1800, 1900, 1950, 1951, 2000, 1950),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "*,1950"
  rule <- make_rule(
    taxonKey = -1303,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "*,1950"
  )
  
  result <- clean_download(d, rm_suspicious = TRUE)
  
  # Should remove records with year <= 1950 that are inside polygon (1800, 1900, 1950)
  # Should keep: year 1951, 2000 (inside but year > 1950) + year 1950 outside polygon
  expect_equal(nrow(result), 3)
  inside_kept <- result[result$decimalLongitude == 0, ]
  expect_true(all(inside_kept$year > 1950))
  
  delete_rule(rule$id)
})

test_that("clean_download handles yearRange '1950,*' (open end)", {
  skip_on_cran()
  
  # Test data with various years
  d <- data.frame(
    taxonKey = rep(-1304, 6),
    decimalLongitude = c(0, 0, 0, 0, 0, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1800, 1900, 1949, 1950, 2000, 1950),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "1950,*"
  rule <- make_rule(
    taxonKey = -1304,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1950,*"
  )
  
  result <- clean_download(d, rm_suspicious = TRUE)
  
  # Should remove records with year >= 1950 that are inside polygon (1950, 2000)
  # Should keep: year 1800, 1900, 1949 (inside but year < 1950) + year 1950 outside polygon
  expect_equal(nrow(result), 4)
  inside_kept <- result[result$decimalLongitude == 0, ]
  expect_true(all(inside_kept$year < 1950))
  
  delete_rule(rule$id)
})

test_that("clean_download handles missing year column gracefully", {
  skip_on_cran()
  
  # Test data WITHOUT year column
  d <- data.frame(
    taxonKey = rep(-1305, 4),
    decimalLongitude = c(0, 0, 10, 10),
    decimalLatitude = c(0, 0, 0, 0),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange (should be ignored since data has no year column)
  rule <- make_rule(
    taxonKey = -1305,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1900,2000"
  )
  
  result <- clean_download(d, rm_suspicious = TRUE)
  
  # Should apply spatial filtering only, ignoring yearRange
  # Records inside polygon should be removed regardless of missing year
  expect_equal(nrow(result), 2)
  expect_true(all(result$decimalLongitude == 10))
  
  delete_rule(rule$id)
})

test_that("clean_download handles NA year values correctly", {
  skip_on_cran()
  
  # Test data with NA year values
  d <- data.frame(
    taxonKey = rep(-1306, 6),
    decimalLongitude = c(0, 0, 0, 0, 10, 10),
    decimalLatitude = c(0, 0, 0, 0, 0, 0),
    year = c(1900, 1950, 2000, NA, 1950, NA),
    stringsAsFactors = FALSE
  )
  
  # Polygon containing (0,0) but not (10,0)
  geom <- "POLYGON ((-5 -5, 5 -5, 5 5, -5 5, -5 -5))"
  
  # Create rule with yearRange "1900,2000"
  rule <- make_rule(
    taxonKey = -1306,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1900,2000"
  )
  
  result <- clean_download(d, rm_suspicious = TRUE)
  
  # Should remove records with 1900 <= year <= 2000 (1900, 1950, 2000)
  # Should keep: NA year values (inside polygon but NA doesn't match) + all records outside polygon
  expect_equal(nrow(result), 3)
  inside_kept <- result[result$decimalLongitude == 0, ]
  expect_equal(nrow(inside_kept), 1)
  expect_true(is.na(inside_kept$year))
  
  delete_rule(rule$id)
})

test_that("clean_download combines yearRange with basisOfRecord filtering", {
  skip_on_cran()
  
  # Test data with multiple filter dimensions
  d <- data.frame(
    taxonKey = rep(-1307, 8),
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
    taxonKey = -1307,
    geometry = geom,
    annotation = "SUSPICIOUS",
    yearRange = "1900,2000",
    basisOfRecord = "PRESERVED_SPECIMEN"
  )
  
  result <- clean_download(d, rm_suspicious = TRUE)
  
  # Should remove records that are:
  # - Inside polygon AND
  # - 1900 <= year <= 2000 AND
  # - basisOfRecord = "PRESERVED_SPECIMEN"
  # This removes: (0,0) + 1900 + PRESERVED_SPECIMEN, (0,0) + 1950 + PRESERVED_SPECIMEN
  # Should keep: 6 records (2 HUMAN_OBSERVATION inside, 2 outside range, 2 outside polygon)
  expect_equal(nrow(result), 6)
  
  # Verify that PRESERVED_SPECIMEN records inside with year in range are removed
  inside_preserved <- result[result$decimalLongitude == 0 & 
                              result$basisOfRecord == "PRESERVED_SPECIMEN", ]
  expect_true(all(inside_preserved$year > 2000))  # Only 2001 should remain
  
  delete_rule(rule$id)
})


