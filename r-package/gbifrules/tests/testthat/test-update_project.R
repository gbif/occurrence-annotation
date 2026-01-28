test_that("test update project works as expected", {
  skip_on_cran()
  
  p <- make_project(name="test project",description = "test project")

  up <- update_project(id=p$id,description = "update",members="dog")
  expect_type(up,"list")
  expect_true(!p$description == up$description)
  expect_equal(up$description, "update")
  expect_length(up$members, 2)
  
  pd <- get_project(id=p$id)
  expect_equal(pd$description, "update")
  expect_length(pd$members[[1]], 2)
  
  
  # change it back for next time
  up_back <- update_project(id=p$id,description = "test project",members="jwaller",keep_members = FALSE)
  expect_type(up_back,"list")
  expect_equal(up_back$description, "test project")
  expect_equal(up_back$members[[1]], "jwaller")
  expect_length(up_back$members, 1)

  # clean up
  delete_project(id=p$id)
  
})