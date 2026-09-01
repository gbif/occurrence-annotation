# Delete a project

Delete a project

## Usage

``` r
delete_project(id, user = NULL, pwd = NULL)
```

## Arguments

- id:

  the id of the project

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

## Value

list of information about deleted project

## Examples

``` r
if (FALSE) { # \dontrun{
delete_project(1)
} # }
```
