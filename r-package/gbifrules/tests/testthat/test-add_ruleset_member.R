test_that("test add ruleset member works as expected", {
  withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
    with_mock_dir("fixtures/add_ruleset_member", {
      p <- make_project(name="test project",description="A test project.")
      r <- make_ruleset(projectId=p$id,name="test ruleset",description = "A test ruleset.")
      expect_type(r,"list")
      expect_equal(r$name,"test ruleset")
      expect_equal(r$description,"A test ruleset.")
      expect_equal(r$deleted,NULL)
      expect_length(r$members,1)
      })
    
    update_ruleset(r$id,members="jwaller",keep_members = FALSE)
    
    m <- add_ruleset_member(r$id,"JOE")
    expect_equal(length(get_ruleset(m$id)$members[[1]]),2)
    expect_type(m,"list")
    expect_equal(m$id,r$id)
    
  })
  })
