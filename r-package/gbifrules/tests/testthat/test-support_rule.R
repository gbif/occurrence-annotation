test_that("test support rule works as expected", {
  
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
  
