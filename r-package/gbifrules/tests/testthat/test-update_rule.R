test_that("update_rule modifies existing rule", {
  skip_on_cran()
  
  # Create a test rule
  test_rule <- make_rule(taxonKey = -555, 
                        geometry = "update_rule_test_WKT", 
                        annotation = "SUSPICIOUS")
  
  expect_equal(test_rule$annotation, "SUSPICIOUS")
  
  # Update the annotation
  updated_rule <- update_rule(id = test_rule$id, annotation = "INTRODUCED")
  
  expect_equal(updated_rule$id, test_rule$id)
  expect_equal(updated_rule$annotation, "INTRODUCED")
  expect_equal(updated_rule$taxonKey, test_rule$taxonKey)
})

test_that("update_rule can update multiple fields", {
  skip_on_cran()
  
  # Create a test rule
  test_rule <- make_rule(taxonKey = -444, 
                        geometry = "update_rule_multi_test_WKT", 
                        annotation = "SUSPICIOUS")
  
  # Update multiple fields
  updated_rule <- update_rule(
    id = test_rule$id,
    annotation = "NATIVE",
    basisOfRecord = c("HUMAN_OBSERVATION")
  )
  
  expect_equal(updated_rule$annotation, "NATIVE")
  expect_true(grepl("HUMAN_OBSERVATION", updated_rule$basisOfRecord))
})

test_that("update_rule requires id parameter", {
  skip_on_cran()
  
  expect_error(
    update_rule(annotation = "SUSPICIOUS"),
    "Must supply rule id"
  )
})

test_that("update_rule fails for non-existent rule", {
  skip_on_cran()
  
  expect_error(
    update_rule(id = 999999999, annotation = "SUSPICIOUS"),
    "Rule not found"
  )
})

test_that("update_rule preserves unmodified fields", {
  skip_on_cran()
  
  # Create a test rule with specific properties
  test_rule <- make_rule(
    taxonKey = -333, 
    geometry = "update_rule_preserve_test_WKT", 
    annotation = "SUSPICIOUS",
    basisOfRecord = c("MACHINE_OBSERVATION")
  )
  
  original_taxon <- test_rule$taxonKey
  original_geometry <- test_rule$geometry
  
  # Update only annotation
  updated_rule <- update_rule(id = test_rule$id, annotation = "INTRODUCED")
  
  # Check that other fields are preserved
  expect_equal(updated_rule$taxonKey, original_taxon)
  expect_equal(updated_rule$geometry, original_geometry)
  expect_equal(updated_rule$annotation, "INTRODUCED")
})
