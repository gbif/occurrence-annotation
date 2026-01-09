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
package org.gbif.occurrence.annotation.controller;

import org.gbif.occurrence.annotation.EmbeddedPostgres;
import org.gbif.occurrence.annotation.config.TestSecurityConfig;
import org.gbif.occurrence.annotation.model.Rule;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(EmbeddedPostgres.class)
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestSecurityConfig.class)
@TestPropertySource(locations = "classpath:test-application.properties")
public class RuleControllerTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    PostgreSQLContainer postgres = EmbeddedPostgres.getPostgres();
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
  }

  @Test
  public void testListRulesWithBasisOfRecordFilter() throws Exception {
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule")
                .param("basisOfRecord", "PRESERVED_SPECIMEN")
                .param("basisOfRecord", "HUMAN_OBSERVATION"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));
  }

  @Test
  public void testListRulesWithSingleBasisOfRecord() throws Exception {
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule")
                .param("basisOfRecord", "PRESERVED_SPECIMEN"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));
  }

  @Test
  public void testListRulesWithoutBasisOfRecordFilter() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/rule"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));
  }

  @Test
  @WithMockUser(
      username = "test-user",
      roles = {"USER"})
  public void testCreateRuleWithArrayBasisOfRecord() throws Exception {
    Rule rule =
        Rule.builder()
            .taxonKey(12345)
            .datasetKey("test-dataset-key")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .basisOfRecord(new String[] {"PRESERVED_SPECIMEN", "HUMAN_OBSERVATION"})
            .yearRange("2000,2023")
            .rulesetId(1)
            .projectId(1)
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id", notNullValue()))
        .andExpect(jsonPath("$.taxonKey", is(12345)))
        .andExpect(jsonPath("$.basisOfRecord", hasSize(2)))
        .andExpect(jsonPath("$.basisOfRecord[0]", is("PRESERVED_SPECIMEN")))
        .andExpect(jsonPath("$.basisOfRecord[1]", is("HUMAN_OBSERVATION")));
  }

  @Test
  @WithMockUser(
      username = "test-user",
      roles = {"USER"})
  public void testCreateRuleWithSingleBasisOfRecord() throws Exception {
    Rule rule =
        Rule.builder()
            .taxonKey(67890)
            .datasetKey("test-dataset-key-2")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.INTRODUCED)
            .basisOfRecord(new String[] {"MACHINE_OBSERVATION"})
            .yearRange("2010,2023")
            .rulesetId(1)
            .projectId(1)
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id", notNullValue()))
        .andExpect(jsonPath("$.taxonKey", is(67890)))
        .andExpect(jsonPath("$.basisOfRecord", hasSize(1)))
        .andExpect(jsonPath("$.basisOfRecord[0]", is("MACHINE_OBSERVATION")));
  }

  @Test
  @WithMockUser(
      username = "test-user",
      roles = {"USER"})
  public void testCreateRuleWithNullBasisOfRecord() throws Exception {
    Rule rule =
        Rule.builder()
            .taxonKey(11111)
            .datasetKey("test-dataset-key-3")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.SUSPICIOUS)
            .basisOfRecord(null)
            .yearRange("1990,2023")
            .rulesetId(1)
            .projectId(1)
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id", notNullValue()))
        .andExpect(jsonPath("$.taxonKey", is(11111)))
        .andExpect(jsonPath("$.basisOfRecord").doesNotExist());
  }

  @Test
  @WithMockUser(
      username = "test-user",
      roles = {"USER"})
  public void testCreateRuleWithEmptyBasisOfRecord() throws Exception {
    Rule rule =
        Rule.builder()
            .taxonKey(22222)
            .datasetKey("test-dataset-key-4")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.VAGRANT)
            .basisOfRecord(new String[] {})
            .yearRange("2005,2023")
            .rulesetId(1)
            .projectId(1)
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id", notNullValue()))
        .andExpect(jsonPath("$.taxonKey", is(22222)))
        .andExpect(jsonPath("$.basisOfRecord", hasSize(0)));
  }

  @Test
  @WithMockUser(
      username = "test-user",
      roles = {"USER"})
  public void testCreateAndRetrieveRuleWithBasisOfRecord() throws Exception {
    // First, create a rule
    Rule rule =
        Rule.builder()
            .taxonKey(33333)
            .datasetKey("test-dataset-key-5")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.FORMER)
            .basisOfRecord(
                new String[] {"PRESERVED_SPECIMEN", "FOSSIL_SPECIMEN", "LIVING_SPECIMEN"})
            .yearRange("1800,2000")
            .rulesetId(1)
            .projectId(1)
            .build();

    String response =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/rule")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(rule)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Rule createdRule = objectMapper.readValue(response, Rule.class);

    // Then, retrieve the rule by ID
    mockMvc
        .perform(get("/occurrence/experimental/annotation/rule/{id}", createdRule.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id", is(createdRule.getId())))
        .andExpect(jsonPath("$.taxonKey", is(33333)))
        .andExpect(jsonPath("$.basisOfRecord", hasSize(3)))
        .andExpect(jsonPath("$.basisOfRecord[0]", is("PRESERVED_SPECIMEN")))
        .andExpect(jsonPath("$.basisOfRecord[1]", is("FOSSIL_SPECIMEN")))
        .andExpect(jsonPath("$.basisOfRecord[2]", is("LIVING_SPECIMEN")));
  }

  @Test
  public void testListRulesWithMultipleBasisOfRecordFilters() throws Exception {
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule")
                .param("basisOfRecord", "PRESERVED_SPECIMEN")
                .param("basisOfRecord", "HUMAN_OBSERVATION")
                .param("basisOfRecord", "MACHINE_OBSERVATION")
                .param("limit", "50"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));
  }

  @Test
  public void testListRulesWithBasisOfRecordAndOtherFilters() throws Exception {
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule")
                .param("basisOfRecord", "PRESERVED_SPECIMEN")
                .param("taxonKey", "12345")
                .param("projectId", "1")
                .param("yearRange", "2000,2023"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));
  }

  @Test
  @WithMockUser(
      username = "test-user",
      roles = {"USER"})
  public void testCreateRuleWithNegatedBasisOfRecord() throws Exception {
    Rule rule =
        Rule.builder()
            .taxonKey(44444)
            .datasetKey("test-dataset-key-negated")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.SUSPICIOUS)
            .basisOfRecord(new String[] {"FOSSIL_SPECIMEN", "PRESERVED_SPECIMEN"})
            .basisOfRecordNegated(true)
            .yearRange("2000,2023")
            .rulesetId(1)
            .projectId(1)
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id", notNullValue()))
        .andExpect(jsonPath("$.taxonKey", is(44444)))
        .andExpect(jsonPath("$.basisOfRecord", hasSize(2)))
        .andExpect(jsonPath("$.basisOfRecord[0]", is("FOSSIL_SPECIMEN")))
        .andExpect(jsonPath("$.basisOfRecord[1]", is("PRESERVED_SPECIMEN")))
        .andExpect(jsonPath("$.basisOfRecordNegated", is(true)));
  }

  @Test
  public void testListRulesWithBasisOfRecordNegatedFilter() throws Exception {
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule").param("basisOfRecordNegated", "true"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));
  }

  @Test
  @WithMockUser(
      username = "alice",
      roles = {"USER"})
  public void testCreateRuleWithNegatedBasisOfRecordDefaults() throws Exception {
    Rule rule = new Rule();
    rule.setTaxonKey(99999);
    rule.setGeometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))");
    rule.setAnnotation(Rule.ANNOTATION_TYPE.SUSPICIOUS);
    rule.setBasisOfRecord(new String[] {"HUMAN_OBSERVATION"});
    // Don't set basisOfRecordNegated - should default to false
    rule.setRulesetId(1);
    rule.setProjectId(1);

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.basisOfRecordNegated", is(false)))
        .andExpect(jsonPath("$.basisOfRecord[0]", is("HUMAN_OBSERVATION")));
  }

  @Test
  @WithMockUser(
      username = "alice",
      roles = {"USER"})
  public void testCreateRuleWithExplicitlyNegatedBasisOfRecord() throws Exception {
    Rule rule = new Rule();
    rule.setTaxonKey(88888);
    rule.setGeometry("POLYGON((10 10, 10 11, 11 11, 11 10, 10 10))");
    rule.setAnnotation(Rule.ANNOTATION_TYPE.SUSPICIOUS);
    rule.setBasisOfRecord(new String[] {"FOSSIL_SPECIMEN", "PRESERVED_SPECIMEN"});
    rule.setBasisOfRecordNegated(true);
    rule.setRulesetId(1);
    rule.setProjectId(1);

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.basisOfRecordNegated", is(true)))
        .andExpect(jsonPath("$.basisOfRecord", hasSize(2)))
        .andExpect(jsonPath("$.basisOfRecord[0]", is("FOSSIL_SPECIMEN")))
        .andExpect(jsonPath("$.basisOfRecord[1]", is("PRESERVED_SPECIMEN")));
  }

  @Test
  @WithMockUser(
      username = "alice",
      roles = {"USER"})
  public void testFilterRulesByBasisOfRecordAndNegated() throws Exception {
    // Create a negated rule first
    Rule negatedRule = new Rule();
    negatedRule.setTaxonKey(77777);
    negatedRule.setGeometry("POLYGON((20 20, 20 21, 21 21, 21 20, 20 20))");
    negatedRule.setAnnotation(Rule.ANNOTATION_TYPE.SUSPICIOUS);
    negatedRule.setBasisOfRecord(new String[] {"FOSSIL_SPECIMEN"});
    negatedRule.setBasisOfRecordNegated(true);
    negatedRule.setRulesetId(1);
    negatedRule.setProjectId(1);

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(negatedRule)))
        .andExpect(status().isOk());

    // Now test filtering by both basisOfRecord and negated flag
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule")
                .param("basisOfRecord", "FOSSIL_SPECIMEN")
                .param("basisOfRecordNegated", "true"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(
            jsonPath(
                    "$[?(@.basisOfRecordNegated == true && @.basisOfRecord[0] == 'FOSSIL_SPECIMEN')]")
                .exists());
  }

  @Test
  public void testListRulesFilterByNegatedFalse() throws Exception {
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule").param("basisOfRecordNegated", "false"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));
  }

  @Test
  @WithMockUser(
      username = "project-filter-user",
      roles = {"USER"})
  public void testFilterRulesByProjectId() throws Exception {
    // Create two projects
    org.gbif.occurrence.annotation.model.Project project1 =
        new org.gbif.occurrence.annotation.model.Project();
    project1.setName("Filter Test Project 1");
    project1.setDescription("First project for filtering");

    String project1Response =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project1)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    org.gbif.occurrence.annotation.model.Project createdProject1 =
        objectMapper.readValue(
            project1Response, org.gbif.occurrence.annotation.model.Project.class);

    org.gbif.occurrence.annotation.model.Project project2 =
        new org.gbif.occurrence.annotation.model.Project();
    project2.setName("Filter Test Project 2");
    project2.setDescription("Second project for filtering");

    String project2Response =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project2)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    org.gbif.occurrence.annotation.model.Project createdProject2 =
        objectMapper.readValue(
            project2Response, org.gbif.occurrence.annotation.model.Project.class);

    // Create rules in different projects
    Rule ruleInProject1 =
        Rule.builder()
            .taxonKey(11111)
            .datasetKey("dataset-project1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .rulesetId(1)
            .projectId(createdProject1.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ruleInProject1)))
        .andExpect(status().isOk());

    Rule ruleInProject2 =
        Rule.builder()
            .taxonKey(22222)
            .datasetKey("dataset-project2")
            .geometry("POLYGON((1 1, 1 2, 2 2, 2 1, 1 1))")
            .annotation(Rule.ANNOTATION_TYPE.INTRODUCED)
            .rulesetId(1)
            .projectId(createdProject2.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ruleInProject2)))
        .andExpect(status().isOk());

    // Filter by project1 - should only return rules from project1
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule")
                .param("projectId", String.valueOf(createdProject1.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[*].projectId", everyItem(is(createdProject1.getId()))));

    // Filter by project2 - should only return rules from project2
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule")
                .param("projectId", String.valueOf(createdProject2.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[*].projectId", everyItem(is(createdProject2.getId()))));
  }

  @Test
  @WithMockUser(
      username = "combined-filter-user",
      roles = {"USER"})
  public void testFilterRulesByProjectIdAndTaxonKey() throws Exception {
    // Create a project
    org.gbif.occurrence.annotation.model.Project project =
        new org.gbif.occurrence.annotation.model.Project();
    project.setName("Combined Filter Project");
    project.setDescription("Project for testing combined filters");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    org.gbif.occurrence.annotation.model.Project createdProject =
        objectMapper.readValue(projectResponse, org.gbif.occurrence.annotation.model.Project.class);

    // Create rules with different taxon keys in the same project
    int targetTaxonKey = 55555;

    Rule rule1 =
        Rule.builder()
            .taxonKey(targetTaxonKey)
            .datasetKey("dataset-combined-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .rulesetId(1)
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    Rule rule2 =
        Rule.builder()
            .taxonKey(66666)
            .datasetKey("dataset-combined-2")
            .geometry("POLYGON((1 1, 1 2, 2 2, 2 1, 1 1))")
            .annotation(Rule.ANNOTATION_TYPE.INTRODUCED)
            .rulesetId(1)
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule2)))
        .andExpect(status().isOk());

    // Filter by both projectId and taxonKey - should only return matching rule
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule")
                .param("projectId", String.valueOf(createdProject.getId()))
                .param("taxonKey", String.valueOf(targetTaxonKey)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].projectId", is(createdProject.getId())))
        .andExpect(jsonPath("$[0].taxonKey", is(targetTaxonKey)));
  }

  @Test
  public void testFilterRulesByNonExistentProjectId() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/rule").param("projectId", "999999"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }
}
