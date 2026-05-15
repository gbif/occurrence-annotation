test_that("test support rule works as expected", {
  skip_on_cran()
  
  r <- get_rule(taxonKey=-100, geometry = "support_rule_test_WKT", annotation = "SUSPICIOUS") 
  if(nrow(r) == 0) {
    r <- make_rule(taxonKey=-100, geometry = "support_rule_test_WKT", annotation = "SUSPICIOUS") 
  }    
  s <- support_rule(id=r$id)
  expect_type(s,"list")
  expect_length(s$supportedBy,1)
  
  # clean up  
  rms <- rm_support_rule(id=r$id)
  expect_type(rms,"list")
  expect_length(rms$supportedBy,0)
})

test_that("users can only remove their own support, not others'", {
  skip_on_cran()
  skip_if_offline()
  
  # Skip if non-admin credentials not configured
  user2_name <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  user2_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(user2_name == "" || user2_pwd == "", 
          "Non-admin credentials not configured")
  
  # User 1 (default GBIF_USER) creates a rule
  rule <- make_rule(
    taxonKey = -101,
    geometry = "POINT (1 1)",
    annotation = "SUSPICIOUS"
  )
  
  expect_type(rule, "list")
  expect_true(!is.null(rule$id))
  
  # User 2 supports the rule
  supported_by_user2 <- support_rule(
    id = rule$id,
    user = user2_name,
    pwd = user2_pwd
  )
  
  expect_length(supported_by_user2$supportedBy, 1)
  user2_username <- supported_by_user2$supportedBy[1]
  
  # User 1 tries to remove support (should only remove themselves, not User 2)
  # User 1 is not in supportedBy, so this should have no effect
  after_user1_remove <- rm_support_rule(id = rule$id)
  
  # User 2's support should still be present
  expect_length(after_user1_remove$supportedBy, 1)
  expect_equal(after_user1_remove$supportedBy[1], user2_username)
  
  # User 2 removes their own support (should work)
  after_user2_remove <- rm_support_rule(
    id = rule$id,
    user = user2_name,
    pwd = user2_pwd
  )
  
  # Support list should now be empty
  expect_length(after_user2_remove$supportedBy, 0)
  
  # Clean up - delete the rule
  delete_rule(rule$id)
})
  
