test_that("Test that delete project works as expected", {
    # cannot record tests since there is no way to restore projects at this time. 
    
    p <- get_project(1)
    if(nrow(p) == 0) {
      p <- make_project(name="test project",description="A test project.")
    }
    r <- get_rule(projectId=p$id,
                  taxonKey = -300,
                  geometry = "delete_project_test_WKT",
                  annotation = "SUSPICIOUS")
    if(nrow(r) == 0) {
      r <- make_rule(projectId=p$id,
                    taxonKey = -300,
                    geometry = "delete_project_test_WKT",
                    annotation = "SUSPICIOUS")
    }
    expect_type(p,"list")
    
    # project 
    dp <- delete_project(id=p$id)
    expect_true(!is.null(dp$deleted))
    
    pd <- get_project(id=p$id)
    expect_true(!is.null(pd$deleted))
    
    # rule 
    rd <- get_rule(id=r$id)
    expect_true(!is.null(rd$deleted))
})
