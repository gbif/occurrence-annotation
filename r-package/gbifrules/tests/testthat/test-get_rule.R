
test_that("test get rule works as expected", {
  skip_on_cran()
    
    r1 <- get_rule(taxonKey=-999999, 
                  geometry="get_rule_WKT", 
                  annotation="SUSPICIOUS",
                  basisOfRecord=NULL, 
                  yearRange=NULL,
                  datasetKey=NULL
                  ) 
    if(nrow(r1) == 0) {
      make_rule(taxonKey=-999999,geometry="get_rule_WKT",annotation="SUSPICIOUS")
      r1 <- get_rule(taxonKey=-999999,
                     geometry="get_rule_WKT",
                     annotation="SUSPICIOUS",
                     basisOfRecord=NULL,
                     yearRange=NULL,
                     datasetKey=NULL)
    }
    expect_s3_class(r1,"tbl_df")
    expect_equal(nrow(r1),1)
    expect_true(all(r1$taxonKey == -999999))
    expect_true(all(r1$annotation == "SUSPICIOUS"))
    
    r2 <- get_rule(taxonKey=-999999, 
                  geometry="get_rule_WKT", 
                  annotation="SUSPICIOUS",
                  basisOfRecord="HUMAN_OBSERVATION",
                  yearRange=NULL,
                  datasetKey=NULL
                  )
    if(nrow(r2) == 0) {
      make_rule(taxonKey=-999999,geometry="get_rule_WKT",annotation="SUSPICIOUS",basisOfRecord="HUMAN_OBSERVATION")
      r2 <- get_rule(taxonKey=-999999,geometry="get_rule_WKT",annotation="SUSPICIOUS",basisOfRecord="HUMAN_OBSERVATION")
    }
    expect_true(all(r2$taxonKey == -999999))
    expect_true(all(r2$annotation == "SUSPICIOUS"))
    expect_true(all(r2$basisOfRecord == "HUMAN_OBSERVATION"))
    
    r3 <- get_rule(taxonKey=-999999, 
                  geometry="get_rule_WKT", 
                  annotation="SUSPICIOUS",
                  basisOfRecord=NULL,
                  yearRange="<1800",
                  datasetKey=NULL
                  )
    if(nrow(r3) == 0) {
      make_rule(taxonKey=-999999,geometry="get_rule_WKT",annotation="SUSPICIOUS",yearRange="<1800")
      r3 <- get_rule(taxonKey=-999999,geometry="get_rule_WKT",annotation="SUSPICIOUS",yearRange="<1800")
    }
    expect_s3_class(r3,"tbl_df") 
    expect_equal(nrow(r3),1)
    expect_true(all(r3$taxonKey == -999999))
    expect_true(all(r3$annotation == "SUSPICIOUS"))
    expect_true(all(r3$yearRange == "<1800"))

    r4 <- get_rule(taxonKey=-999999, 
                  geometry="get_rule_WKT", 
                  annotation="SUSPICIOUS",
                  basisOfRecord=NULL,
                  yearRange=NULL,
                  datasetKey="4fa7b334-ce0d-4e88-aaae-2e0c138d049e"
                  )
    if(nrow(r4) == 0) {
      make_rule(taxonKey=-999999,geometry="get_rule_WKT",annotation="SUSPICIOUS",datasetKey="4fa7b334-ce0d-4e88-aaae-2e0c138d049e")
      r4 <- get_rule(taxonKey=-999999,geometry="get_rule_WKT",annotation="SUSPICIOUS",datasetKey="4fa7b334-ce0d-4e88-aaae-2e0c138d049e")
    }
    expect_s3_class(r4,"tbl_df")
    expect_equal(nrow(r4),1)
    expect_true(all(r4$taxonKey == -999999))
    expect_true(all(r4$annotation == "SUSPICIOUS"))
    expect_true(all(r4$datasetKey == "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"))
    
})
