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

import org.gbif.occurrence.annotation.model.Country;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;

/**
 * Controller for serving static country polygon data.
 * Data is loaded from classpath resource country_polygons.json on first access.
 */
@Slf4j
@RestController
@RequestMapping(
    value = "/occurrence/experimental/annotation/countries",
    produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Countries", description = "Country geometry endpoints for polygon selection")
public class CountryController {

  private static final String COUNTRIES_RESOURCE = "/countries/country_polygons.json";

  private final ObjectMapper objectMapper;
  private Map<String, Country> countryCache;

  public CountryController(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  /**
   * Get all country geometries.
   *
   * @return List of all countries with WKT geometries
   */
  @GetMapping("/geometries")
  @Operation(
      summary = "List all country geometries",
      description = "Returns all country polygons as WKT for frontend country selector")
  public List<Country> getAllCountryGeometries() {
    ensureCountriesLoaded();
    return List.copyOf(countryCache.values());
  }

  /**
   * Get geometry for a specific country by ISO2 code.
   *
   * @param iso2 ISO 3166-1 alpha-2 country code (e.g., "US", "GB")
   * @return Country with WKT geometry
   */
  @GetMapping("/{iso2}/geometry")
  @Operation(
      summary = "Get country geometry",
      description = "Returns a single country's polygon as WKT by ISO2 code")
  public Country getCountryGeometry(@PathVariable String iso2) {
    ensureCountriesLoaded();

    String upperIso2 = iso2.toUpperCase();
    Country country = countryCache.get(upperIso2);

    if (country == null) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Country not found: " + upperIso2);
    }

    return country;
  }

  /**
   * Lazy load country data from JSON resource file on first access.
   * Data is cached in memory for subsequent requests.
   */
  private synchronized void ensureCountriesLoaded() {
    if (countryCache != null) {
      return; // Already loaded
    }

    log.info("Loading country geometries from {}", COUNTRIES_RESOURCE);

    try (InputStream inputStream = getClass().getResourceAsStream(COUNTRIES_RESOURCE)) {
      if (inputStream == null) {
        throw new IOException("Resource not found: " + COUNTRIES_RESOURCE);
      }

      List<Country> countries =
          objectMapper.readValue(inputStream, new TypeReference<List<Country>>() {});

      // Build map index by ISO2 code for fast lookup
      countryCache = new HashMap<>();
      for (Country country : countries) {
        countryCache.put(country.getIso2().toUpperCase(), country);
      }

      log.info("Loaded {} countries", countryCache.size());

    } catch (IOException e) {
      log.error("Failed to load country geometries", e);
      throw new ResponseStatusException(
          HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load country data", e);
    }
  }
}
