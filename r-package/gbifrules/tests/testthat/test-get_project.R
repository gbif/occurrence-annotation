with_mock_dir("fixtures/get_project", {
  test_that("test get project works as expected", {
    withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
    p <- make_project(name="test project", description = "test project")
    pd <- get_project()
    expect_s3_class(pd,"tbl_df")
    expect_true(p$id %in% pd$id) 
    expect_type(pd$members,"list")
    expect_true(all(is.na(pd$deleted)))
    
    pd1 <- get_project(limit=3)
    expect_s3_class(pd1,"tbl_df")
    expect_true(nrow(pd1) <= 3)
    
    pd2 <- get_project(limit=1,offset=1)
    expect_s3_class(pd2,"tbl_df")
    expect_true(nrow(pd2) <= 1)
    
    pd3 <- get_project(id=p$id)
    expect_s3_class(pd2,"tbl_df")
    expect_true(is.na(pd3$deleted))
    expect_true(nrow(pd3) == 1)
    
  })
  })
})

