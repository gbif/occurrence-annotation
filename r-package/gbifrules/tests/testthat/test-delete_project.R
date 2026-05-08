# run this test file with:
# testthat::test_file("tests/testthat/test-delete_project.R")

test_that("delete_project works for project creator", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test project
  test_project <- make_project(
    name = "Test Project - Creator Delete",
    description = "Test project for creator deletion"
  )
  
  expect_type(test_project, "list")
  expect_true(!is.null(test_project$id))
  expect_true(is.null(test_project$deleted))
  
  # Delete the project (creator should be able to delete)
  deleted_project <- delete_project(test_project$id)
  
  # Verify deletion was successful
  expect_true(!is.null(deleted_project$deleted))
  
  # Verify project is marked as deleted when retrieved
  retrieved_project <- get_project(id = test_project$id)
  expect_true(!is.null(retrieved_project$deleted))
})

test_that("admin can delete any project", {
  skip_on_cran()
  skip_if_offline()
  
  # Skip if non-admin credentials not configured
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  
  # Create a project with non-admin user
  project_by_non_admin <- make_project(
    name = "Test Project - Non-Admin",
    description = "Test project created by non-admin",
    user = non_admin_user,
    pwd = non_admin_pwd
  )
  
  expect_type(project_by_non_admin, "list")
  expect_true(!is.null(project_by_non_admin$id))
  expect_true(is.null(project_by_non_admin$deleted))
  # Note: Backend may normalize usernames (e.g., extract username from email)
  expect_true(!is.null(project_by_non_admin$createdBy))
  
  # Admin should be able to delete this project (created by non-admin)
  # Using default GBIF_USER (admin) credentials
  deleted_project <- delete_project(project_by_non_admin$id)
  
  # Verify deletion was successful
  expect_true(!is.null(deleted_project$deleted))
  
  # Verify project is marked as deleted when retrieved
  retrieved_project <- get_project(id = project_by_non_admin$id)
  expect_true(!is.null(retrieved_project$deleted))
})

test_that("non-admin cannot delete projects created by others", {
  skip_on_cran()
  skip_if_offline()
  
  # Get both admin and non-admin credentials
  admin_user <- Sys.getenv("GBIF_USER", "")
  admin_pwd <- Sys.getenv("GBIF_PWD", "")
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  
  # Create a project explicitly with admin credentials
  project_by_admin <- make_project(
    name = "Test Project - Admin",
    description = "Test project created by admin",
    user = admin_user,
    pwd = admin_pwd
  )
  
  expect_type(project_by_admin, "list")
  expect_true(!is.null(project_by_admin$id))
  expect_true(is.null(project_by_admin$deleted))
  
  # Non-admin should NOT be able to delete this project (created by admin)
  expect_error(
    delete_project(project_by_admin$id, user = non_admin_user, pwd = non_admin_pwd),
    "Only the creator or an administrator can perform this action|UNAUTHORIZED|401|403"
  )
  
  # Verify project is still NOT deleted (admin can check)
  retrieved_project <- get_project(id = project_by_admin$id)
  expect_true(is.na(retrieved_project$deleted))
  
  # Clean up - admin deletes the project
  delete_project(project_by_admin$id, user = admin_user, pwd = admin_pwd)
})

