test_that("test get project works as expected", {
  skip_if_offline()
  
  pc <- get_project()
  if(nrow(pc) == 0) {
    p <- make_project(name="test get_project", description = "test project")
  }
  pd <- get_project()
  expect_s3_class(pd,"tbl_df")
  expect_type(pd$members,"list")
  expect_true(all(is.na(pd$deleted)))
  
  pd1 <- get_project(limit=3)
  expect_s3_class(pd1,"tbl_df")
  expect_true(nrow(pd1) <= 3)
  
  pd2 <- get_project(limit=1,offset=1)
  expect_s3_class(pd2,"tbl_df")
  expect_true(nrow(pd2) <= 1)
  
  pd3 <- get_project(id=pd$id[1])
  expect_s3_class(pd2,"tbl_df")
  expect_true(is.na(pd3$deleted))
  expect_true(nrow(pd3) == 1)
})

