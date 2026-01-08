test_that("test contest rule works as expected", {
  withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
  with_mock_dir("fixtures/contest_rule", {
    r <- make_rule(taxonKey=1, geometry = "WKT", annotation = "NATIVE")
  })
  c <- contest_rule(id=r$id)
  expect_type(c,"list")
  expect_length(c$contestedBy,1)
  
  # reset 
  rc <- rm_contest_rule(id=r$id)
  expect_type(rc,"list")
  expect_length(rc$contestedBy,0)
})
})
