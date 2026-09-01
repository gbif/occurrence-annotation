# Update an existing annotation rule

Update an existing annotation rule

## Usage

``` r
update_rule(
  id = NULL,
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
  user = NULL,
  pwd = NULL,
  ...
)
```

## Arguments

- id:

  (integer) Rule ID to update (required).

- taxonKey:

  (integer) GBIF taxonKey for which rule applies to.

- geometry:

  (character) WKT text string defining the geographic boundary of the
  rule.

- annotation:

  (character) Annotation type from controlled vocabulary (e.g.,
  "SUSPICIOUS", "INTRODUCED", "NATIVE").

- basisOfRecord:

  (character vector) Optional vector of basis of record values to which
  the rule applies.

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

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

- ...:

  Additional named parameters to include in the rule payload.

## Value

A list containing the API response with information about the updated
rule.

## Details

Updates an existing annotation rule via the GBIF annotation service API.
Only the rule creator or an admin can update a rule. Cannot update
deleted rules.

If parameters are left NULL, they will not be updated (existing values
will be preserved).

The `annotation` parameter must be from the controlled vocabulary for
the project.

The `basisOfRecord` parameter accepts a character vector that will be
serialized as a JSON array in the API request.

## Examples

``` r
if (FALSE) { # \dontrun{
# Update annotation type only
update_rule(id = 123, annotation = "NATIVE")

# Update multiple fields
update_rule(
  id = 123,
  annotation = "SUSPICIOUS",
  basisOfRecord = c("MACHINE_OBSERVATION"),
  projectId = 456
)
} # }
```
