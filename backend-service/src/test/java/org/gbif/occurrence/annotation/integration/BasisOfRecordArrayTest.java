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
package org.gbif.occurrence.annotation.integration;

import org.gbif.occurrence.annotation.model.Rule;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class BasisOfRecordArrayTest {

  @Test
  public void testRuleModelWithArrayBasisOfRecord() {
    // Test that Rule model can handle array basisOfRecord
    Rule rule =
        Rule.builder()
            .taxonKey(12345)
            .datasetKey("test-dataset")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .basisOfRecord(new String[] {"PRESERVED_SPECIMEN", "HUMAN_OBSERVATION"})
            .yearRange("2000,2023")
            .rulesetId(1)
            .projectId(1)
            .createdBy("test-user")
            .build();

    // Verify array handling
    assertNotNull(rule.getBasisOfRecord());
    assertEquals(2, rule.getBasisOfRecord().length);
    assertEquals("PRESERVED_SPECIMEN", rule.getBasisOfRecord()[0]);
    assertEquals("HUMAN_OBSERVATION", rule.getBasisOfRecord()[1]);
  }

  @Test
  public void testRuleModelWithNullBasisOfRecord() {
    Rule rule =
        Rule.builder()
            .taxonKey(12345)
            .datasetKey("test-dataset")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .basisOfRecord(null)
            .yearRange("2000,2023")
            .rulesetId(1)
            .projectId(1)
            .createdBy("test-user")
            .build();

    // Verify null handling
    assertNull(rule.getBasisOfRecord());
  }

  @Test
  public void testRuleModelWithEmptyBasisOfRecord() {
    Rule rule =
        Rule.builder()
            .taxonKey(12345)
            .datasetKey("test-dataset")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .basisOfRecord(new String[] {})
            .yearRange("2000,2023")
            .rulesetId(1)
            .projectId(1)
            .createdBy("test-user")
            .build();

    // Verify empty array handling
    assertNotNull(rule.getBasisOfRecord());
    assertEquals(0, rule.getBasisOfRecord().length);
  }

  @Test
  public void testRuleModelWithSingleBasisOfRecord() {
    Rule rule =
        Rule.builder()
            .taxonKey(12345)
            .datasetKey("test-dataset")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation(Rule.ANNOTATION_TYPE.NATIVE)
            .basisOfRecord(new String[] {"MACHINE_OBSERVATION"})
            .yearRange("2000,2023")
            .rulesetId(1)
            .projectId(1)
            .createdBy("test-user")
            .build();

    // Verify single element array handling
    assertNotNull(rule.getBasisOfRecord());
    assertEquals(1, rule.getBasisOfRecord().length);
    assertEquals("MACHINE_OBSERVATION", rule.getBasisOfRecord()[0]);
  }
}
