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

test_that("admin can update any rule", {
  skip_on_cran()
  skip_if_offline()
  
  # Skip if non-admin credentials not configured
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  
  # Create a rule with non-admin user
  rule_by_non_admin <- make_rule(
    taxonKey = 7,
    geometry = "POINT (7 7)",
    annotation = "SUSPICIOUS",
    user = non_admin_user,
    pwd = non_admin_pwd
  )
  
  expect_equal(rule_by_non_admin$annotation, "SUSPICIOUS")
  
  # Admin should be able to update this rule (created by non-admin)
  # Using default GBIF_USER (admin) credentials
  updated_rule <- update_rule(
    id = rule_by_non_admin$id, 
    annotation = "NATIVE"
  )
  
  expect_equal(updated_rule$annotation, "NATIVE")
  
  # Clean up
  delete_rule(rule_by_non_admin$id)
})

test_that("non-admin cannot update rules created by others", {
  skip_on_cran()
  skip_if_offline()
  
  # Get both admin and non-admin credentials
  admin_user <- Sys.getenv("GBIF_USER", "")
  admin_pwd <- Sys.getenv("GBIF_PWD", "")
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  
  # Create a rule explicitly with admin credentials
  rule_by_admin <- make_rule(
    taxonKey = 8,
    geometry = "POINT (8 8)",
    annotation = "SUSPICIOUS",
    user = admin_user,
    pwd = admin_pwd
  )
  
  expect_equal(rule_by_admin$annotation, "SUSPICIOUS")
  
  # Non-admin should NOT be able to update this rule (created by admin)
  expect_error(
    update_rule(
      id = rule_by_admin$id, 
      annotation = "NATIVE",
      user = non_admin_user, 
      pwd = non_admin_pwd
    ),
    "Only the creator or an administrator can perform this action|UNAUTHORIZED|401|403"
  )
  
  # Verify rule was NOT updated
  retrieved_rule <- get_rule(id = rule_by_admin$id)
  expect_equal(retrieved_rule$annotation, "SUSPICIOUS")
  
  # Clean up - admin deletes the rule
  delete_rule(rule_by_admin$id, user = admin_user, pwd = admin_pwd)
})

test_that("non-admin can update their own rules", {
  skip_on_cran()
  skip_if_offline()
  
  # Skip if non-admin credentials not configured
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  
  # Create a rule with non-admin credentials
  rule_by_non_admin <- make_rule(
    taxonKey = 9,
    geometry = "POINT (9 9)",
    annotation = "SUSPICIOUS",
    user = non_admin_user,
    pwd = non_admin_pwd
  )
  
  expect_equal(rule_by_non_admin$annotation, "SUSPICIOUS")
  
  # Non-admin SHOULD be able to update their own rule
  updated_rule <- update_rule(
    id = rule_by_non_admin$id, 
    annotation = "NATIVE",
    user = non_admin_user, 
    pwd = non_admin_pwd
  )
  
  expect_equal(updated_rule$annotation, "NATIVE")
  
  # Clean up
  delete_rule(rule_by_non_admin$id, user = non_admin_user, pwd = non_admin_pwd)
})