test_that("non-admin can delete their own projects", {
  skip_on_cran()
  skip_if_offline()
  
  # Skip if non-admin credentials not configured
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  
  # Create a project with non-admin credentials
  project_by_non_admin <- make_project(
    name = "Test Project - Non-Admin Own",
    description = "Test project for non-admin to delete their own",
    user = non_admin_user,
    pwd = non_admin_pwd
  )
  
  expect_type(project_by_non_admin, "list")
  expect_true(!is.null(project_by_non_admin$id))
  expect_true(is.null(project_by_non_admin$deleted))
  # Note: Backend may normalize usernames (e.g., extract username from email)
  expect_true(!is.null(project_by_non_admin$createdBy))
  
  # Non-admin SHOULD be able to delete their own project
  deleted_project <- delete_project(
    project_by_non_admin$id, 
    user = non_admin_user, 
    pwd = non_admin_pwd
  )
  
  # Verify deletion was successful
  expect_true(!is.null(deleted_project$deleted))
  # deletedBy should match the creator (backend normalizes username)
  expect_equal(deleted_project$deletedBy, project_by_non_admin$createdBy)
  
  # Verify project is marked as deleted when retrieved
  retrieved_project <- get_project(id = project_by_non_admin$id)
  expect_true(!is.null(retrieved_project$deleted))
})

test_that("delete_project requires authentication", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test project with valid credentials
  test_project <- make_project(
    name = "Test Project - Auth Required",
    description = "Test project for authentication requirement"
  )
  
  # Try to delete without credentials (empty strings)
  expect_error(
    delete_project(test_project$id, user = "", pwd = ""),
    "UNAUTHORIZED|401|authentication|auth"
  )
  
  # Clean up - delete with valid credentials
  delete_project(test_project$id)
})

test_that("deleting project also deletes associated rules", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test project with a rule
  test_project <- make_project(
    name = "Test Project - Cascade Delete",
    description = "Test project for cascade deletion"
  )
  
  test_rule <- make_rule(
    projectId = test_project$id,
    taxonKey = 6,
    geometry = "POINT (6 6)",
    annotation = "SUSPICIOUS"
  )
  
  expect_true(is.null(test_rule$deleted))
  
  # Delete the project
  deleted_project <- delete_project(test_project$id)
  expect_true(!is.null(deleted_project$deleted))
  
  # Verify associated rule is also marked as deleted
  retrieved_rule <- get_rule(id = test_rule$id)
  expect_true(!is.null(retrieved_rule$deleted))
})

test_that("deleting project also deletes all associated rules", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test project with multiple rules
  test_project <- make_project(
    name = "Test Project - Cascade Delete",
    description = "Test project for cascade deletion"
  )
  
  # Create multiple rules with different characteristics
  rule1 <- make_rule(
    projectId = test_project$id,
    taxonKey = -2001,
    geometry = "POINT (1 1)",
    annotation = "SUSPICIOUS"
  )
  
  rule2 <- make_rule(
    projectId = test_project$id,
    taxonKey = -2002,
    geometry = "POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))",
    annotation = "INTRODUCED"
  )
  
  rule3 <- make_rule(
    projectId = test_project$id,
    taxonKey = -2003,
    geometry = "POINT (3 3)",
    annotation = "NATIVE",
    basisOfRecord = "HUMAN_OBSERVATION"
  )
  
  rule4 <- make_rule(
    projectId = test_project$id,
    taxonKey = -2004,
    geometry = "POINT (4 4)",
    annotation = "SUSPICIOUS",
    yearRange = "1900,2000"
  )
  
  # Verify all rules are not deleted initially
  expect_true(is.null(rule1$deleted))
  expect_true(is.null(rule2$deleted))
  expect_true(is.null(rule3$deleted))
  expect_true(is.null(rule4$deleted))
  
  # Delete the project
  deleted_project <- delete_project(test_project$id)
  expect_true(!is.null(deleted_project$deleted))
  
  # Verify ALL associated rules are marked as deleted
  retrieved_rule1 <- get_rule(id = rule1$id)
  retrieved_rule2 <- get_rule(id = rule2$id)
  retrieved_rule3 <- get_rule(id = rule3$id)
  retrieved_rule4 <- get_rule(id = rule4$id)
  
  expect_true(!is.null(retrieved_rule1$deleted))
  expect_true(!is.null(retrieved_rule2$deleted))
  expect_true(!is.null(retrieved_rule3$deleted))
  expect_true(!is.null(retrieved_rule4$deleted))
})