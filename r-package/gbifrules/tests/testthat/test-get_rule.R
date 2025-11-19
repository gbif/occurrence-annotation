
with_mock_dir("fixtures/get_rule", {
  test_that("test make rule works as expected", {
  withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
    p <- make_project(name="test project", description = "test project")
    rs <- make_ruleset(projectId=p$id,name="test project", description = "test project")
    r <- make_rule(taxonKey=1,geometry="WKT",annotation="NATIVE",projectId=p$id,rulesetId=rs$id)
    rd <- get_rule()
    expect_s3_class(rd,"tbl_df")
    expect_true(r$id %in% rd$id)
    expect_true(all(is.na(rd$deleted)))
    
    rd1 <- get_rule(projectId = p$id)
    expect_s3_class(rd1,"tbl_df")
    expect_true(all(p$id == rd1$projectId))
    expect_true(all(is.na(rd1$deleted)))
    expect_type(rd1$supportedBy, "list")

    rd2 <- get_rule(rulesetId = rs$id)
    expect_s3_class(rd2,"tbl_df")
    expect_true(all(rs$id == rd2$rulesetId))
    expect_true(all(is.na(rd2$deleted)))

    rd3 <- get_rule(taxonKey=1)
    expect_s3_class(rd3,"tbl_df")
    expect_true(all(rd3$taxonKey == 1))
    expect_true(all(is.na(rd3$deleted)))
    
    rd4 <- get_rule(id=r$id)
    expect_s3_class(rd4,"tbl_df")
    expect_true(nrow(rd4) == 1)
    expect_true(all(rd4$id == r$id))
    
    rd5 <- get_rule(limit=3)
    expect_s3_class(rd5,"tbl_df")
    expect_true(nrow(rd5) <= 3)
  })
  })
})
