with_mock_dir("fixtures/gbifid_rule", {
  test_that("test gbifid rule works as expected", {
    withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
      p <- make_project(name="test project",description="A test project.")
      rs <- make_ruleset(projectId=p$id,name="test ruleset",description = "A test ruleset.")
      idr <- gbifid_rule(1986620884,projectId = p$id,rulesetId=rs$id)
      
      expect_type(idr,"list")
      expect_equal(idr$projectId,p$id)
      expect_equal(idr$rulesetId,rs$id)
      expect_equal(idr$taxonKey, 4264680)
      expect_equal(idr$annotation, "SUSPICIOUS")
      expect_equal(idr$datasetKey, "50c9509d-22c7-4a22-a47d-8c48425ef4a7")
      
    })
  })
})
