# testthat::test_file("tests/testthat/test-get_my_rules.R")

test_that("get_my_rules returns rules created by authenticated user", {
  skip_on_cran()
  
  # Create a test rule to ensure we have at least one rule
  test_rule <- get_rule(taxonKey = -888, 
                        geometry = "get_my_rules_test_WKT", 
                        annotation = "SUSPICIOUS")
  
  if (nrow(test_rule) == 0) {
    test_rule <- make_rule(taxonKey = -888, 
                          geometry = "get_my_rules_test_WKT", 
                          annotation = "SUSPICIOUS")
  }
  
  # Get rules created by authenticated user
  my_rules <- get_my_rules()
  
  expect_s3_class(my_rules, "tbl_df")
  expect_true(nrow(my_rules) > 0)
  expect_true("id" %in% names(my_rules))
  expect_true("taxonKey" %in% names(my_rules))
  expect_true("annotation" %in% names(my_rules))
  expect_true("createdBy" %in% names(my_rules))
  
  # Verify our test rule is in the results
  expect_true(any(my_rules$id == test_rule$id))
})

test_that("get_my_rules supports pagination", {
  skip_on_cran()
  
  # Get first page
  page1 <- get_my_rules(limit = 5, offset = 0)
  expect_s3_class(page1, "tbl_df")
  expect_true(nrow(page1) <= 5)
})

test_that("get_my_rules supports explicit authentication", {
  skip_on_cran()
  
  # Test with explicit user/pwd parameters
  user <- Sys.getenv("GBIF_USER")
  pwd <- Sys.getenv("GBIF_PWD")
  
  skip_if(user == "", "GBIF_USER not set")
  skip_if(pwd == "", "GBIF_PWD not set")
  
  my_rules <- get_my_rules(user = user, pwd = pwd)
  expect_s3_class(my_rules, "tbl_df")
})

test_that("get_my_rules works for non-admin users", {
  skip_on_cran()
  
  # Test with non-admin user credentials
  user <- Sys.getenv("GBIF_USER_NON_ADMIN")
  pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN")
  
  skip_if(user == "", "GBIF_USER_NON_ADMIN not set")
  skip_if(pwd == "", "GBIF_PWD_NON_ADMIN not set")
  
  # Create a test rule as non-admin user
  test_rule <- get_rule(
    taxonKey = -777, 
    geometry = "non_admin_my_rules_test_WKT", 
    annotation = "SUSPICIOUS",
    user = user,
    pwd = pwd
  )
  
  if (nrow(test_rule) == 0) {
    test_rule <- make_rule(
      taxonKey = -777, 
      geometry = "non_admin_my_rules_test_WKT", 
      annotation = "SUSPICIOUS",
      user = user,
      pwd = pwd
    )
  }
  
  # Get rules created by non-admin user
  my_rules <- get_my_rules(user = user, pwd = pwd)
  
  expect_s3_class(my_rules, "tbl_df")
  expect_true("id" %in% names(my_rules))
  expect_true("createdBy" %in% names(my_rules))
  
  # Verify the test rule is in the results
  expect_true(any(my_rules$id == test_rule$id))
})
