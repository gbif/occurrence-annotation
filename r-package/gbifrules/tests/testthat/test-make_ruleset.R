# with_mock_dir("fixtures/make_ruleset", {
#   test_that("test make project works as expected", {
#     withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
#     p <- make_project(name="test project",description="A test project.")
#     r <- make_ruleset(projectId=p$id,name="test ruleset",description = "A test ruleset.")
#     expect_type(r,"list")
#     expect_equal(r$name,"test ruleset")
#     expect_equal(r$description,"A test ruleset.")
#     expect_equal(r$deleted,NULL)
#     expect_length(r$members,1)
    
#     expect_error(make_ruleset(name=NULL,description="A test ruleset"),
#                  "Please provide a name for the ruleset.")
#     expect_error(make_ruleset(name="",description=NULL),
#                  "Please provide a description for the ruleset")
#     # projectId can be left NULL
#     r1 <- make_ruleset(name="",description="")
#     expect_type(r,"list")
#   })
#   })
# })
