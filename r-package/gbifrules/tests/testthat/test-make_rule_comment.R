test_that("test make rule comment works as expected", {
  skip_on_cran()
    
r <- get_rule(taxonKey = -6000, 
              geometry = "WKT", 
              annotation = "NATIVE",
              basisOfRecord=NULL,
              yearRange=NULL,
              datasetKey=NULL) 
if(nrow(r)==0) {
  r <- make_rule(taxonKey = -6000, 
                  geometry = "WKT", 
                  annotation = "NATIVE") 
}
c <- make_rule_comment(id=r$id,"test comment")
expect_type(c,"list")
expect_true(c$ruleId == r$id)
expect_true(c$comment == "test comment")

c1 <- make_rule_comment(id=r$id,"test comment 1")
expect_type(c1,"list")
expect_equal(c1$ruleId,r$id)
expect_equal(c1$comment,"test comment 1")

# clean up comments
delete_rule_comment(ruleId=r$id, commentId=c$id)
delete_rule_comment(ruleId=r$id, commentId=c1$id)

})
