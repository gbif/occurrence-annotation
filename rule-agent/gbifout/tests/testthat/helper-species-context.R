species_context_fixture <- function(taxonKey = "3NFRS") {
  list(
    taxonKey = as.character(taxonKey),
    taxon = list(usageKey = as.character(taxonKey),
                 scientificName = "Calopteryx maculata", rank = "SPECIES"),
    distribution = c(stats::setNames(
      rep(list("Unknown"), length(gbifout:::.species_distribution_fields)),
      gbifout:::.species_distribution_fields
    ), list(confidence = "low")),
    evidenceBasis = "model_knowledge_unverified", sources = character(),
    model = "test-strong-model", created = "2026-10-23 UTC"
  )
}
