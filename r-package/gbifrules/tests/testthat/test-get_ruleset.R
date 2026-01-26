# with_mock_dir("fixtures/get_ruleset", {
# test_that("Get ruleset works as expected", {
#   p <- make_project(name="test project", description = "test project")
#   rs <- make_ruleset(projectId=p$id,name="test project", description = "test project")
#   rsd <- get_ruleset()
#   expect_s3_class(rsd,"tbl_df")
#   expect_true(rs$id %in% rsd$id) 
#   expect_type(rsd$members,"list")
#   expect_true(all(is.na(rsd$deleted)))
  
#   rsd1 <- get_ruleset(limit=3)
#   expect_s3_class(rsd1,"tbl_df")
#   expect_true(nrow(rsd1) <= 3)
  
#   rsd2 <- get_ruleset(limit=1,offset=1)
#   expect_s3_class(rsd2,"tbl_df")
#   expect_true(nrow(rsd2) <= 1)
  
#   rsd3 <- get_ruleset(id=rs$id)
#   expect_s3_class(rsd2,"tbl_df")
#   expect_true(is.na(rsd3$deleted))
#   expect_true(nrow(rsd3) == 1)
  
#   rsd4 <- get_ruleset(projectId=p$id)
#   expect_s3_class(rsd3,"tbl_df")
#   expect_true(all(is.na(rsd3$deleted)))
#   expect_true(p$id %in% rsd3$projectId)
# })
# })
