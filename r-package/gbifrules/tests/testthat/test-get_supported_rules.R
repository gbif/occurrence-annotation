test_that("get_supported_rules returns rules supported by authenticated user", {
  skip_on_cran()
  
  # Create a test rule and support it
  test_rule <- get_rule(taxonKey = -777, 
                        geometry = "get_supported_rules_test_WKT", 
                        annotation = "SUSPICIOUS")
  
  if (nrow(test_rule) == 0) {
    test_rule <- make_rule(taxonKey = -777, 
                          geometry = "get_supported_rules_test_WKT", 
                          annotation = "SUSPICIOUS")
  }
  
  # Support the rule
  support_rule(id = test_rule$id)
  
  # Get supported rules
  supported_rules <- get_supported_rules()
  
  expect_s3_class(supported_rules, "tbl_df")
  expect_true("id" %in% names(supported_rules))
  expect_true("taxonKey" %in% names(supported_rules))
  expect_true("annotation" %in% names(supported_rules))
  expect_true("supportedBy" %in% names(supported_rules))
  
  # Verify our test rule is in the results
  expect_true(any(supported_rules$id == test_rule$id))
  
  # Clean up
  rm_support_rule(id = test_rule$id)
})

test_that("get_supported_rules supports pagination", {
  skip_on_cran()
  
  # Get first page
  page1 <- get_supported_rules(limit = 5, offset = 0)
  expect_s3_class(page1, "tbl_df")
  expect_true(nrow(page1) <= 5)
})

test_that("get_supported_rules handles empty results", {
  skip_on_cran()
  
  # Use non-admin user who likely has no supported rules
  user <- Sys.getenv("GBIF_USER_NON_ADMIN")
  pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN")
  
  skip_if(user == "", "GBIF_USER_NON_ADMIN not set")
  skip_if(pwd == "", "GBIF_PWD_NON_ADMIN not set")
  
  supported <- get_supported_rules(user = user, pwd = pwd)
  expect_s3_class(supported, "tbl_df")
  # Should have expected columns even if empty
  expect_true("id" %in% names(supported))
  expect_true("annotation" %in% names(supported))
})
