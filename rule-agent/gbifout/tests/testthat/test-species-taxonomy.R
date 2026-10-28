test_that("numeric occurrence keys are cross-checked against COL profile keys", {
  profile <- species_context_fixture("4JPVZ")
  profile$taxon$scientificName <- "Platycnemis pennipes (Pallas, 1771)"
  profile$taxon$verbatim_checklistKey <- "col-checklist"
  record <- list(taxonKey = 1423859, acceptedTaxonKey = 1423859,
                 acceptedScientificName = "Platycnemis pennipes (Pallas, 1771)",
                 taxonRank = "SPECIES", genus = "Platycnemis", kingdom = "Animalia")
  lookups <- 0
  local_mocked_bindings(
    name_backbone = function(name, rank, strict, checklistKey, genus, kingdom) {
      lookups <<- lookups + 1
      expect_identical(name, record$acceptedScientificName)
      expect_identical(rank, "SPECIES")
      expect_true(strict)
      expect_identical(checklistKey, "col-checklist")
      expect_identical(genus, "Platycnemis")
      expect_identical(kingdom, "Animalia")
      data.frame(usageKey = "4JPVZ", rank = "SPECIES", matchType = "EXACT")
    }, .package = "rgbif"
  )
  local_mocked_bindings(
    .fetch_occurrence_record = function(...) record,
    .country_centroid_context = function(...) NULL,
    .request_record_triage = function(input, ...) {
      expect_identical(input$speciesContext, profile)
      list(decision = "OK")
    }, .package = "gbifout"
  )
  expect_identical(occ_agent(932144029, apiKey = "test", speciesContext = profile)$speciesContext,
                   profile)
  expect_equal(lookups, 1)
})

test_that("cross-check rejects fuzzy, higher-rank, missing and unrelated matches", {
  profile <- species_context_fixture("4JPVZ")
  record <- list(scientificName = "Platycnemis pennipes", taxonRank = "SPECIES")
  response <- data.frame(usageKey = "other", rank = "SPECIES", matchType = "EXACT")
  local_mocked_bindings(name_backbone = function(...) response, .package = "rgbif")
  matches <- function() gbifout:::.record_matches_species_context(record, profile)
  expect_false(matches())
  response$usageKey <- "4JPVZ"
  response$matchType <- "FUZZY"
  expect_false(matches())
  response$matchType <- "EXACT"
  response$rank <- "GENUS"
  expect_false(matches())
  response <- data.frame()
  expect_false(matches())
  local_mocked_bindings(name_backbone = function(...) stop("offline"), .package = "rgbif")
  expect_error(matches(), "Record taxon cross-check failed: offline", fixed = TRUE)
  record <- list(taxonKey = 1423859)
  expect_false(matches())
})

test_that("exact synonym and descendant resolutions retain taxonomy containment", {
  profile <- species_context_fixture("4JPVZ")
  record <- list(scientificName = "A synonym", taxonRank = "SPECIES")
  response <- data.frame(usageKey = "synonym", acceptedUsageKey = "4JPVZ",
                         rank = "SPECIES", matchType = "EXACT")
  local_mocked_bindings(name_backbone = function(...) response, .package = "rgbif")
  expect_true(gbifout:::.record_matches_species_context(record, profile))
  response <- data.frame(usageKey = "subspecies", speciesKey = "4JPVZ",
                         rank = "SUBSPECIES", matchType = "EXACT")
  record$taxonRank <- "SUBSPECIES"
  expect_true(gbifout:::.record_matches_species_context(record, profile))
})
