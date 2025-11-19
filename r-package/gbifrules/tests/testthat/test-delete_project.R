test_that("Test that delete project works as expected", {
  withr::with_envvar(list(GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {
    # cannot record tests since there is no way to restore projects at this time. 
    p <- make_project(name="test project",description="A test project.")
    rs <- make_ruleset(projectId=p$id,name="test ruleset",description = "A test ruleset.")
    r <- make_rule(projectId=p$id,rulesetId=rs$id,taxonKey = 1, geometry = "WKT", annotation="NATIVE")
    
    expect_type(p,"list")
    expect_null(p$deleted)
    
    # project 
    dp <- delete_project(id=p$id)
    expect_true(!is.null(dp$deleted))
    
    pd <- get_project(id=p$id)
    expect_true(!is.null(pd$deleted))
    
    # deleting a project should delete the rules and rulesets too. 
    # ruleset 
    rsd <- get_ruleset(id=rs$id)
    expect_true(!is.null(rsd$deleted))
    
    # rule 
    rd <- get_rule(id=r$id)
    expect_true(!is.null(rd$deleted))
})
})
