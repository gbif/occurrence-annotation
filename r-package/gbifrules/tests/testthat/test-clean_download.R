library(testthat)
library(dplyr)
library(sf)

test_that("clean_download handles inverted geometries", {
  skip_on_cran()

  # Test inverted polygon with mixed coordinates
  # Points at (0,0) are in holes and should be kept
  # Points in solid areas of global polygon should be removed (suspicious)
  d_inverted <- data.frame(
    taxonKey = c(-1, -1, -1, -1, -1),
    decimalLongitude = c(0, 0, 0, 0, 0),  # All points in the hole at (0,0)
    decimalLatitude = c(50, 50, 0, 0, 0),
    scientificName = c("Species -1", "Species -1", "Species -1", "Species -1", "Species -1"),
    stringsAsFactors = FALSE
  )

  inverted_geometry <- "POLYGON ((-180 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, -180 85.0511287798, -180 -85.0511287798), (-12.3046875 11.723041818049527, -12.3046875 6.134097132761074, -12.3046875 0.5451524474726206, -12.3046875 -5.043792237815833, -12.3046875 -10.632736923104286, -5.44921875 -10.632736923104286, 1.40625 -10.632736923104286, 8.26171875 -10.632736923104286, 15.1171875 -10.632736923104286, 15.1171875 -5.043792237815833, 15.1171875 0.5451524474726206, 15.1171875 6.134097132761074, 15.1171875 11.723041818049527, 8.26171875 11.723041818049527, 1.40625 11.723041818049527, -5.44921875 11.723041818049527, -12.3046875 11.723041818049527))"
  
  # Check if rule already exists for taxonKey = 8, annotation = "SUSPICIOUS"
  existing_rules <- get_rule(
                    taxonKey = -1, 
                    annotation = "SUSPICIOUS",
                    geometry=inverted_geometry,
                    basisOfRecord = "null",
                    datasetKey = "null",
                    yearRange = "null"
                    ) 
  
  if (nrow(existing_rules) == 0) {
    inverted_rule_res <- make_rule(
      taxonKey = -1,
      geometry = inverted_geometry,
      annotation = "SUSPICIOUS"
    )
    expect_type(inverted_rule_res, "list")
  }
  
  r_inverted <- clean_download(d_inverted)
  
  expect_s3_class(r_inverted, "data.frame")
  expect_equal(nrow(r_inverted), 3)
  expect_true(all(r_inverted$decimalLongitude == 0))
  expect_true(all(r_inverted$decimalLatitude == 0))
  expect_true(all(r_inverted$scientificName == "Species -1"))
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
  
  # Test normal polygon - all coordinates at (0,0) should be INSIDE and removed
  d <- data.frame(
    taxonKey = c(-5, -5, -5, -5, -5),
    decimalLongitude = c(0, 0, 0, 0, 0),
    decimalLatitude = c(50, 0, 0, 0, 0),
    scientificName = c("Species -5", "Species -5", "Species -5", "Species -5", "Species -5"),
    year = c(1700, 1700, 2000, 2000, 2000),
    stringsAsFactors = FALSE
  )

  # Normal polygon geometry that contains (0,0)
  normal_geometry <- "POLYGON ((-13.0078125 11.723041818049527, 13.0078125 11.723041818049527, 13.0078125 -12.69842022271124, -13.0078125 -12.69842022271124, -13.0078125 11.723041818049527))"
  
  # Check if rule already exists for taxonKey = 0, annotation = "SUSPICIOUS"
  existing_rules <- get_rule(
                    taxonKey = -5, 
                    annotation = "SUSPICIOUS",
                    geometry=normal_geometry,
                    basisOfRecord = "null",
                    datasetKey = "null",
                    yearRange = "<1800"
                    ) 
  
  if (nrow(existing_rules) == 0) {
    res <- make_rule(
      taxonKey = -5,
      geometry = normal_geometry,
      annotation = "SUSPICIOUS",
      yearRange = "<1800"
    )
    expect_type(res, "list")
  }
  
  r <- clean_download(d)
  
  expect_s3_class(r, "data.frame")
  expect_equal(nrow(r), 1)
  expect_true(all(r$decimalLongitude == 0))
  expect_true(all(r$decimalLatitude == 50))
  expect_true(all(r$scientificName == "Species -5"))
  expect_true(all(r$year == 1700))
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
                            yearRange = ">1800",
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
      yearRange = ">1800",
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
  
  r <- clean_download(d)
  expect_s3_class(r, "data.frame")
  expect_equal(nrow(r), 3)
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



