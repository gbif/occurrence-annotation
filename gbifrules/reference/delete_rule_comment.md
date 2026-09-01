# Delete a rule comment

Delete a rule comment

## Usage

``` r
delete_rule_comment(ruleId, commentId, user = NULL, pwd = NULL)
```

## Arguments

- ruleId:

  The ID of the rule that the comment belongs to

- commentId:

  The ID of the comment to delete

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

## Value

Nothing (invisible NULL)

## Examples

``` r
if (FALSE) { # \dontrun{
delete_rule_comment(ruleId = 1, commentId = 5)
} # }
```
