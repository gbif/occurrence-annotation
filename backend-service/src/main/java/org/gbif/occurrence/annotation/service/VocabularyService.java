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
package org.gbif.occurrence.annotation.service;

import org.gbif.occurrence.annotation.mapper.ProjectMapper;
import org.gbif.occurrence.annotation.model.Project;
import org.gbif.occurrence.annotation.model.VocabularyTerm;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

/**
 * Service for managing project-specific annotation vocabularies. Handles validation and provides
 * default vocabulary based on the standard ANNOTATION_TYPE enum.
 */
@Service
public class VocabularyService {

  private static final int MAX_VOCABULARY_SIZE = 50;
  private static final String REQUIRED_LOCKED_TERM = "SUSPICIOUS";

  private final ProjectMapper projectMapper;

  public VocabularyService(ProjectMapper projectMapper) {
    this.projectMapper = projectMapper;
  }

  /**
   * Get the vocabulary for a project. Returns custom vocabulary if defined, otherwise returns
   * default vocabulary.
   *
   * @param projectId the project ID
   * @return the vocabulary terms array
   */
  public VocabularyTerm[] getVocabulary(Integer projectId) {
    if (projectId == null) {
      return getDefaultVocabulary();
    }

    Project project = projectMapper.get(projectId);
    if (project == null || project.getCustomVocabulary() == null) {
      return getDefaultVocabulary();
    }

    return project.getCustomVocabulary();
  }

  /**
   * Get the default system vocabulary based on ANNOTATION_TYPE enum.
   *
   * @return the default vocabulary terms
   */
  public VocabularyTerm[] getDefaultVocabulary() {
    return new VocabularyTerm[] {
      VocabularyTerm.builder()
          .term("NATIVE")
          .description("Native to the area")
          .color("#22c55e")
          .locked(false)
          .build(),
      VocabularyTerm.builder()
          .term("INTRODUCED")
          .description("Introduced to the area")
          .color("#3b82f6")
          .locked(false)
          .build(),
      VocabularyTerm.builder()
          .term("MANAGED")
          .description("Managed population")
          .color("#a855f7")
          .locked(false)
          .build(),
      VocabularyTerm.builder()
          .term("FORMER")
          .description("Formerly present")
          .color("#f97316")
          .locked(false)
          .build(),
      VocabularyTerm.builder()
          .term("VAGRANT")
          .description("Vagrant occurrence")
          .color("#06b6d4")
          .locked(false)
          .build(),
      VocabularyTerm.builder()
          .term("SUSPICIOUS")
          .description("Suspicious or questionable")
          .color("#ef4444")
          .locked(true)
          .build(),
      VocabularyTerm.builder()
          .term("OTHER")
          .description("Other annotation type")
          .color("#6b7280")
          .locked(false)
          .build()
    };
  }

  /**
   * Validate a custom vocabulary array against business rules.
   *
   * @param vocabulary the vocabulary terms to validate
   * @throws IllegalArgumentException if validation fails
   */
  public void validateVocabulary(VocabularyTerm[] vocabulary) {
    if (vocabulary == null) {
      return; // null is valid - means use default vocabulary
    }

    // Check maximum size
    if (vocabulary.length > MAX_VOCABULARY_SIZE) {
      throw new IllegalArgumentException(
          "Vocabulary cannot exceed " + MAX_VOCABULARY_SIZE + " terms");
    }

    // Check for required SUSPICIOUS term
    boolean hasSuspicious =
        Arrays.stream(vocabulary)
            .anyMatch(term -> REQUIRED_LOCKED_TERM.equalsIgnoreCase(term.getTerm()));

    if (!hasSuspicious) {
      throw new IllegalArgumentException(
          "Vocabulary must include the '" + REQUIRED_LOCKED_TERM + "' term");
    }

    // Verify SUSPICIOUS is locked
    Arrays.stream(vocabulary)
        .filter(term -> REQUIRED_LOCKED_TERM.equalsIgnoreCase(term.getTerm()))
        .findFirst()
        .ifPresent(
            term -> {
              if (!term.isLocked()) {
                throw new IllegalArgumentException(
                    "The '" + REQUIRED_LOCKED_TERM + "' term must be locked");
              }
            });

    // Check for duplicate terms (case-insensitive)
    Set<String> uniqueTerms = new HashSet<>();
    List<String> duplicates =
        Arrays.stream(vocabulary)
            .map(term -> term.getTerm().toUpperCase(Locale.ROOT))
            .filter(term -> !uniqueTerms.add(term))
            .collect(Collectors.toList());

    if (!duplicates.isEmpty()) {
      throw new IllegalArgumentException(
          "Duplicate terms found (case-insensitive): " + String.join(", ", duplicates));
    }

    // Validate each term
    for (VocabularyTerm term : vocabulary) {
      if (term.getTerm() == null || term.getTerm().isBlank()) {
        throw new IllegalArgumentException("All vocabulary terms must have a non-blank term name");
      }

      // Color validation is handled by @Pattern annotation on VocabularyTerm
      // but we can add additional validation here if needed
      if (term.getColor() != null && !term.getColor().matches("^#[0-9A-Fa-f]{6}$")) {
        throw new IllegalArgumentException(
            "Invalid color format for term '" + term.getTerm() + "': must be hex format #RRGGBB");
      }
    }
  }

  /**
   * Check if a term exists in the project's vocabulary.
   *
   * @param projectId the project ID
   * @param term the term name to check
   * @return true if the term exists in the vocabulary
   */
  public boolean isValidTerm(Integer projectId, String term) {
    if (term == null || term.isBlank()) {
      return false;
    }

    VocabularyTerm[] vocabulary = getVocabulary(projectId);
    return Arrays.stream(vocabulary)
        .anyMatch(vocabTerm -> vocabTerm.getTerm().equalsIgnoreCase(term));
  }
}
