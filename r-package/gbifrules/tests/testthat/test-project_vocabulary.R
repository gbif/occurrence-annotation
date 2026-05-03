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
  vocab <- get_project_vocab(project_id)
  
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
  
  # Create custom vocabulary with custom terms not in default vocabulary
  custom_vocab <- list(
    list(term = "TEST_TERM_1", description = "First test term", color = "#22c55e", locked = FALSE),
    list(term = "TEST_TERM_2", description = "Second test term", color = "#3b82f6", locked = FALSE),
    list(term = "TEST_TERM_3", description = "Third test term", color = "#f59e0b", locked = FALSE),
    list(term = "SUSPICIOUS", description = "Suspicious record", color = "#ef4444", locked = TRUE)
  )
  
  # Update vocabulary
  result <- update_project_vocab(project_id, custom_vocab)
  
  # Result should be a list
  expect_type(result, "list")
  
  # Verify the vocabulary was updated
  updated_vocab <- get_project_vocab(project_id)
  expect_equal(nrow(updated_vocab), 4)
  expect_true("TEST_TERM_1" %in% updated_vocab$term)
  expect_true("TEST_TERM_2" %in% updated_vocab$term)
  expect_true("TEST_TERM_3" %in% updated_vocab$term)
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
  
  # Set custom vocabulary first with test terms
  custom_vocab <- list(
    list(term = "TEST_TERM_1", description = "First test term", color = "#00ff00", locked = FALSE),
    list(term = "TEST_TERM_2", description = "Second test term", color = "#0000ff", locked = FALSE),
    list(term = "SUSPICIOUS", description = "Suspicious", color = "#ef4444", locked = TRUE)
  )
  update_project_vocab(project_id, custom_vocab)
  
  # Verify custom vocabulary is set
  vocab <- get_project_vocab(project_id)
  expect_equal(nrow(vocab), 3)
  expect_true("TEST_TERM_1" %in% vocab$term)
  expect_true("TEST_TERM_2" %in% vocab$term)
  
  # Delete vocabulary (reset to default)
  result <- delete_project_vocab(project_id)
  
  # Result should be a list
  expect_type(result, "list")
  
  # Verify vocabulary was reset to default (should have more than 3 terms)
  default_vocab <- get_project_vocab(project_id)
  expect_true(nrow(default_vocab) > 3)
  expect_true("NATIVE" %in% default_vocab$term)
  expect_true("INTRODUCED" %in% default_vocab$term)
  expect_true("MANAGED" %in% default_vocab$term)
  # Custom test terms should no longer be present
  expect_false("TEST_TERM_1" %in% default_vocab$term)
  expect_false("TEST_TERM_2" %in% default_vocab$term)
  
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
    list(term = "TEST_TERM_1", description = "Test term", color = "#22c55e", locked = FALSE)
  )
  
  # Should get an error (HTTP 400)
  expect_error(
    update_project_vocab(project_id, invalid_vocab)
  )
  
  # Clean up
  delete_project(project_id)
})

test_that("vocabulary size limit validation works", {
  skip_on_cran()
  skip_if_offline()
  
  # Create a test project
  p <- make_project(name="test vocab size limit", description = "test size limit validation")
  project_id <- p$id
  
  # Create vocabulary with 51 terms (exceeds the 50 term limit)
  large_vocab <- lapply(1:50, function(i) {
    list(term = paste0("TEST_TERM_", i), 
         description = paste("Test term", i), 
         color = "#22c55e", 
         locked = FALSE)
  })
  # Add SUSPICIOUS as the 51st term
  large_vocab[[51]] <- list(term = "SUSPICIOUS", description = "Suspicious", 
                            color = "#ef4444", locked = TRUE)
  
  # Should get an error (HTTP 400) for exceeding max vocabulary size
  expect_error(
    update_project_vocab(project_id, large_vocab)
  )
  
  # Clean up
  delete_project(project_id)
})
