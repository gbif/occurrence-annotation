test_that("test update ruleset works as expected", {
  withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
  with_mock_dir("fixtures/update_ruleset", {
    p <- make_project(name="test project",description = "test project")
    rs <- make_ruleset(projectId=p$id, name="test ruleset", description = "test ruleset")
  })
  
  up <- update_ruleset(id = rs$id, description = "update",members = "dog")
  expect_type(up,"list")
  expect_true(!rs$description == up$description)
  expect_equal(up$description, "update")
  expect_length(up$members, 2)
  
  rsd <- get_ruleset(id=up$id)
  expect_equal(rsd$description, "update")
  expect_length(rsd$members[[1]], 2)

  # change it back for next time
  up_back <- update_ruleset(id=rs$id,description = "test ruleset",members = "jwaller",keep_members = FALSE)
  expect_type(up_back,"list")
  expect_equal(up_back$description, "test ruleset")
  expect_equal(up_back$members[[1]], "jwaller")
  expect_length(up_back$members, 1)
  
})
})
