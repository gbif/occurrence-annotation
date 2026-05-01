test_that("get project vocabulary works as expected", {
  skip_on_cran()
  skip_if_offline()
  
  # Get or create a test project
  pc <- get_project()
  if(nrow(pc) == 0) {
    p <- make_project(name="test vocabulary", description = "test project for vocabulary")
    project_id <- p$id
  } else {
    project_id <- pc$id[1]
  }
  
  # Get vocabulary for the project
  vocab <- get_project_vocabulary(project_id)
  
  # Check structure
  expect_s3_class(vocab, "tbl_df")
  expect_true("term" %in% names(vocab))
  expect_true("description" %in% names(vocab))
  expect_true("color" %in% names(vocab))
  expect_true("locked" %in% names(vocab))
  
  # Check that default vocabulary includes SUSPICIOUS
  expect_true("SUSPICIOUS" %in% vocab$term)
  
  # Check that locked is logical
  expect_type(vocab$locked, "logical")
})

test_that("update project vocabulary works as expected", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test project for vocabulary updates
  p <- make_project(name="test update vocabulary", description = "test project for vocabulary updates")
  project_id <- p$id
  
  # Create custom vocabulary
  custom_vocab <- list(
    list(term = "NATIVE", description = "Native species", color = "#22c55e", locked = FALSE),
    list(term = "INTRODUCED", description = "Introduced species", color = "#3b82f6", locked = FALSE),
    list(term = "SUSPICIOUS", description = "Suspicious record", color = "#ef4444", locked = TRUE)
  )
  
  # Update vocabulary
  result <- update_project_vocabulary(project_id, custom_vocab)
  
  # Result should be a list
  expect_type(result, "list")
  
  # Verify the vocabulary was updated
  updated_vocab <- get_project_vocabulary(project_id)
  expect_equal(nrow(updated_vocab), 3)
  expect_true("NATIVE" %in% updated_vocab$term)
  expect_true("INTRODUCED" %in% updated_vocab$term)
  expect_true("SUSPICIOUS" %in% updated_vocab$term)
  
  # Clean up - delete the test project
  delete_project(project_id)
})

test_that("delete project vocabulary works as expected", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test project
  p <- make_project(name="test delete vocabulary", description = "test project for vocabulary deletion")
  project_id <- p$id
  
  # Set custom vocabulary first
  custom_vocab <- list(
    list(term = "CUSTOM", description = "Custom term", color = "#00ff00", locked = FALSE),
    list(term = "SUSPICIOUS", description = "Suspicious", color = "#ef4444", locked = TRUE)
  )
  update_project_vocabulary(project_id, custom_vocab)
  
  # Verify custom vocabulary is set
  vocab <- get_project_vocabulary(project_id)
  expect_equal(nrow(vocab), 2)
  
  # Delete vocabulary (reset to default)
  result <- delete_project_vocabulary(project_id)
  
  # Result should be a list
  expect_type(result, "list")
  
  # Verify vocabulary was reset to default (should have more than 2 terms)
  default_vocab <- get_project_vocabulary(project_id)
  expect_true(nrow(default_vocab) > 2)
  expect_true("NATIVE" %in% default_vocab$term)
  expect_true("INTRODUCED" %in% default_vocab$term)
  expect_true("MANAGED" %in% default_vocab$term)
  
  # Clean up
  delete_project(project_id)
})

test_that("vocabulary validation works", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test project
  p <- make_project(name="test vocabulary validation", description = "test validation")
  project_id <- p$id
  
  # Try to update without SUSPICIOUS term (should fail with HTTP 400)
  invalid_vocab <- list(
    list(term = "NATIVE", description = "Native", color = "#22c55e", locked = FALSE)
  )
  
  # Should get an error (HTTP 400)
  expect_error(
    update_project_vocabulary(project_id, invalid_vocab)
  )
  
  # Clean up
  delete_project(project_id)
})
