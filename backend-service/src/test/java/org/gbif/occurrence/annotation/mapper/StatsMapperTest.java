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
import org.gbif.occurrence.annotation.config.TestSecurityConfig;
import org.gbif.occurrence.annotation.model.CreatorStats;
import org.gbif.occurrence.annotation.model.ProjectStats;
import org.gbif.occurrence.annotation.model.Rule;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(EmbeddedPostgres.class)
@SpringBootTest
@Transactional
@SpringJUnitConfig
@Import(TestSecurityConfig.class)
@TestPropertySource(locations = "classpath:test-application.properties")
public class StatsMapperTest {

  @Autowired private StatsMapper statsMapper;

  @Autowired private RuleMapper ruleMapper;

  @Autowired private ProjectMapper projectMapper;

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    PostgreSQLContainer postgres = EmbeddedPostgres.getPostgres();
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
  }

  @BeforeEach
  public void setUp() {
    // Test data is loaded from test-data.sql automatically
    // Create additional test rules for statistics
    createTestRule("user1", 1);
    createTestRule("user1", 1);
    createTestRule("user1", 1);
    createTestRule("user2", 1);
    createTestRule("user2", 1);
    createTestRule("user3", 1);
  }

  private void createTestRule(String createdBy, Integer projectId) {
    Rule rule =
        Rule.builder()
            .taxonKey(12345)
            .datasetKey("test-dataset-key")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .basisOfRecord(new String[] {"PRESERVED_SPECIMEN"})
            .yearRange("2000,2023")
            .rulesetId(1)
            .projectId(projectId)
            .createdBy(createdBy)
            .build();
    ruleMapper.create(rule);
  }

  @Test
  public void testGetTopCreators() {
    List<CreatorStats> stats = statsMapper.getTopCreators(10);

    assertNotNull(stats, "Stats should not be null");
    assertFalse(stats.isEmpty(), "Stats should not be empty");

    // Verify ordering by rule count
    for (int i = 0; i < stats.size() - 1; i++) {
      assertTrue(
          stats.get(i).getRuleCount() >= stats.get(i + 1).getRuleCount(),
          "Creators should be ordered by rule count descending");
    }

    // Find user1 who created 3 rules
    CreatorStats user1Stats =
        stats.stream().filter(s -> "user1".equals(s.getUsername())).findFirst().orElse(null);
    assertNotNull(user1Stats, "user1 should be in stats");
    assertTrue(
        user1Stats.getRuleCount() >= 3, "user1 should have at least 3 rules (may have more)");
  }

  @Test
  public void testGetTopCreatorsWithLimit() {
    List<CreatorStats> stats = statsMapper.getTopCreators(2);

    assertNotNull(stats, "Stats should not be null");
    assertTrue(stats.size() <= 2, "Should return at most 2 creators");
  }

  @Test
  public void testGetMostSupportedCreators() {
    List<CreatorStats> stats = statsMapper.getMostSupportedCreators(10);

    assertNotNull(stats, "Stats should not be null");

    // Verify ordering by total supports (descending)
    for (int i = 0; i < stats.size() - 1; i++) {
      assertTrue(
          stats.get(i).getTotalSupports() >= stats.get(i + 1).getTotalSupports(),
          "Creators should be ordered by total supports descending");
    }

    // All creators should have valid data
    for (CreatorStats stat : stats) {
      assertNotNull(stat.getUsername(), "Username should not be null");
      assertTrue(stat.getRuleCount() >= 0, "Rule count should be non-negative");
      assertTrue(stat.getTotalSupports() >= 0, "Total supports should be non-negative");
    }
  }

  @Test
  public void testGetTopProjects() {
    List<ProjectStats> stats = statsMapper.getTopProjects(10);

    assertNotNull(stats, "Stats should not be null");
    assertFalse(stats.isEmpty(), "Stats should not be empty");

    // Verify ordering by rule count
    for (int i = 0; i < stats.size() - 1; i++) {
      assertTrue(
          stats.get(i).getRuleCount() >= stats.get(i + 1).getRuleCount(),
          "Projects should be ordered by rule count descending");
    }

    // Verify first project has the most rules
    ProjectStats topProject = stats.get(0);
    assertNotNull(topProject.getProjectId(), "Project ID should not be null");
    assertNotNull(topProject.getProjectName(), "Project name should not be null");
    assertNotNull(topProject.getCreatedBy(), "Created by should not be null");
    assertTrue(topProject.getRuleCount() > 0, "Top project should have rules");
  }

  @Test
  public void testGetTopProjectsWithLimit() {
    List<ProjectStats> stats = statsMapper.getTopProjects(1);

    assertNotNull(stats, "Stats should not be null");
    assertTrue(stats.size() <= 1, "Should return at most 1 project");
  }

  @Test
  public void testGetMostSupportedProjects() {
    List<ProjectStats> stats = statsMapper.getMostSupportedProjects(10);

    assertNotNull(stats, "Stats should not be null");

    // Verify ordering by total supports (descending)
    for (int i = 0; i < stats.size() - 1; i++) {
      assertTrue(
          stats.get(i).getTotalSupports() >= stats.get(i + 1).getTotalSupports(),
          "Projects should be ordered by total supports descending");
    }

    // All projects should have valid data
    for (ProjectStats stat : stats) {
      assertNotNull(stat.getProjectId(), "Project ID should not be null");
      assertNotNull(stat.getProjectName(), "Project name should not be null");
      assertTrue(stat.getRuleCount() >= 0, "Rule count should be non-negative");
      assertTrue(stat.getTotalSupports() >= 0, "Total supports should be non-negative");
    }
  }

  @Test
  public void testStatsWithNoData() {
    // This test verifies behavior when there's minimal data
    // The test database has the base test project/ruleset
    List<CreatorStats> creatorStats = statsMapper.getTopCreators(100);
    List<ProjectStats> projectStats = statsMapper.getTopProjects(100);

    // Should return results even with limited data
    assertNotNull(creatorStats, "Creator stats should not be null");
    assertNotNull(projectStats, "Project stats should not be null");
  }

  @Test
  public void testCreatorStatsFields() {
    List<CreatorStats> stats = statsMapper.getTopCreators(10);

    if (!stats.isEmpty()) {
      CreatorStats stat = stats.get(0);
      assertNotNull(stat.getUsername(), "Username should not be null");
      assertNotNull(stat.getRuleCount(), "Rule count should not be null");
      assertNotNull(stat.getTotalSupports(), "Total supports should not be null");
      assertNotNull(stat.getTotalContests(), "Total contests should not be null");
      assertNotNull(stat.getProjectCount(), "Project count should not be null");
    }
  }

  @Test
  public void testProjectStatsFields() {
    List<ProjectStats> stats = statsMapper.getTopProjects(10);

    if (!stats.isEmpty()) {
      ProjectStats stat = stats.get(0);
      assertNotNull(stat.getProjectId(), "Project ID should not be null");
      assertNotNull(stat.getProjectName(), "Project name should not be null");
      assertNotNull(stat.getCreatedBy(), "Created by should not be null");
      assertNotNull(stat.getRuleCount(), "Rule count should not be null");
      assertNotNull(stat.getTotalSupports(), "Total supports should not be null");
      assertNotNull(stat.getTotalContests(), "Total contests should not be null");
      assertNotNull(stat.getMemberCount(), "Member count should not be null");
      assertTrue(stat.getMemberCount() >= 0, "Member count should be non-negative");
    }
  }
}
