test_that("get_contested_rules returns rules contested by authenticated user", {
  skip_on_cran()
  
  # Create a test rule and contest it
  test_rule <- get_rule(taxonKey = -666, 
                        geometry = "get_contested_rules_test_WKT", 
                        annotation = "SUSPICIOUS")
  
  if (nrow(test_rule) == 0) {
    test_rule <- make_rule(taxonKey = -666, 
                          geometry = "get_contested_rules_test_WKT", 
                          annotation = "SUSPICIOUS")
  }
  
  # Contest the rule
  contest_rule(id = test_rule$id)
  
  # Get contested rules
  contested_rules <- get_contested_rules()
  
  expect_s3_class(contested_rules, "tbl_df")
  expect_true("id" %in% names(contested_rules))
  expect_true("taxonKey" %in% names(contested_rules))
  expect_true("annotation" %in% names(contested_rules))
  expect_true("contestedBy" %in% names(contested_rules))
  
  # Verify our test rule is in the results
  expect_true(any(contested_rules$id == test_rule$id))
  
  # Clean up
  rm_contest_rule(id = test_rule$id)
})

test_that("get_contested_rules supports pagination", {
  skip_on_cran()
  
  # Get first page
  page1 <- get_contested_rules(limit = 5, offset = 0)
  expect_s3_class(page1, "tbl_df")
  expect_true(nrow(page1) <= 5)
})

test_that("get_contested_rules handles empty results", {
  skip_on_cran()
  
  # Use non-admin user who likely has no contested rules
  user <- Sys.getenv("GBIF_USER_NON_ADMIN")
  pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN")
  
  skip_if(user == "", "GBIF_USER_NON_ADMIN not set")
  skip_if(pwd == "", "GBIF_PWD_NON_ADMIN not set")
  
  contested <- get_contested_rules(user = user, pwd = pwd)
  expect_s3_class(contested, "tbl_df")
  # Should have expected columns even if empty
  expect_true("id" %in% names(contested))
  expect_true("annotation" %in% names(contested))
})
