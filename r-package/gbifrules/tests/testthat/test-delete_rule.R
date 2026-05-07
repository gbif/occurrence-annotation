# run this test file with:
# testthat::test_file("tests/testthat/test-delete_rule.R")

test_that("delete_rule works for rule creator", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test rule
  test_rule <- make_rule(
    taxonKey = 1, 
    geometry = "POINT (1 1)", 
    annotation = "SUSPICIOUS"
  )
  
  expect_type(test_rule, "list")
  expect_true(!is.null(test_rule$id))
  expect_true(is.null(test_rule$deleted))
  
  # Delete the rule (creator should be able to delete)
  deleted_rule <- delete_rule(test_rule$id)
  
  # Verify deletion was successful
  expect_true(!is.null(deleted_rule$deleted))
  
  # Verify rule is marked as deleted when retrieved
  retrieved_rule <- get_rule(id = test_rule$id)
  expect_true(!is.null(retrieved_rule$deleted))
})

test_that("admin can delete any rule", {
  skip_on_cran()
  skip_if_offline()
  
  # Skip if non-admin credentials not configured
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  
  # Create a rule with non-admin user
  rule_by_non_admin <- make_rule(
    taxonKey = 2,
    geometry = "POINT (2 2)",
    annotation = "SUSPICIOUS",
    user = non_admin_user,
    pwd = non_admin_pwd
  )
  
  expect_type(rule_by_non_admin, "list")
  expect_true(!is.null(rule_by_non_admin$id))
  expect_true(is.null(rule_by_non_admin$deleted))
  # Note: Backend may normalize usernames (e.g., extract username from email)
  expect_true(!is.null(rule_by_non_admin$createdBy))
  
  # Admin should be able to delete this rule (created by non-admin)
  # Using default GBIF_USER (admin) credentials
  deleted_rule <- delete_rule(rule_by_non_admin$id)
  
  # Verify deletion was successful
  expect_true(!is.null(deleted_rule$deleted))
  
  # Verify rule is marked as deleted when retrieved
  retrieved_rule <- get_rule(id = rule_by_non_admin$id)
  expect_true(!is.null(retrieved_rule$deleted))
})

test_that("non-admin cannot delete rules created by others", {
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
    taxonKey = 3,
    geometry = "POINT (3 3)",
    annotation = "SUSPICIOUS",
    user = admin_user,
    pwd = admin_pwd
  )
  
  expect_type(rule_by_admin, "list")
  expect_true(!is.null(rule_by_admin$id))
  expect_true(is.null(rule_by_admin$deleted))
  
  # Non-admin should NOT be able to delete this rule (created by admin)
  expect_error(
    delete_rule(rule_by_admin$id, user = non_admin_user, pwd = non_admin_pwd),
    "Only the creator or an administrator can perform this action|UNAUTHORIZED|401|403"
  )
  
  # Verify rule is still NOT deleted (admin can check)
  retrieved_rule <- get_rule(id = rule_by_admin$id)
  expect_true(is.na(retrieved_rule$deleted))
  
  # Clean up - admin deletes the rule
  delete_rule(rule_by_admin$id, user = admin_user, pwd = admin_pwd)
})

test_that("non-admin can delete their own rules", {
  skip_on_cran()
  skip_if_offline()
  
  # Skip if non-admin credentials not configured
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  

  # Create a rule with non-admin credentials
  rule_by_non_admin <- make_rule(
    taxonKey = 4,
    geometry = "POINT (4 4)",
    annotation = "SUSPICIOUS",
    user = non_admin_user,
    pwd = non_admin_pwd
  )
  
  expect_type(rule_by_non_admin, "list")
  expect_true(!is.null(rule_by_non_admin$id))
  expect_true(is.null(rule_by_non_admin$deleted))
  # Note: Backend may normalize usernames (e.g., extract username from email)
  expect_true(!is.null(rule_by_non_admin$createdBy))
  
  # Non-admin SHOULD be able to delete their own rule
  deleted_rule <- delete_rule(
    rule_by_non_admin$id, 
    user = non_admin_user, 
    pwd = non_admin_pwd
  )
  
  # Verify deletion was successful
  expect_true(!is.null(deleted_rule$deleted))
  # deletedBy should match the creator (backend normalizes username)
  expect_equal(deleted_rule$deletedBy, rule_by_non_admin$createdBy)
  
  # Verify rule is marked as deleted when retrieved
  retrieved_rule <- get_rule(id = rule_by_non_admin$id)
  expect_true(!is.null(retrieved_rule$deleted))
})

test_that("delete_rule requires authentication", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test rule with valid credentials
  test_rule <- make_rule(
    taxonKey = 5,
    geometry = "POINT (5 5)",
    annotation = "SUSPICIOUS"
  )
  
  # Try to delete without credentials (empty strings)
  expect_error(
    delete_rule(test_rule$id, user = "", pwd = ""),
    "UNAUTHORIZED|401|authentication|auth"
  )
  
  # Clean up - delete with valid credentials
  delete_rule(test_rule$id)
})
