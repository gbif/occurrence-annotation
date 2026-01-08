with_mock_dir("fixtures/make_project", {
  test_that("test make project works as expected", {
    withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
      
   p <- make_project(name="test project",description="A test project.")
    expect_type(p,"list")
    expect_equal(p$name,"test project")
    expect_equal(p$description,"A test project.")
    expect_equal(p$deleted,NULL)
    expect_length(p$members,1)
  
    expect_error(make_project(name=NULL,description="A test project."),
                   "Please provide a name for the project.")
    expect_error(make_project(name="",description=NULL),
                 "Please provide a description for the project.")
  })
  })
})

