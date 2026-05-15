test_that("get_rule_metrics returns aggregated metrics", {
  skip_on_cran()
  
  # Get overall metrics
  metrics <- get_rule_metrics()
  
  expect_s3_class(metrics, "tbl_df")
  expect_true("ruleCount" %in% names(metrics))
  expect_true("datasetCount" %in% names(metrics))
  expect_true("projectCount" %in% names(metrics))
  expect_true("taxonCount" %in% names(metrics))
  expect_true("supportCount" %in% names(metrics))
  expect_true("contestCount" %in% names(metrics))
})

test_that("get_rule_metrics filters by username", {
  skip_on_cran()
  
  # Get current user's username from a rule they created
  my_rules <- get_my_rules(limit = 1)
  skip_if(nrow(my_rules) == 0, "No rules found for user")
  
  username <- my_rules$createdBy[1]
  
  # Get metrics for specific user
  user_metrics <- get_rule_metrics(username = username)
  
  expect_s3_class(user_metrics, "tbl_df")
  
  if (nrow(user_metrics) > 0) {
    expect_equal(user_metrics$username, username)
    expect_true(user_metrics$ruleCount > 0)
  }
})

test_that("get_rule_metrics filters by taxonKey", {
  skip_on_cran()
  
  # Create a test rule with specific taxon
  test_rule <- get_rule(taxonKey = -222, 
                        geometry = "metrics_test_WKT", 
                        annotation = "SUSPICIOUS")
  
  if (nrow(test_rule) == 0) {
    test_rule <- make_rule(taxonKey = -222, 
                          geometry = "metrics_test_WKT", 
                          annotation = "SUSPICIOUS")
  }
  
  # Get metrics for specific taxon
  taxon_metrics <- get_rule_metrics(taxonKey = -222)
  
  expect_s3_class(taxon_metrics, "tbl_df")
})

test_that("get_rule_metrics filters by projectId", {
  skip_on_cran()
  
  # Get a project to test with
  projects <- get_project(limit = 1)
  skip_if(nrow(projects) == 0, "No projects found")
  
  project_id <- projects$id[1]
  
  # Get metrics for specific project
  project_metrics <- get_rule_metrics(projectId = project_id)
  
  expect_s3_class(project_metrics, "tbl_df")
})

test_that("get_rule_metrics handles multiple filters", {
  skip_on_cran()
  
  # Get user's rules to find valid filter values
  my_rules <- get_my_rules(limit = 1)
  skip_if(nrow(my_rules) == 0, "No rules found")
  
  username <- my_rules$createdBy[1]
  taxonKey <- my_rules$taxonKey[1]
  
  # Get metrics with multiple filters
  filtered_metrics <- get_rule_metrics(
    username = username,
    taxonKey = taxonKey
  )
  
  expect_s3_class(filtered_metrics, "tbl_df")
})
