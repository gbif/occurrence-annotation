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
package org.gbif.occurrence.annotation;

import org.gbif.api.vocabulary.UserRole;
import org.gbif.occurrence.annotation.controller.AuthAdvice;
import org.gbif.occurrence.annotation.controller.ProjectController;
import org.gbif.occurrence.annotation.controller.RuleController;
import org.gbif.occurrence.annotation.controller.RulesetController;
import org.gbif.occurrence.annotation.model.Comment;
import org.gbif.occurrence.annotation.model.Project;
import org.gbif.occurrence.annotation.model.Rule;
import org.gbif.occurrence.annotation.model.Ruleset;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Collections;
import java.util.List;

import javax.sql.DataSource;

import org.apache.commons.lang3.ArrayUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.util.TestPropertyValues;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import lombok.SneakyThrows;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

/**
 * Runs tests against the controllers bypassing HTTP. This requires Docker to be running for the
 * embedded postgres container.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ContextConfiguration(initializers = {AnnotationTest.ContextInitializer.class})
class AnnotationTest {
  @RegisterExtension protected static EmbeddedPostgres pgContainer = new EmbeddedPostgres();

  @Autowired private ProjectController projectController;
  @Autowired private RulesetController rulesetController;
  @Autowired private RuleController ruleController;
  @Autowired private DataSource dataSource;

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testProjects() {
    assertTrue("Projects should be empty", projectController.list(100, 0).isEmpty());
    projectController.create(
        Project.builder().name("Legumedata.org").description("A collection of rulesets").build());

    assertEquals(
        "Should contain the project we just created", 1, projectController.list(100, 0).size());
    Project legume = projectController.get(1);
    legume.setMembers(ArrayUtils.add(legume.getMembers(), "JOE"));
    projectController.update(1, legume);
    assertEquals("Should have two members", 2, projectController.get(1).getMembers().length);

    assertEquals("Should have one project in page", 1, projectController.list(100, 0).size());
    assertEquals("Should have no projects in page 1", 0, projectController.list(1, 1).size());
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testRulesets() {
    Project p1 = projectController.create(Project.builder().name("1").description("1").build());

    assertTrue(
        "There should be no ruleset in project 1", rulesetController.list(1, 100, 0).isEmpty());

    rulesetController.create(
        Ruleset.builder()
            .projectId(p1.getId())
            .name("Rules about legumes")
            .description("Canny rules")
            .build());

    assertEquals(
        "Should contain the ruleset we just created", 1, rulesetController.list(1, 100, 0).size());
    Ruleset legume = rulesetController.get(1);
    legume.setMembers(ArrayUtils.add(legume.getMembers(), "JOE"));
    rulesetController.update(1, legume);
    assertEquals("Should have two members", 2, legume.getMembers().length);

    assertEquals("Should have one ruleset in page", 1, rulesetController.list(1, 100, 0).size());
    assertEquals("Should have no rulesets in page 1", 0, rulesetController.list(1, 1, 1).size());
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testRuleLifecycle() {
    Project p1 = projectController.create(Project.builder().name("1").description("1").build());
    Project p2 = projectController.create(Project.builder().name("2").description("2").build());
    Ruleset rs1 =
        rulesetController.create(
            Ruleset.builder().projectId(p1.getId()).name("1").description("1").build());
    Ruleset rs2 =
        rulesetController.create(
            Ruleset.builder().projectId(p1.getId()).name("2").description("2").build());

    ruleController.create(
        Rule.builder()
            .taxonKey(1)
            .geometry("geom1")
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .basisOfRecord("PRESERVED_SPECIMEN")
            .build());

    ruleController.create(
        Rule.builder()
            .datasetKey("2")
            .geometry("geom2")
            .rulesetId(rs1.getId())
            .projectId(p1.getId())
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .basisOfRecord("HUMAN_OBSERVATION")
            .build());

    ruleController.create(
        Rule.builder()
            .taxonKey(1)
            .geometry("geom3")
            .rulesetId(rs1.getId())
            .projectId(p1.getId())
            .annotation(Rule.ANNOTATION_TYPE.VAGRANT)
            .build());

    Rule deleteRule =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom4")
                .annotation(Rule.ANNOTATION_TYPE.INTRODUCED)
                .basisOfRecord("MACHINE_OBSERVATION")
                .build());
    ruleController.delete(deleteRule.getId());

    assertEquals(
        "A deleted rule can still be accessed",
        "geom4",
        ruleController.get(deleteRule.getId()).getGeometry());
    assertNotNull(
        "A deleted rule should have a deleted timestamp", ruleController.get(deleteRule.getId()));
    assertEquals(
        "3 active rules were just created",
        3,
        ruleController.list(null, null, null, null, null, null, null, 100, 0).size());
    assertEquals(
        "2 non-deleted rules were about taxon 1",
        2,
        ruleController.list(1, null, null, null, null, null, null, 100, 0).size());
    assertEquals(
        "2 non-deleted rules are in ruleset 1 and project 1",
        2,
        ruleController.list(null, null, rs1.getId(), p1.getId(), null, null, null, 100, 0).size());
    assertEquals(
        "0 non-deleted rules are in ruleset 2 and project 2",
        0,
        ruleController.list(null, null, rs2.getId(), p2.getId(), null, null, null, 100, 0).size());

    assertEquals(
        "2 rules should exist for limit 0-2",
        2,
        ruleController.list(null, null, null, null, null, null, null, 2, 0).size());

    assertEquals(
        "1 rule should exist in page 2-4",
        1,
        ruleController.list(null, null, null, null, null, null, null, 2, 2).size());

    assertEquals(
        "0 rule should exist in page 4-6",
        0,
        ruleController.list(null, null, null, null, null, null, null, 2, 4).size());
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testFindByComment() {
    Rule r1 =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());

    Rule r2 =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());

    ruleController.addComment(
        r1.getId(), Comment.builder().comment("They do though don't they though").build());
    ruleController.addComment(r1.getId(), Comment.builder().comment("I divvina, pet").build());
    ruleController.addComment(
        r2.getId(), Comment.builder().comment("Are ye gannin yem already?").build());
    ruleController.addComment(r1.getId(), Comment.builder().comment("Am gannin doon toon").build());
    Comment c1 =
        ruleController.addComment(r1.getId(), Comment.builder().comment("Delete me").build());
    ruleController.deleteComment(c1.getId());

    assertEquals(
        "Gannin should match 2 rules",
        2,
        ruleController.list(null, null, null, null, null, null, "gannin", 100, 0).size());
    assertEquals(
        "Deleted comments should be skipped",
        0,
        ruleController.list(null, null, null, null, null, null, "delete", 100, 0).size());
    assertEquals(
        "Pet is only on one rule",
        1,
        ruleController.list(null, null, null, null, null, null, "pet", 100, 0).size());
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testRuleSupportContest() {
    Rule r =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());

    ruleController.addComment(r.getId(), Comment.builder().comment("comment 1").build());
    Comment deleteComment =
        ruleController.addComment(r.getId(), Comment.builder().comment("comment 2").build());

    assertEquals("Two comments were added", 2, ruleController.listComment(r.getId()).size());
    ruleController.deleteComment(deleteComment.getId());
    assertEquals(
        "One non-deleted comment should remain", 1, ruleController.listComment(r.getId()).size());
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testComments() {
    Rule r =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .basisOfRecord("PRESERVED_SPECIMEN")
                .build());

    ruleController.support(r.getId());
    ruleController.support(r.getId());
    assertEquals(
        "Duplicate supports should be ignored",
        1,
        ruleController.get(r.getId()).getSupportedBy().length);
    ruleController.removeSupport(r.getId());
    assertEquals(
        "Removing supports failing", 0, ruleController.get(r.getId()).getSupportedBy().length);
    ruleController.support(r.getId());
    ruleController.contest(r.getId()); // should remove the support
    ruleController.contest(r.getId());
    assertEquals(
        "Contesting should remove any previous support",
        0,
        ruleController.get(r.getId()).getSupportedBy().length);
    assertEquals(
        "Duplicate contesting should be ignored",
        1,
        ruleController.get(r.getId()).getContestedBy().length);
    ruleController.removeContest(r.getId());
    assertEquals(
        "Removing contest failing", 0, ruleController.get(r.getId()).getContestedBy().length);
    ruleController.contest(r.getId());
    ruleController.support(r.getId()); // should remove the contest
    assertEquals("Should have 1 support", 1, ruleController.get(r.getId()).getSupportedBy().length);
    assertEquals(
        "Supporting should remove any previous contest",
        0,
        ruleController.get(r.getId()).getContestedBy().length);
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testDeleteByProject() {
    // delete ruleset and rules by deleting just the project
    Project p1 = projectController.create(Project.builder().name("1").description("1").build());
    Ruleset rs1 =
        rulesetController.create(
            Ruleset.builder().projectId(p1.getId()).name("1").description("1").build());
    Rule r1 =
        ruleController.create(
            Rule.builder()
                .projectId(p1.getId())
                .rulesetId(rs1.getId())
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());
    Rule r2 =
        ruleController.create(
            Rule.builder()
                .projectId(p1.getId())
                .rulesetId(rs1.getId())
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());
    // rule 3 is not associated with a project or ruleset
    Rule r3 =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());
    // rule 4 is not associate with a project
    Rule r4 =
        ruleController.create(
            Rule.builder()
                .rulesetId(rs1.getId())
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());

    assertEquals(
        "4 non-deleted rules",
        4,
        ruleController.list(null, null, null, null, null, null, null, 100, 0).size());

    projectController.delete(p1.getId());

    assertEquals(
        "2 non-deleted rules not associated with project 1",
        2,
        ruleController.list(null, null, null, null, null, null, null, 100, 0).size());
    assertEquals(
        "0 non-deleted rulesets since they were all in project 1",
        0,
        rulesetController.list(null, 100, 0).size());
    assertEquals("0 non-deleted projects", 0, projectController.list(100, null).size());
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testDeleteByRuleset() {
    // delete ruleset and rules by deleting just the ruleset
    Project p1 = projectController.create(Project.builder().name("1").description("1").build());
    Ruleset rs1 =
        rulesetController.create(
            Ruleset.builder().projectId(p1.getId()).name("1").description("1").build());
    Rule r1 =
        ruleController.create(
            Rule.builder()
                .projectId(p1.getId())
                .rulesetId(rs1.getId())
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());
    Rule r2 =
        ruleController.create(
            Rule.builder()
                .projectId(p1.getId())
                .rulesetId(rs1.getId())
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());
    // rule 3 is not associated with a project or ruleset
    Rule r3 =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());
    // rule 4 is not associate with a project
    Rule r4 =
        ruleController.create(
            Rule.builder()
                .rulesetId(rs1.getId())
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());

    assertEquals(
        "4 non-deleted rules",
        4,
        ruleController.list(null, null, null, null, null, null, null, 100, 0).size());

    assertEquals(
        "3 non-deleted rules",
        3,
        ruleController.list(null, null, rs1.getId(), null, null, null, null, 100, 0).size());

    rulesetController.delete(rs1.getId());

    assertEquals(
        "0 non-deleted rules",
        0,
        ruleController.list(null, null, rs1.getId(), null, null, null, null, 100, 0).size());

    assertEquals(
        "0 non-deleted rules",
        0,
        ruleController.list(null, null, null, p1.getId(), null, null, null, 100, 0).size());
    assertEquals(
        "1 non-deleted rules",
        1,
        ruleController.list(null, null, null, null, null, null, null, 100, 0).size());
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testUpdateMembersByProject() {
    Project p1 = projectController.create(Project.builder().name("1").description("1").build());
    Ruleset rs1 =
        rulesetController.create(
            Ruleset.builder().projectId(p1.getId()).name("1").description("1").build());
    assertEquals("1 member", 1, rulesetController.get(rs1.getId()).getMembers().length);
    Ruleset rs2 =
        rulesetController.create(
            Ruleset.builder().projectId(p1.getId()).name("2").description("2").build());
    assertEquals("1 member", 1, rulesetController.get(rs2.getId()).getMembers().length);
    p1.setMembers(ArrayUtils.add(p1.getMembers(), "JOHN"));
    projectController.update(p1.getId(), p1);
    assertEquals("2 members", 2, rulesetController.get(rs1.getId()).getMembers().length);
    assertEquals("2 members", 2, rulesetController.get(rs2.getId()).getMembers().length);
  }

  @Test
  void testCommentAuth() {
    setAuthenticatedUser("tim", UserRole.USER);
    Rule r =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .build());
    Comment c =
        ruleController.addComment(r.getId(), Comment.builder().comment("comment 1").build());

    setAuthenticatedUser("thomas", UserRole.USER);
    try {
      ruleController.deleteComment(c.getId());
      fail("Should not be able to delete other users comments");
    } catch (AuthAdvice.NotAuthorisedException e) {
    }

    setAuthenticatedUser("marie", UserRole.REGISTRY_ADMIN);
    try {
      ruleController.deleteComment(c.getId());
    } catch (AuthAdvice.NotAuthorisedException e) {
      fail("Admin should be able to delete any user comments");
    }
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testBasisOfRecord() {
    // Test creating a rule with basisOfRecord
    Rule ruleWithBasis =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .basisOfRecord("PRESERVED_SPECIMEN")
                .build());

    assertEquals("PRESERVED_SPECIMEN", ruleWithBasis.getBasisOfRecord());

    // Test creating a rule without basisOfRecord (should be null)
    Rule ruleWithoutBasis =
        ruleController.create(
            Rule.builder()
                .taxonKey(2)
                .geometry("geom2")
                .annotation(Rule.ANNOTATION_TYPE.INTRODUCED)
                .build());

    assertNull(ruleWithoutBasis.getBasisOfRecord());

    // Test retrieving rules and verifying basisOfRecord persistence
    Rule retrievedWithBasis = ruleController.get(ruleWithBasis.getId());
    Rule retrievedWithoutBasis = ruleController.get(ruleWithoutBasis.getId());

    assertEquals("PRESERVED_SPECIMEN", retrievedWithBasis.getBasisOfRecord());
    assertNull(retrievedWithoutBasis.getBasisOfRecord());

    // Test filtering by basisOfRecord
    List<Rule> preservedSpecimenRules =
        ruleController.list(null, null, null, null, "PRESERVED_SPECIMEN", null, null, 100, 0);
    assertEquals("Should find 1 rule with PRESERVED_SPECIMEN", 1, preservedSpecimenRules.size());
    assertEquals("PRESERVED_SPECIMEN", preservedSpecimenRules.get(0).getBasisOfRecord());

    // Test filtering by non-existent basisOfRecord
    List<Rule> machineObservationRules =
        ruleController.list(null, null, null, null, "MACHINE_OBSERVATION", null, null, 100, 0);
    assertEquals("Should find 0 rules with MACHINE_OBSERVATION", 0, machineObservationRules.size());

    // Test listing all rules (no filter)
    List<Rule> allRules = ruleController.list(null, null, null, null, null, null, null, 100, 0);
    assertTrue("Should find at least 2 rules", allRules.size() >= 2);
  }

  @Test
  @WithMockUser(
      username = "tim",
      authorities = {"USER"})
  void testYearRange() {
    // Test creating a rule with yearRange
    Rule ruleWithYearRange =
        ruleController.create(
            Rule.builder()
                .taxonKey(1)
                .geometry("geom1")
                .annotation(Rule.ANNOTATION_TYPE.NATIVE)
                .yearRange("1800,2000")
                .build());

    assertEquals("1800,2000", ruleWithYearRange.getYearRange());

    // Test creating a rule with wildcard year ranges
    Rule ruleWithWildcardStart =
        ruleController.create(
            Rule.builder()
                .taxonKey(2)
                .geometry("geom2")
                .annotation(Rule.ANNOTATION_TYPE.INTRODUCED)
                .yearRange("*,1950")
                .build());

    assertEquals("*,1950", ruleWithWildcardStart.getYearRange());

    Rule ruleWithWildcardEnd =
        ruleController.create(
            Rule.builder()
                .taxonKey(3)
                .geometry("geom3")
                .annotation(Rule.ANNOTATION_TYPE.VAGRANT)
                .yearRange("1900,*")
                .build());

    assertEquals("1900,*", ruleWithWildcardEnd.getYearRange());

    // Test creating a rule without yearRange (should be null)
    Rule ruleWithoutYearRange =
        ruleController.create(
            Rule.builder()
                .taxonKey(4)
                .geometry("geom4")
                .annotation(Rule.ANNOTATION_TYPE.FORMER)
                .build());

    assertNull(ruleWithoutYearRange.getYearRange());

    // Test retrieving rules and verifying yearRange persistence
    Rule retrievedWithYearRange = ruleController.get(ruleWithYearRange.getId());
    Rule retrievedWithWildcardStart = ruleController.get(ruleWithWildcardStart.getId());
    Rule retrievedWithWildcardEnd = ruleController.get(ruleWithWildcardEnd.getId());
    Rule retrievedWithoutYearRange = ruleController.get(ruleWithoutYearRange.getId());

    assertEquals("1800,2000", retrievedWithYearRange.getYearRange());
    assertEquals("*,1950", retrievedWithWildcardStart.getYearRange());
    assertEquals("1900,*", retrievedWithWildcardEnd.getYearRange());
    assertNull(retrievedWithoutYearRange.getYearRange());

    // Test filtering by yearRange
    List<Rule> specificYearRangeRules =
        ruleController.list(null, null, null, null, null, "1800,2000", null, 100, 0);
    assertEquals("Should find 1 rule with year range 1800,2000", 1, specificYearRangeRules.size());
    assertEquals("1800,2000", specificYearRangeRules.get(0).getYearRange());

    // Test filtering by wildcard year ranges
    List<Rule> wildcardStartRules =
        ruleController.list(null, null, null, null, null, "*,1950", null, 100, 0);
    assertEquals("Should find 1 rule with year range *,1950", 1, wildcardStartRules.size());
    assertEquals("*,1950", wildcardStartRules.get(0).getYearRange());

    List<Rule> wildcardEndRules =
        ruleController.list(null, null, null, null, null, "1900,*", null, 100, 0);
    assertEquals("Should find 1 rule with year range 1900,*", 1, wildcardEndRules.size());
    assertEquals("1900,*", wildcardEndRules.get(0).getYearRange());

    // Test filtering by non-existent yearRange
    List<Rule> nonExistentYearRangeRules =
        ruleController.list(null, null, null, null, null, "2000,2025", null, 100, 0);
    assertEquals(
        "Should find 0 rules with year range 2000,2025", 0, nonExistentYearRangeRules.size());

    // Test listing all rules (no filter)
    List<Rule> allRules = ruleController.list(null, null, null, null, null, null, null, 100, 0);
    assertTrue("Should find at least 4 rules", allRules.size() >= 4);
  }

  private static void setAuthenticatedUser(String name, UserRole role) {
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                name,
                "password",
                Collections.singletonList(new SimpleGrantedAuthority(role.toString()))));
  }

  @BeforeEach
  void initialiseDatabase() throws SQLException {
    try (Connection connection = dataSource.getConnection();
        Statement statement = connection.createStatement(); ) {
      statement.execute("DROP DATABASE IF EXISTS annotation");
      statement.execute("CREATE DATABASE annotation");
      ScriptUtils.executeSqlScript(connection, new ClassPathResource("./schema.sql"));
    }
  }

  // Overwrite the main properties with the testcontainer ones
  static class ContextInitializer
      implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    @SneakyThrows
    public void initialize(ConfigurableApplicationContext context) {
      TestPropertyValues.of(
              "spring.datasource.url=" + pgContainer.getPostgres().getJdbcUrl(),
              "spring.datasource.username=" + pgContainer.getPostgres().getUsername(),
              "spring.datasource.password=" + pgContainer.getPostgres().getPassword())
          .applyTo(context.getEnvironment());
    }
  }
}
