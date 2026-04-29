# Create a new annotation rule

Create a new annotation rule

## Usage

``` r
make_rule(
  taxonKey = NULL,
  geometry = NULL,
  annotation = NULL,
  basisOfRecord = NULL,
  basisOfRecordNegated = NULL,
  yearRange = NULL,
  rulesetId = NULL,
  projectId = NULL,
  supportedBy = NULL,
  contestedBy = NULL,
  created = NULL,
  createdBy = NULL,
  deleted = NULL,
  deletedBy = NULL,
  ...
)
```

## Arguments

- taxonKey:

  (integer) GBIF taxonKey for which rule applies to (required).

- geometry:

  (character) WKT text string defining the geographic boundary of the
  rule (required).

- annotation:

  (character) Annotation type from controlled vocabulary (e.g.,
  "SUSPICIOUS", "INTRODUCED", "NATIVE") (required).

- basisOfRecord:

  (character vector) Optional vector of basis of record values to which
  the rule applies (e.g., c("MACHINE_OBSERVATION",
  "HUMAN_OBSERVATION")).

- basisOfRecordNegated:

  (logical) Optional flag to negate the basisOfRecord filter.

- yearRange:

  (character) Optional year range in format "start,end" (e.g.,
  "2000,2023") for temporal filtering.

- rulesetId:

  (character or integer) Optional ID of the ruleset this rule belongs
  to.

- projectId:

  (character or integer) Optional ID of the project this rule belongs
  to.

- supportedBy:

  (character vector) Optional vector of user IDs who support this rule.

- contestedBy:

  (character vector) Optional vector of user IDs who contest this rule.

- created:

  (character) Optional creation timestamp (ISO format).

- createdBy:

  (character) Optional user ID of rule creator. If not provided,
  automatically set from GBIF_USER environment variable.

- deleted:

  (character) Optional deletion timestamp (ISO format).

- deletedBy:

  (character) Optional user ID who deleted the rule.

- ...:

  Additional named parameters to include in the rule payload.

## Value

A list containing the API response with information about the created
rule.

## Details

Creates a new annotation rule via the GBIF annotation service API. The
rule defines a geographic area (via WKT geometry) and taxonomic scope
(via taxonKey) where occurrences should be flagged with the specified
annotation type.

The `annotation` parameter must be from the controlled vocabulary (e.g.,
"SUSPICIOUS", "INTRODUCED", "NATIVE").

The `basisOfRecord` parameter accepts a character vector that will be
serialized as a JSON array in the API request.

## Examples

``` r
if (FALSE) { # \dontrun{
# Simple rule with required parameters
make_rule(
  taxonKey = 1,
  geometry = "POLYGON ((30 10, 40 40, 20 40, 10 20, 30 10))", 
  annotation = "NATIVE"
)

# Complex rule with basis of record filter
make_rule(
  taxonKey = 12345,
  geometry = "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))",
  annotation = "SUSPICIOUS",
  basisOfRecord = c("MACHINE_OBSERVATION", "HUMAN_OBSERVATION"),
  createdBy = "user@example.com"
)
} # }
```
