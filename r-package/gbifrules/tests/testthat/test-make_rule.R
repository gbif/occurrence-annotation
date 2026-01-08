with_mock_dir("fixtures/make_rule", {
  
  # Test polygon geometry
  test_geometry <- "POLYGON ((-116.71875 30.624500755313708, -116.71875 25.554080303743348, -116.71875 20.483659852172988, -116.71875 15.413239400602627, -116.71875 10.342818949032267, -108.45703125 10.342818949032267, -100.1953125 10.342818949032267, -91.93359375 10.342818949032267, -83.671875 10.342818949032267, -83.671875 15.413239400602627, -83.671875 20.483659852172988, -83.671875 25.554080303743348, -83.671875 30.624500755313708, -91.93359375 30.624500755313708, -100.1953125 30.624500755313708, -108.45703125 30.624500755313708, -116.71875 30.624500755313708))"
  
  test_that("make_rule requires all mandatory parameters", {
    expect_error(
      make_rule(taxonKey = NULL, geometry = test_geometry, annotation = "SUSPICIOUS"),
      "please supply taxonKey"
    )
    
    expect_error(
      make_rule(taxonKey = 0, geometry = NULL, annotation = "SUSPICIOUS"),
      "please supply geometry"
    )
    
    expect_error(
      make_rule(taxonKey = 0, geometry = test_geometry, annotation = NULL),
      "please supply annotation"
    )
  })
  
  test_that("make_rule creates simple rule with required parameters", {
    r <- make_rule(
      taxonKey = 0, 
      geometry = test_geometry, 
      annotation = "SUSPICIOUS"
    )
    
    expect_type(r, "list")
    expect_equal(r$taxonKey, 0)
    expect_equal(r$geometry, test_geometry)
    expect_equal(r$annotation, "SUSPICIOUS")
  })
  
  test_that("make_rule creates complex rule with basisOfRecord array", {
    r <- make_rule(
      taxonKey = 0,
      geometry = test_geometry,
      annotation = "SUSPICIOUS",
      basisOfRecord = c("MACHINE_OBSERVATION", "HUMAN_OBSERVATION")
    )
    
    expect_type(r, "list")
    expect_equal(r$taxonKey, 0)
    expect_equal(r$annotation, "SUSPICIOUS")
    expect_equal(r$basisOfRecord, list("MACHINE_OBSERVATION", "HUMAN_OBSERVATION"))
  })
  
  test_that("make_rule creates rule with metadata fields", {
    r <- make_rule(
      taxonKey = 0,
      geometry = test_geometry,
      annotation = "SUSPICIOUS",
      basisOfRecordNegated = TRUE
    )
    
    expect_type(r, "list")
    expect_equal(r$taxonKey, 0)
    expect_equal(r$annotation, "SUSPICIOUS")
    expect_equal(r$basisOfRecordNegated, TRUE)
  })
  
  test_that("make_rule handles yearRange field", {
    r <- make_rule(
      taxonKey = 0,
      geometry = test_geometry,
      annotation = "SUSPICIOUS",
      yearRange = "2000,2023"
    )
    
    expect_type(r, "list")
    expect_equal(r$yearRange, "2000,2023")
  })
    
  test_that("make_rule handles single basisOfRecord value", {
    r <- make_rule(
      taxonKey = 0,
      geometry = test_geometry,
      annotation = "SUSPICIOUS",
      basisOfRecord = "MACHINE_OBSERVATION"
    )
    
    expect_type(r, "list")
    expect_equal(r$basisOfRecord, list("MACHINE_OBSERVATION"))
  })
  
  test_that("make_rule creates full complex rule with allowed optional fields", {
    r <- make_rule(
      taxonKey = 0,
      geometry = test_geometry,
      annotation = "SUSPICIOUS",
      basisOfRecord = c("MACHINE_OBSERVATION", "HUMAN_OBSERVATION", "LITERATURE"),
      basisOfRecordNegated = FALSE,
      yearRange = "1950,2023"
    )
    
    expect_type(r, "list")
    expect_equal(r$taxonKey, 0)
    expect_equal(r$geometry, test_geometry)
    expect_equal(r$annotation, "SUSPICIOUS")
    expect_equal(r$basisOfRecord, list("MACHINE_OBSERVATION", "HUMAN_OBSERVATION", "LITERATURE"))
    expect_equal(r$basisOfRecordNegated, FALSE)
    expect_equal(r$yearRange, "1950,2023")
  })
  
  test_that("make_rule automatically uses GBIF_USER for createdBy", {
    # GBIF_USER will be set by renv environment, so we test with whatever is available
    r <- make_rule(
      taxonKey = 0,
      geometry = test_geometry,
      annotation = "SUSPICIOUS"
    )
    
    expect_type(r, "list")
    # createdBy should be set from GBIF_USER environment variable (managed by renv)
    expect_true("createdBy" %in% names(r))
  })
})
