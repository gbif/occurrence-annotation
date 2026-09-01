# Remove contest of a rule

Remove contest of a rule

## Usage

``` r
rm_contest_rule(id, user = NULL, pwd = NULL)
```

## Arguments

- id:

  id of rule to contest.

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

## Value

A \`list\` information about the rule contested.

## Examples

``` r
if (FALSE) { # \dontrun{
rm_contest_rule(1)
} # }
```
