test_that("test make rule comment works as expected", {
  skip_on_cran()
  
  r <- get_rule(taxonKey = -500, 
                geometry = "get_rule_comment_WKT", 
                annotation = "SUSPICIOUS") 
  if(nrow(r) == 0) {
    r <- make_rule(taxonKey = -500, 
                  geometry = "get_rule_comment_WKT", 
                  annotation = "SUSPICIOUS") 
  }
  c <- get_rule_comment(id=r$id)
  if(nrow(c) == 0) {
    c <- make_rule_comment(id=r$id,"test comment")
  }
  expect_type(c,"list")
  expect_true(c$ruleId == r$id)
  expect_true(c$comment == "test comment")
  
  rc <- get_rule_comment(id=r$id)
  expect_type(rc,"list")
  expect_s3_class(rc,"tbl_df")
  expect_equal(rc$ruleId, r$id)
  expect_equal(rc$comment, "test comment")

})
