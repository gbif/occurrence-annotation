test_that("test contest rule works as expected", {
  skip_on_cran()
  
  r <- get_rule(taxonKey=-100, 
                geometry = "support_rule_test_WKT",
                annotation = "SUSPICIOUS",
                datasetKey = NULL,
                basisOfRecord =  NULL,
                yearRange = NULL)
  if(nrow(r) == 0) {
    r <- make_rule(taxonKey=-100, geometry = "support_rule_test_WKT", annotation = "SUSPICIOUS") 
  }
  
  c <- contest_rule(id=r$id)
  expect_type(c,"list")
  expect_length(c$contestedBy,1)
  
  # reset 
  rc <- rm_contest_rule(id=r$id)
  expect_type(rc,"list")
  expect_length(rc$contestedBy,0)
})

test_that("users can only remove their own contest, not others'", {
  skip_on_cran()
  skip_if_offline()
  
  # Skip if non-admin credentials not configured
  user2_name <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  user2_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(user2_name == "" || user2_pwd == "", 
          "Non-admin credentials not configured")
  
  # User 1 (default GBIF_USER) creates a rule
  rule <- make_rule(
    taxonKey = -102,
    geometry = "POINT (2 2)",
    annotation = "SUSPICIOUS"
  )
  
  expect_type(rule, "list")
  expect_true(!is.null(rule$id))
  
  # User 2 contests the rule
  contested_by_user2 <- contest_rule(
    id = rule$id,
    user = user2_name,
    pwd = user2_pwd
  )
  
  expect_length(contested_by_user2$contestedBy, 1)
  user2_username <- contested_by_user2$contestedBy[1]
  
  # User 1 tries to remove contest (should only remove themselves, not User 2)
  # User 1 is not in contestedBy, so this should have no effect
  after_user1_remove <- rm_contest_rule(id = rule$id)
  
  # User 2's contest should still be present
  expect_length(after_user1_remove$contestedBy, 1)
  expect_equal(after_user1_remove$contestedBy[1], user2_username)
  
  # User 2 removes their own contest (should work)
  after_user2_remove <- rm_contest_rule(
    id = rule$id,
    user = user2_name,
    pwd = user2_pwd
  )
  
  # Contest list should now be empty
  expect_length(after_user2_remove$contestedBy, 0)
  
  # Clean up - delete the rule
  delete_rule(rule$id)
})
