with_mock_dir("fixtures/make_rule_comment", {
  test_that("test make rule comment works as expected", {
    withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
      
  r <- make_rule(taxonKey = 1, geometry = "WKT", annotation = "NATIVE") 
  
  c <- make_rule_comment(id=r$id,"test comment")
  expect_type(c,"list")
  expect_true(c$ruleId == r$id)
  expect_true(c$comment == "test comment")
  
  c1 <- make_rule_comment(id=r$id,"test comment 1")
  expect_type(c1,"list")
  expect_equal(c1$ruleId,r$id)
  expect_equal(c1$comment,"test comment 1")
  
  })
  })
})
