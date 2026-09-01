# Remove support for a rule

Remove support for a rule

## Usage

``` r
rm_support_rule(id = NULL, user = NULL, pwd = NULL)
```

## Arguments

- id:

  the id of the rule to updated.

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

## Value

A \`list\` information about the rule supported.

## Examples

``` r
if (FALSE) { # \dontrun{
rm_support_rule(1)
} # }
```
