details_test_result <- function() {
  structure(list(data = data.frame(
    gbifid = c("1892087089", "5195998433"),
    binWkt = c("POLYGON ((0 0, 1 0, 1 1, 0 0))", "MULTIPOLYGON EMPTY"),
    taxonKey = c("DJX8", "DJX8"),
    decision = c("SUSPICIOUS", "OK"),
    reasonCategory = c("unlikely_location_for_taxon", "none"),
    explanation = c(paste(rep("Full saved explanation.", 30), collapse = " "),
                    "Plausible wild occurrence."),
    model = c("advanced-model", "initial-model")
  )), class = c("gbifout_pipeline", "list"))
}

test_that("details prints all saved fields without truncation and returns rows invisibly", {
  result <- details_test_result()
  local_mocked_bindings(
    .fetch_occurrence_record = function(...) stop("must not fetch"),
    occ_agent = function(...) stop("must not reassess"),
    .package = "gbifout"
  )
  output <- capture.output(value <- withVisible(details(result, 1892087089)))
  expect_false(value$visible)
  expect_identical(value$value, result$data[1, , drop = FALSE])
  expect_match(output[1], "GBIF occurrence 1892087089", fixed = TRUE)
  for (name in names(result$data)) {
    expect_true(any(grepl(result$data[[name]][1], output, fixed = TRUE)))
    expect_true(any(grepl(paste0(name, strrep(" ", max(nchar(names(result$data))) -
                                             nchar(name)), ":"), output, fixed = TRUE)))
  }
  expect_false(any(grepl("5195998433", output, fixed = TRUE)))
})

test_that("details accepts character IDs, numeric stored IDs, and saved unclassed results", {
  result <- unclass(details_test_result())
  path <- withr::local_tempfile(fileext = ".rds")
  saveRDS(result, path)
  capture.output(rows <- details(readRDS(path), "5195998433"))
  expect_identical(rows, result$data[2, , drop = FALSE])
  result$data$gbifid <- as.numeric(result$data$gbifid)
  capture.output(rows <- details(result, "5195998433"))
  expect_identical(rows, result$data[2, , drop = FALSE])
})

test_that("details prints and returns every matching row including additional columns", {
  result <- details_test_result()
  result$data$gbifid[2] <- result$data$gbifid[1]
  result$data$suitability <- c(0.1, NA_real_)
  output <- capture.output(rows <- details(result, "1892087089"))
  expect_identical(rows, result$data)
  expect_true(any(grepl("(match 1/2)", output, fixed = TRUE)))
  expect_true(any(grepl("(match 2/2)", output, fixed = TRUE)))
  expect_true(any(grepl("suitability", output, fixed = TRUE)))
  expect_true(any(grepl("NA", output, fixed = TRUE)))
})

test_that("details reports absent IDs and invalid inputs explicitly", {
  result <- details_test_result()
  expect_error(details(result, 123), "GBIF ID 123 was not found", fixed = TRUE)
  result$data <- result$data[FALSE, ]
  expect_error(details(result, 1892087089), "was not found")
  for (invalid in list(NULL, list(), list(data = data.frame(decision = "OK")))) {
    expect_error(details(invalid, 1892087089), "pipeline result")
  }
  for (invalid in list(NULL, NA, NA_character_, integer(), c(1, 2), "",
                       "abc", "1.5", "0", -1, 0, 1.5, Inf, NaN, TRUE, list(1))) {
    expect_error(details(details_test_result(), invalid), "single positive integer")
  }
})
