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
            null, null, null, null, new String[] {"PRESERVED_SPECIMEN"}, null, null, 100, 0);

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
            100,
            0);

    assertEquals(
        3, results.size(), "Should find 3 rules with PRESERVED_SPECIMEN or MACHINE_OBSERVATION");

    // Test filtering by non-existent basisOfRecord
    results =
        ruleMapper.list(null, null, null, null, new String[] {"NON_EXISTENT"}, null, null, 100, 0);

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
    List<Rule> results = ruleMapper.list(null, null, null, null, null, null, null, 100, 0);

    assertTrue(results.size() >= 2, "Should find at least 2 rules");
  }

  @Test
  public void testListRulesWithEmptyBasisOfRecordFilter() {
    Rule rule = createTestRule();
    ruleMapper.create(rule);

    // Test with empty array - should return all rules (no filtering)
    List<Rule> results =
        ruleMapper.list(null, null, null, null, new String[] {}, null, null, 100, 0);

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
            100,
            0);

    assertEquals(2, results.size(), "Should find 2 rules with partial overlap");

    // Test exact match filter
    results =
        ruleMapper.list(
            null, null, null, null, new String[] {"MACHINE_OBSERVATION"}, null, null, 100, 0);

    assertEquals(1, results.size(), "Should find 1 rule with MACHINE_OBSERVATION");
  }
}
