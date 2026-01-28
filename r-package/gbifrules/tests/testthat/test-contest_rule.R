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
