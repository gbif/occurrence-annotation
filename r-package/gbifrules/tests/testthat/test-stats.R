test_that("get_top_creators returns creator statistics", {
  skip_on_cran()
  
  # Get top creators
  top_creators <- get_top_creators()
  
  expect_s3_class(top_creators, "tbl_df")
  expect_true("username" %in% names(top_creators))
  expect_true("ruleCount" %in% names(top_creators))
  expect_true("totalSupports" %in% names(top_creators))
  expect_true("totalContests" %in% names(top_creators))
  expect_true("projectCount" %in% names(top_creators))
  
  # Default limit is 10
  expect_true(nrow(top_creators) <= 10)
  
  # Verify ordering by ruleCount (descending)
  if (nrow(top_creators) > 1) {
    expect_true(all(diff(top_creators$ruleCount) <= 0))
  }
})

test_that("get_top_creators respects limit parameter", {
  skip_on_cran()
  
  # Get top 5 creators
  top_5 <- get_top_creators(limit = 5)
  
  expect_s3_class(top_5, "tbl_df")
  expect_true(nrow(top_5) <= 5)
})

test_that("get_top_creators handles large limits", {
  skip_on_cran()
  
  # Backend caps at 100
  top_100 <- get_top_creators(limit = 100)
  
  expect_s3_class(top_100, "tbl_df")
  expect_true(nrow(top_100) <= 100)
})

test_that("get_most_supported_creators returns creator statistics", {
  skip_on_cran()
  
  # Get most supported creators
  supported_creators <- get_most_supported_creators()
  
  expect_s3_class(supported_creators, "tbl_df")
  expect_true("username" %in% names(supported_creators))
  expect_true("ruleCount" %in% names(supported_creators))
  expect_true("totalSupports" %in% names(supported_creators))
  expect_true("totalContests" %in% names(supported_creators))
  expect_true("projectCount" %in% names(supported_creators))
  
  # Default limit is 10
  expect_true(nrow(supported_creators) <= 10)
  
  # Verify ordering by totalSupports (descending)
  if (nrow(supported_creators) > 1) {
    expect_true(all(diff(supported_creators$totalSupports) <= 0))
  }
})

test_that("get_most_supported_creators respects limit parameter", {
  skip_on_cran()
  
  # Get top 3 most supported
  top_3 <- get_most_supported_creators(limit = 3)
  
  expect_s3_class(top_3, "tbl_df")
  expect_true(nrow(top_3) <= 3)
})

test_that("get_top_projects returns project statistics", {
  skip_on_cran()
  
  # Get top projects
  top_projects <- get_top_projects()
  
  expect_s3_class(top_projects, "tbl_df")
  expect_true("projectId" %in% names(top_projects))
  expect_true("projectName" %in% names(top_projects))
  expect_true("projectDescription" %in% names(top_projects))
  expect_true("createdBy" %in% names(top_projects))
  expect_true("ruleCount" %in% names(top_projects))
  expect_true("totalSupports" %in% names(top_projects))
  expect_true("totalContests" %in% names(top_projects))
  expect_true("memberCount" %in% names(top_projects))
  
  # Default limit is 10
  expect_true(nrow(top_projects) <= 10)
  
  # Verify ordering by ruleCount (descending)
  if (nrow(top_projects) > 1) {
    expect_true(all(diff(top_projects$ruleCount) <= 0))
  }
})

test_that("get_top_projects respects limit parameter", {
  skip_on_cran()
  
  # Get top 5 projects
  top_5 <- get_top_projects(limit = 5)
  
  expect_s3_class(top_5, "tbl_df")
  expect_true(nrow(top_5) <= 5)
})

test_that("get_most_supported_projects returns project statistics", {
  skip_on_cran()
  
  # Get most supported projects
  supported_projects <- get_most_supported_projects()
  
  expect_s3_class(supported_projects, "tbl_df")
  expect_true("projectId" %in% names(supported_projects))
  expect_true("projectName" %in% names(supported_projects))
  expect_true("ruleCount" %in% names(supported_projects))
  expect_true("totalSupports" %in% names(supported_projects))
  expect_true("totalContests" %in% names(supported_projects))
  expect_true("memberCount" %in% names(supported_projects))
  
  # Default limit is 10
  expect_true(nrow(supported_projects) <= 10)
  
  # Verify ordering by totalSupports (descending)
  if (nrow(supported_projects) > 1) {
    expect_true(all(diff(supported_projects$totalSupports) <= 0))
  }
})

test_that("get_most_supported_projects respects limit parameter", {
  skip_on_cran()
  
  # Get top 3 most supported
  top_3 <- get_most_supported_projects(limit = 3)
  
  expect_s3_class(top_3, "tbl_df")
  expect_true(nrow(top_3) <= 3)
})

test_that("stats functions handle empty results gracefully", {
  skip_on_cran()
  
  # All stats functions should return valid tibbles even if empty
  creators <- get_top_creators()
  expect_s3_class(creators, "tbl_df")
  
  supported <- get_most_supported_creators()
  expect_s3_class(supported, "tbl_df")
  
  projects <- get_top_projects()
  expect_s3_class(projects, "tbl_df")
  
  supported_proj <- get_most_supported_projects()
  expect_s3_class(supported_proj, "tbl_df")
})
