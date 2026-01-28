test_that("test make project works as expected", {
  skip_on_cran()
  
  p <- make_project(name="test project",description="A test project.")
  expect_type(p,"list")
  expect_equal(p$name,"test project")
  expect_equal(p$description,"A test project.")
  expect_equal(p$deleted,NULL)
  expect_length(p$members,1)
  # clean up
  delete_project(id=p$id)

  expect_error(make_project(name=NULL,description="A test project."),
                  "Please provide a name for the project.")
  expect_error(make_project(name="",description=NULL),
                "Please provide a description for the project.")
})


