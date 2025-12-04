
test_that("test get rule works as expected", {
    
    r <- get_rule(taxonKey=-999999) 
    if(!nrow(r) == 4) {
      # fake taxonKey for test rules 
      r1 <- make_rule(taxonKey=-999999,geometry="WKT",annotation="SUSPICIOUS")
      r2 <- make_rule(taxonKey=-999999,geometry="WKT",annotation="SUSPICIOUS",basisOfRecord="HUMAN_OBSERVATION")
      r3 <- make_rule(taxonKey=-999999,geometry="WKT",annotation="SUSPICIOUS",yearRange="<1800")
      r4 <- make_rule(taxonKey=-999999,geometry="WKT",annotation="SUSPICIOUS",datasetKey="4fa7b334-ce0d-4e88-aaae-2e0c138d049e")
    }
    
    gr1 <- get_rule(taxonKey=-999999,annotation="SUSPICIOUS")
    expect_s3_class(gr1,"tbl_df")
    expect_equal(nrow(gr1),4)
    expect_true(all(gr1$taxonKey == -999999))
    expect_true(all(gr1$annotation == "SUSPICIOUS"))

    gr2 <- get_rule(taxonKey=-999999,annotation="SUSPICIOUS",basisOfRecord="HUMAN_OBSERVATION")
    expect_s3_class(gr2,"tbl_df")
    expect_equal(nrow(gr2),1)
    expect_true(all(gr2$taxonKey == -999999))
    expect_true(all(gr2$annotation == "SUSPICIOUS"))
    expect_true(all(gr2$basisOfRecord == "HUMAN_OBSERVATION"))

    gr3 <- get_rule(taxonKey=-999999,annotation="SUSPICIOUS",yearRange="<1800")
    expect_s3_class(gr3,"tbl_df") 
    expect_equal(nrow(gr3),1)
    expect_true(all(gr3$taxonKey == -999999))
    expect_true(all(gr3$annotation == "SUSPICIOUS"))
    expect_true(all(gr3$yearRange == "<1800"))

    gr4 <- get_rule(taxonKey=-999999,annotation="SUSPICIOUS",datasetKey="4fa7b334-ce0d-4e88-aaae-2e0c138d049e")
    expect_s3_class(gr4,"tbl_df")
    expect_equal(nrow(gr4),1)
    expect_true(all(gr4$taxonKey == -999999))
    expect_true(all(gr4$annotation == "SUSPICIOUS"))
    expect_true(all(gr4$datasetKey == "4fa7b334-ce0d-4e88-aaae-2e0c138d049e"))
    
})
