test_that("test update project works as expected", {
  skip_on_cran()
  
  p <- make_project(name="test project",description = "test project")

  up <- update_project(id=p$id,description = "update",members="dog")
  expect_type(up,"list")
  expect_true(!p$description == up$description)
  expect_equal(up$description, "update")
  expect_length(up$members, 2)
  
  pd <- get_project(id=p$id)
  expect_equal(pd$description, "update")
  expect_length(pd$members[[1]], 2)
  
  
  # change it back for next time
  up_back <- update_project(id=p$id,description = "test project",members="jwaller",keep_members = FALSE)
  expect_type(up_back,"list")
  expect_equal(up_back$description, "test project")
  expect_equal(up_back$members[[1]], "jwaller")
  expect_length(up_back$members, 1)

  # clean up
  delete_project(id=p$id)
  
})

test_that("project member can update project", {
  skip_on_cran()
  skip_if_offline()
  
  # Get both admin and non-admin credentials
  admin_user <- Sys.getenv("GBIF_USER", "")
  admin_pwd <- Sys.getenv("GBIF_PWD", "")
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  
  # Create a project with non-admin as the creator
  # This makes non-admin automatically a member
  project <- make_project(
    name = "Test Project - Member Update",
    description = "Original description",
    user = non_admin_user,
    pwd = non_admin_pwd
  )
  
  # Non-admin (as creator and member) should be able to update the project
  member_update <- update_project(
    id = project$id,
    description = "Updated by member",
    user = non_admin_user,
    pwd = non_admin_pwd
  )
  
  expect_equal(member_update$description, "Updated by member")
  
  # Clean up - non-admin can delete their own project
  delete_project(id = project$id, user = non_admin_user, pwd = non_admin_pwd)
})

test_that("non-member cannot update project", {
  skip_on_cran()
  skip_if_offline()
  
  # Get both admin and non-admin credentials
  admin_user <- Sys.getenv("GBIF_USER", "")
  admin_pwd <- Sys.getenv("GBIF_PWD", "")
  non_admin_user <- Sys.getenv("GBIF_USER_NON_ADMIN", "")
  non_admin_pwd <- Sys.getenv("GBIF_PWD_NON_ADMIN", "")
  skip_if(non_admin_user == "" || non_admin_pwd == "", 
          "Non-admin credentials not configured")
  
  # Create a project with admin as creator (non-admin not a member)
  project <- make_project(
    name = "Test Project - Non-Member",
    description = "Original description",
    user = admin_user,
    pwd = admin_pwd
  )
  
  expect_equal(project$description, "Original description")
  
  # Non-admin (not a member) should NOT be able to update the project
  expect_error(
    update_project(
      id = project$id,
      description = "Unauthorized update",
      user = non_admin_user,
      pwd = non_admin_pwd
    ),
    "User must be a member of the project being updated|UNAUTHORIZED|401|403|400"
  )
  
  # Verify project was NOT updated
  retrieved_project <- get_project(id = project$id)
  expect_equal(retrieved_project$description, "Original description")
  
  # Clean up
  delete_project(id = project$id, user = admin_user, pwd = admin_pwd)
})