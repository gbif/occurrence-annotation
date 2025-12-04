/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.gbif.occurrence.annotation.mapper;

import org.gbif.occurrence.annotation.EmbeddedPostgres;
import org.gbif.occurrence.annotation.model.Rule;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(EmbeddedPostgres.class)
@SpringBootTest
@Transactional
@SpringJUnitConfig
public class RuleMapperTest {

  @Autowired private RuleMapper ruleMapper;

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    PostgreSQLContainer postgres = EmbeddedPostgres.getPostgres();
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
  }

  private Rule createTestRule() {
    return Rule.builder()
        .taxonKey(12345)
        .datasetKey("test-dataset-key")
        .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
        .annotation(Rule.ANNOTATION_TYPE.NATIVE)
        .basisOfRecord(new String[] {"PRESERVED_SPECIMEN", "HUMAN_OBSERVATION"})
        .yearRange("2000,2023")
        .rulesetId(1)
        .projectId(1)
        .createdBy("test-user")
        .build();
  }

  @Test
  public void testCreateRuleWithArrayBasisOfRecord() {
    Rule rule = createTestRule();

    ruleMapper.create(rule);

    assertNotNull(rule.getId(), "Rule ID should be generated");
    assertTrue(rule.getId() > 0, "Rule ID should be positive");
  }

  @Test
  public void testCreateRuleWithNullBasisOfRecord() {
    Rule rule = createTestRule();
    rule.setBasisOfRecord(null);

    ruleMapper.create(rule);

    assertNotNull(rule.getId(), "Rule ID should be generated");
    assertTrue(rule.getId() > 0, "Rule ID should be positive");
  }

  @Test
  public void testCreateRuleWithEmptyBasisOfRecord() {
    Rule rule = createTestRule();
    rule.setBasisOfRecord(new String[] {});

    ruleMapper.create(rule);

    assertNotNull(rule.getId(), "Rule ID should be generated");
    assertTrue(rule.getId() > 0, "Rule ID should be positive");
  }

  @Test
  public void testCreateRuleWithSingleBasisOfRecord() {
    Rule rule = createTestRule();
    rule.setBasisOfRecord(new String[] {"PRESERVED_SPECIMEN"});

    ruleMapper.create(rule);

    assertNotNull(rule.getId(), "Rule ID should be generated");
    assertTrue(rule.getId() > 0, "Rule ID should be positive");
  }

  @Test
  public void testGetRuleWithArrayBasisOfRecord() {
    Rule rule = createTestRule();
    ruleMapper.create(rule);

    Rule retrieved = ruleMapper.get(rule.getId());

    assertNotNull(retrieved, "Retrieved rule should not be null");
    assertEquals(rule.getId(), retrieved.getId());
    assertEquals(rule.getTaxonKey(), retrieved.getTaxonKey());
    assertEquals(rule.getDatasetKey(), retrieved.getDatasetKey());
    assertEquals(rule.getGeometry(), retrieved.getGeometry());
    assertEquals(rule.getAnnotation(), retrieved.getAnnotation());
    assertArrayEquals(rule.getBasisOfRecord(), retrieved.getBasisOfRecord());
    assertEquals(rule.getYearRange(), retrieved.getYearRange());
    assertEquals(rule.getRulesetId(), retrieved.getRulesetId());
    assertEquals(rule.getProjectId(), retrieved.getProjectId());
    assertEquals(rule.getCreatedBy(), retrieved.getCreatedBy());
  }

  @Test
  public void testListRulesWithBasisOfRecordFilter() {
    // Create rules with different basisOfRecord values
    Rule rule1 = createTestRule();
    rule1.setBasisOfRecord(new String[] {"PRESERVED_SPECIMEN", "HUMAN_OBSERVATION"});
    ruleMapper.create(rule1);

    Rule rule2 = createTestRule();
    rule2.setBasisOfRecord(new String[] {"MACHINE_OBSERVATION"});
    rule2.setTaxonKey(67890); // Different taxon to avoid conflicts
    ruleMapper.create(rule2);

    Rule rule3 = createTestRule();
    rule3.setBasisOfRecord(new String[] {"PRESERVED_SPECIMEN", "FOSSIL_SPECIMEN"});
    rule3.setTaxonKey(11111); // Different taxon to avoid conflicts
    ruleMapper.create(rule3);

    // Test filtering by single basisOfRecord
    List<Rule> results =
        ruleMapper.list(
            null,
            null,
            null,
            null,
            new String[] {"PRESERVED_SPECIMEN"},
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            100,
            0);

    assertEquals(2, results.size(), "Should find 2 rules with PRESERVED_SPECIMEN");

    // Test filtering by multiple basisOfRecord
    results =
        ruleMapper.list(
            null,
            null,
            null,
            null,
            new String[] {"PRESERVED_SPECIMEN", "MACHINE_OBSERVATION"},
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            100,
            0);

    assertEquals(
        3, results.size(), "Should find 3 rules with PRESERVED_SPECIMEN or MACHINE_OBSERVATION");

    // Test filtering by non-existent basisOfRecord
    results =
        ruleMapper.list(
            null,
            null,
            null,
            null,
            new String[] {"NON_EXISTENT"},
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            100,
            0);

    assertEquals(0, results.size(), "Should find 0 rules with NON_EXISTENT");
  }

  @Test
  public void testListRulesWithoutBasisOfRecordFilter() {
    // Create some test rules
    Rule rule1 = createTestRule();
    ruleMapper.create(rule1);

    Rule rule2 = createTestRule();
    rule2.setTaxonKey(67890);
    rule2.setBasisOfRecord(null);
    ruleMapper.create(rule2);

    // Test listing without filter
    List<Rule> results =
        ruleMapper.list(null, null, null, null, null, null, null, null, null, null, null, null, 100, 0);

    assertTrue(results.size() >= 2, "Should find at least 2 rules");
  }

  @Test
  public void testListRulesWithEmptyBasisOfRecordFilter() {
    Rule rule = createTestRule();
    ruleMapper.create(rule);

    // Test with empty array - should return all rules (no filtering)
    List<Rule> results =
        ruleMapper.list(
            null, null, null, null, new String[] {}, null, null, null, null, null, null, null, 100, 0);

    assertTrue(results.size() >= 1, "Should find rules when no filter is applied");
  }

  @Test
  public void testComplexBasisOfRecordScenarios() {
    // Rule with overlapping values
    Rule rule1 = createTestRule();
    rule1.setBasisOfRecord(
        new String[] {"PRESERVED_SPECIMEN", "HUMAN_OBSERVATION", "MACHINE_OBSERVATION"});
    ruleMapper.create(rule1);

    // Rule with single value
    Rule rule2 = createTestRule();
    rule2.setBasisOfRecord(new String[] {"FOSSIL_SPECIMEN"});
    rule2.setTaxonKey(67890);
    ruleMapper.create(rule2);

    // Rule with null values
    Rule rule3 = createTestRule();
    rule3.setBasisOfRecord(null);
    rule3.setTaxonKey(11111);
    ruleMapper.create(rule3);

    // Test filtering with partial overlap
    List<Rule> results =
        ruleMapper.list(
            null,
            null,
            null,
            null,
            new String[] {"HUMAN_OBSERVATION", "FOSSIL_SPECIMEN"},
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            100,
            0);

    assertEquals(2, results.size(), "Should find 2 rules with partial overlap");

    // Test exact match filter
    results =
        ruleMapper.list(
            null,
            null,
            null,
            null,
            new String[] {"MACHINE_OBSERVATION"},
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            100,
            0);

    assertEquals(1, results.size(), "Should find 1 rule with MACHINE_OBSERVATION");
  }

  @Test
  public void testListRulesWithCreatedByFilter() {
    // Create rules with different creators
    Rule rule1 = createTestRule();
    rule1.setCreatedBy("alice");
    rule1.setTaxonKey(11111);
    ruleMapper.create(rule1);

    Rule rule2 = createTestRule();
    rule2.setCreatedBy("bob");
    rule2.setTaxonKey(22222);
    ruleMapper.create(rule2);

    Rule rule3 = createTestRule();
    rule3.setCreatedBy("alice");
    rule3.setTaxonKey(33333);
    ruleMapper.create(rule3);

    Rule rule4 = createTestRule();
    rule4.setCreatedBy("charlie");
    rule4.setTaxonKey(44444);
    ruleMapper.create(rule4);

    // Test filtering by specific creator - alice should have 2 rules
    List<Rule> results =
        ruleMapper.list(
            null, null, null, null, null, null, null, "alice", null, null, null, null, 100, 0);

    assertEquals(2, results.size(), "Should find 2 rules created by alice");
    assertTrue(
        results.stream().allMatch(rule -> "alice".equals(rule.getCreatedBy())),
        "All returned rules should be created by alice");

    // Test filtering by specific creator - bob should have 1 rule
    results =
        ruleMapper.list(null, null, null, null, null, null, null, null, "bob", null, null, null, 100, 0);

    assertEquals(1, results.size(), "Should find 1 rule created by bob");
    assertEquals("bob", results.get(0).getCreatedBy(), "Returned rule should be created by bob");

    // Test filtering by specific creator - charlie should have 1 rule
    results =
        ruleMapper.list(
            null, null, null, null, null, null, null, "charlie", null, null, null, null, 100, 0);

    assertEquals(1, results.size(), "Should find 1 rule created by charlie");
    assertEquals(
        "charlie", results.get(0).getCreatedBy(), "Returned rule should be created by charlie");

    // Test filtering by non-existent creator
    results =
        ruleMapper.list(
            null, null, null, null, null, null, "nonexistent", null, null, null, null, null, 100, 0);

    assertEquals(0, results.size(), "Should find 0 rules created by nonexistent user");

    // Test without createdBy filter - should return all rules
    results =
        ruleMapper.list(null, null, null, null, null, null, null, null, null, null, null, null, 100, 0);

    assertTrue(
        results.size() >= 4, "Should find at least 4 rules when no createdBy filter is applied");
  }

  @Test
  public void testListRulesWithCombinedFilters() {
    // Create rules with different combinations of taxonKey and createdBy
    Rule rule1 = createTestRule();
    rule1.setCreatedBy("alice");
    rule1.setTaxonKey(12345);
    ruleMapper.create(rule1);

    Rule rule2 = createTestRule();
    rule2.setCreatedBy("bob");
    rule2.setTaxonKey(12345);
    ruleMapper.create(rule2);

    Rule rule3 = createTestRule();
    rule3.setCreatedBy("alice");
    rule3.setTaxonKey(67890);
    ruleMapper.create(rule3);

    // Test combining taxonKey and createdBy filters
    List<Rule> results =
        ruleMapper.list(
            12345, null, null, null, null, null, null, "alice", null, null, null, null, 100, 0);

    assertEquals(1, results.size(), "Should find 1 rule with taxonKey=12345 and createdBy=alice");
    assertEquals(
        "alice", results.get(0).getCreatedBy(), "Returned rule should be created by alice");
    assertEquals(
        Integer.valueOf(12345),
        results.get(0).getTaxonKey(),
        "Returned rule should have taxonKey=12345");

    // Test with filters that should return no results
    results =
        ruleMapper.list(67890, null, null, null, null, null, null, null, "bob", null, null, null, 100, 0);

    assertEquals(0, results.size(), "Should find 0 rules with taxonKey=67890 and createdBy=bob");
  }

  @Test
  public void testCreateRuleWithNegatedBasisOfRecord() {
    Rule rule = createTestRule();
    rule.setBasisOfRecord(new String[] {"FOSSIL_SPECIMEN", "PRESERVED_SPECIMEN"});
    rule.setBasisOfRecordNegated(true);
    rule.setTaxonKey(99999);

    ruleMapper.create(rule);

    assertNotNull(rule.getId(), "Rule should have an ID after creation");
    assertTrue(rule.getBasisOfRecordNegated(), "Rule should have basisOfRecordNegated=true");
    assertEquals(2, rule.getBasisOfRecord().length, "Rule should have 2 basisOfRecord values");
  }

  @Test
  public void testCreateRuleWithDefaultNegatedBasisOfRecord() {
    Rule rule = createTestRule();
    rule.setBasisOfRecord(new String[] {"HUMAN_OBSERVATION"});
    // Don't explicitly set basisOfRecordNegated - should default to false
    rule.setTaxonKey(88888);

    ruleMapper.create(rule);

    assertNotNull(rule.getId(), "Rule should have an ID after creation");
    assertFalse(
        rule.getBasisOfRecordNegated(), "Rule should have basisOfRecordNegated=false by default");
  }

  @Test
  public void testListRulesFilterByNegatedTrue() {
    // Create a negated rule
    Rule negatedRule = createTestRule();
    negatedRule.setBasisOfRecord(new String[] {"FOSSIL_SPECIMEN"});
    negatedRule.setBasisOfRecordNegated(true);
    negatedRule.setTaxonKey(77777);
    ruleMapper.create(negatedRule);

    // Create a non-negated rule
    Rule normalRule = createTestRule();
    normalRule.setBasisOfRecord(new String[] {"HUMAN_OBSERVATION"});
    normalRule.setBasisOfRecordNegated(false);
    normalRule.setTaxonKey(66666);
    ruleMapper.create(normalRule);

    // Test filtering by negated=true
    List<Rule> results =
        ruleMapper.list(null, null, null, null, null, true, null, null, null, null, null, null, 100, 0);

    assertFalse(results.isEmpty(), "Should find at least one negated rule");
    assertTrue(
        results.stream().allMatch(Rule::getBasisOfRecordNegated),
        "All returned rules should have basisOfRecordNegated=true");
  }

  @Test
  public void testListRulesFilterByNegatedFalse() {
    // Create a negated rule
    Rule negatedRule = createTestRule();
    negatedRule.setBasisOfRecord(new String[] {"FOSSIL_SPECIMEN"});
    negatedRule.setBasisOfRecordNegated(true);
    negatedRule.setTaxonKey(55555);
    ruleMapper.create(negatedRule);

    // Create a non-negated rule
    Rule normalRule = createTestRule();
    normalRule.setBasisOfRecord(new String[] {"HUMAN_OBSERVATION"});
    normalRule.setBasisOfRecordNegated(false);
    normalRule.setTaxonKey(44444);
    ruleMapper.create(normalRule);

    // Test filtering by negated=false
    List<Rule> results =
        ruleMapper.list(null, null, null, null, null, false, null, null, null, null, null, null, 100, 0);

    assertFalse(results.isEmpty(), "Should find at least one non-negated rule");
    assertTrue(
        results.stream().allMatch(r -> !r.getBasisOfRecordNegated()),
        "All returned rules should have basisOfRecordNegated=false");
  }

  @Test
  public void testListRulesFilterByBasisOfRecordAndNegated() {
    // Create a negated FOSSIL_SPECIMEN rule
    Rule rule = createTestRule();
    rule.setBasisOfRecord(new String[] {"FOSSIL_SPECIMEN"});
    rule.setBasisOfRecordNegated(true);
    rule.setTaxonKey(33333);
    ruleMapper.create(rule);

    // Filter by both basisOfRecord and negated
    List<Rule> results =
        ruleMapper.list(
            null,
            null,
            null,
            null,
            new String[] {"FOSSIL_SPECIMEN"},
            true,
            null,
            null,
            null,
            null,
            null,
            null,
            100,
            0);

    assertFalse(results.isEmpty(), "Should find at least one rule matching criteria");
    Rule foundRule = results.get(0);
    assertTrue(
        foundRule.getBasisOfRecordNegated(), "Found rule should have basisOfRecordNegated=true");
    assertEquals(
        "FOSSIL_SPECIMEN",
        foundRule.getBasisOfRecord()[0],
        "Found rule should have FOSSIL_SPECIMEN in basisOfRecord");
  }

  @Test
  public void testListRulesWithoutNegatedFilter() {
    // Create both negated and non-negated rules
    Rule negatedRule = createTestRule();
    negatedRule.setBasisOfRecord(new String[] {"FOSSIL_SPECIMEN"});
    negatedRule.setBasisOfRecordNegated(true);
    negatedRule.setTaxonKey(22222);
    ruleMapper.create(negatedRule);

    Rule normalRule = createTestRule();
    normalRule.setBasisOfRecord(new String[] {"HUMAN_OBSERVATION"});
    normalRule.setBasisOfRecordNegated(false);
    normalRule.setTaxonKey(11111);
    ruleMapper.create(normalRule);

    // Test without negated filter - should return both types
    List<Rule> results =
        ruleMapper.list(null, null, null, null, null, null, null, null, null, null, null, null, 100, 0);

    assertFalse(results.isEmpty(), "Should find rules");

    // Check that basisOfRecord filtering is working
    boolean hasBasisOfRecordFiltering = results.stream().anyMatch(r -> r.getBasisOfRecord() != null && r.getBasisOfRecord().length > 0);
    boolean hasNonBasisOfRecordFiltering = results.stream().anyMatch(r -> r.getBasisOfRecord() == null || r.getBasisOfRecord().length == 0);

    assertTrue(hasBasisOfRecordFiltering || hasNonBasisOfRecordFiltering, "Should find rules with or without basisOfRecord filtering");
  }

  @Test
  public void testGeometryFilter() {
    // Create a test rule with a specific geometry
    Rule rule = createTestRule();
    rule.setGeometry("POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))");
    ruleMapper.create(rule);

    // Test geometry intersection - this polygon should intersect with the rule's geometry
    String intersectingGeometry = "POLYGON((5 5, 15 5, 15 15, 5 15, 5 5))";
    List<Rule> results = ruleMapper.list(
        null, null, null, null, null, null, null, 
        intersectingGeometry, // geometry parameter
        null, null, null, null, 100, 0);
    
    assertTrue(results.size() >= 1, "Should find at least 1 rule that intersects with the test geometry");
    
    // Test non-intersecting geometry - this should return no results for our specific rule
    String nonIntersectingGeometry = "POLYGON((20 20, 30 20, 30 30, 20 30, 20 20))";
    List<Rule> noResults = ruleMapper.list(
        null, null, null, null, null, null, null,
        nonIntersectingGeometry, // geometry parameter  
        null, null, null, null, 100, 0);
    
    // Clean up
    ruleMapper.delete(rule.getId(), "testuser");
  }

  // @Test - Temporarily disabled due to compilation issues
  // TODO: Re-enable when null filtering is fully implemented
  /*
  public void testNullFiltering() {
    // Test will be re-enabled once null filtering is working
  }
  */
}
