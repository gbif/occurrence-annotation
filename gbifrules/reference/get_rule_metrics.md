# Get aggregated rule metrics

Returns aggregated metrics about rules including count of rules,
datasets, projects, taxa, supports, and contests. Can be filtered by
various parameters.

## Usage

``` r
get_rule_metrics(
  username = NULL,
  taxonKey = NULL,
  datasetKey = NULL,
  rulesetId = NULL,
  projectId = NULL
)
```

## Arguments

- username:

  (character) Optional username to filter metrics for a specific user.

- taxonKey:

  (integer) Optional taxon key to filter by.

- datasetKey:

  (character) Optional dataset key to filter by.

- rulesetId:

  (integer) Optional ruleset ID to filter by.

- projectId:

  (integer) Optional project ID to filter by.

## Value

A \`tibble\` with columns: ruleCount, datasetCount, projectCount,
taxonCount, supportCount, contestCount, usernameCount.

## Examples

``` r
if (FALSE) { # \dontrun{
# Get overall metrics
get_rule_metrics()

# Get metrics for a specific user
get_rule_metrics(username = "jwaller")

# Get metrics for a specific project
get_rule_metrics(projectId = 123)
} # }
```
