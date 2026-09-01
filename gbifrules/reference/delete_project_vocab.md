# Delete project vocabulary

Reset a project's vocabulary to the default system vocabulary. Removes
any custom vocabulary terms that were defined for the project.

## Usage

``` r
delete_project_vocab(id, user = NULL, pwd = NULL)
```

## Arguments

- id:

  the project id (required).

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

## Value

a \`list\` with the default vocabulary terms.

## Details

Removes the custom vocabulary from a project and reverts to the default
system vocabulary. Only project members can reset vocabulary.
Authentication via GBIF_USER and GBIF_PWD environment variables is
required (or can be provided via user/pwd parameters).

The default vocabulary includes: NATIVE, INTRODUCED, MANAGED, FORMER,
VAGRANT, SUSPICIOUS, and OTHER.

## Examples

``` r
if (FALSE) { # \dontrun{
# Reset project 1 to default vocabulary
delete_project_vocab(1)
} # }
```
