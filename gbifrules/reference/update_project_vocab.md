# Update project vocabulary

Set or update custom annotation vocabulary for a project. Must be a
project member to update vocabulary.

## Usage

``` r
update_project_vocab(id, vocabulary, user = NULL, pwd = NULL)
```

## Arguments

- id:

  the project id (required).

- vocabulary:

  a list or data frame of vocabulary terms. Each term must have:

  - term: The vocabulary term (will be converted to uppercase)

  - description: Optional description of the term

  - color: Hex color code for the term (e.g., "#ef4444")

  - locked: Logical indicating if term can be deleted (SUSPICIOUS must
    be locked)

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

## Value

a \`list\` with the updated vocabulary.

## Details

Update or replace the custom vocabulary for a project. The vocabulary
must include the "SUSPICIOUS" term with locked=TRUE. Maximum 50 terms
allowed. Terms are automatically normalized to uppercase.

Only project members can update vocabulary. Authentication via GBIF_USER
and GBIF_PWD environment variables is required (or can be provided via
user/pwd parameters).

## Examples

``` r
if (FALSE) { # \dontrun{
# Create custom vocabulary
vocab <- list(
  list(term = "NATIVE", description = "Native species", 
       color = "#22c55e", locked = FALSE),
  list(term = "INTRODUCED", description = "Introduced species", 
       color = "#3b82f6", locked = FALSE),
  list(term = "SUSPICIOUS", description = "Suspicious record", 
       color = "#ef4444", locked = TRUE)
)

update_project_vocab(1, vocab)
} # }
```
