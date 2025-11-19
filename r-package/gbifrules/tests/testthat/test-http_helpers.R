test_that("gbif_base works as expected", {
  withr::with_envvar(list(GBIFRULES_GITHUB_ACTIONS="", 
                          GBIFRULES_URL = "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/"), {  
    uu <- gbif_base()
    expect_true(uu %in% 
                  c(
                    "https://api.gbif-uat.org/v1/occurrence/experimental/annotation/",
                    "https://api.gbif.org/v1/occurrence/experimental/annotation/"
                  ))
  })
  # when running github actions it should run on localhost 
  withr::with_envvar(list(GBIFRULES_GITHUB_ACTIONS="true"), {  
    bb <-gbif_base()
    expect_equal(bb,"http://localhost:8080/occurrence/experimental/annotation/")
  })
  
})
