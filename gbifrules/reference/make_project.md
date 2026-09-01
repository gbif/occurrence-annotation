# Make Project

Make Project

## Usage

``` r
make_project(name = NULL, description = NULL, user = NULL, pwd = NULL)
```

## Arguments

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

The projectId of the project.

## Examples

``` r
if (FALSE) { # \dontrun{
make_project("Example project","An example Project")
} # }
```
