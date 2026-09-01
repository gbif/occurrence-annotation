# Get rules supported by the authenticated user

Returns all non-deleted rules that the currently authenticated user has
supported.

## Usage

``` r
get_supported_rules(limit = NULL, offset = NULL, user = NULL, pwd = NULL, ...)
```

## Arguments

- limit:

  Maximum number of records to return (default: 100).

- offset:

  Number of records to skip for pagination (default: 0).

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

- ...:

  Additional query parameters passed to the API.

## Value

A \`tibble\` of rules supported by the authenticated user.

## Examples

``` r
if (FALSE) { # \dontrun{
# Get all rules supported by authenticated user
get_supported_rules()

# Get first 10 rules with pagination
get_supported_rules(limit = 10, offset = 0)
} # }
```
