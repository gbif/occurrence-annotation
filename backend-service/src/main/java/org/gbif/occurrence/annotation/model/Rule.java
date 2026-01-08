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
package org.gbif.occurrence.annotation.model;

import java.util.Date;

import javax.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Rule {

  // The type of annotation applied to the range
  public enum ANNOTATION_TYPE {
    NATIVE,
    INTRODUCED,
    MANAGED,
    FORMER,
    VAGRANT,
    SUSPICIOUS,
    OTHER
  }

  private Integer id;
  private Integer taxonKey;
  private String datasetKey;
  @NotNull private String geometry;
  private ANNOTATION_TYPE annotation;
  private String[] basisOfRecord;
  private Boolean basisOfRecordNegated = false;
  private String yearRange;
  private Integer rulesetId;
  private Integer projectId;
  private String[] supportedBy;
  private String[] contestedBy;
  private Date created;
  private String createdBy;
  private Date deleted;
  private String deletedBy;
}
