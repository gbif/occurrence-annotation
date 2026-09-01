test_that("get_col_metadata returns DOI for COL Extended Release", {
  skip_on_cran()
  
  doi <- get_col_metadata()
  
  expect_type(doi, "character")
  expect_match(doi, "^10\\.")  # DOIs start with "10."
  expect_true(nchar(doi) > 5)  # Reasonable DOI length
})

test_that("get_col_metadata caches results", {
  skip_on_cran()
  
  # Clear cache
  rm(list = ls(.gbifrules_cache), envir = .gbifrules_cache)
  
  # First call - should hit API
  doi1 <- get_col_metadata()
  
  # Second call - should use cache
  doi2 <- get_col_metadata()
  
  expect_equal(doi1, doi2)
  
  # Check cache exists
  cache_key <- "doi_7ddf754f-d193-4cc9-b351-99906754a03b"
  expect_true(exists(cache_key, envir = .gbifrules_cache))
})

test_that("get_col_metadata returns NULL gracefully on API errors", {
  skip_on_cran()
  
  # Use invalid dataset key to trigger error
  doi <- suppressWarnings(get_col_metadata("invalid-uuid-12345"))
  
  expect_null(doi)
})

test_that("get_col_metadata works with custom dataset keys", {
  skip_on_cran()
  
  # Use a valid GBIF dataset UUID (GBIF Backbone Taxonomy)
  doi <- get_col_metadata("d7dddbf4-2cf0-4f39-9b2a-bb099caae36c")
  
  expect_type(doi, "character")
  expect_match(doi, "^10\\.")
})
