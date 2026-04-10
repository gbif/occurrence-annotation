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

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a single term in a project's annotation vocabulary.
 * Each term has a unique name, optional description, display color, and locked status.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class VocabularyTerm {
  
  /** The term identifier (e.g., "NATIVE", "INTRODUCED", "SUSPICIOUS") */
  @NotNull @NotBlank private String term;
  
  /** Optional human-readable description of the term */
  private String description;
  
  /** Display color as hex code (e.g., "#10b981" for green) */
  @NotNull
  @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Color must be a valid hex code")
  private String color;
  
  /**
   * Whether this term is locked and cannot be edited or removed.
   * SUSPICIOUS is always locked to ensure data quality requirements.
   */
  @Builder.Default private boolean locked = false;
}
