# Make a comment on rule.

Make a comment on rule.

## Usage

``` r
make_rule_comment(id = NULL, comment = NULL, user = NULL, pwd = NULL)
```

## Arguments

- id:

  id of the rule you want to leave a comment on.

- comment:

  comment.

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

## Value

A \`tibble\`.

## Examples

``` r
if (FALSE) { # \dontrun{
make_rule_comment(1,"comment")
} # }
```
