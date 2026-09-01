# Make Ruleset

Make Ruleset

## Usage

``` r
make_ruleset(
  projectId = NULL,
  name = NULL,
  description = NULL,
  user = NULL,
  pwd = NULL
)
```

## Arguments

- projectId:

  the id of the project the ruleset should belong to.

- name:

  the name of the project.

- description:

  describe the project.

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

## Value

The rulesetId and projectId of the ruleset as a list.

## Examples

``` r
if (FALSE) { # \dontrun{
make_ruleset(1,"Name of project","Example description")
} # }
```
