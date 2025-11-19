test_that("test support rule works as expected", {
  withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
  with_mock_dir("fixtures/support_rule", {
  r <- make_rule(taxonKey=1, geometry = "WKT", annotation = "NATIVE")
  })
    
  s <- support_rule(id=r$id)
  expect_type(s,"list")
  expect_length(s$supportedBy,1)
  
  # reset 
  rms <- rm_support_rule(id=r$id)
  expect_type(rms,"list")
  expect_length(rms$supportedBy,0)
})
})
  
