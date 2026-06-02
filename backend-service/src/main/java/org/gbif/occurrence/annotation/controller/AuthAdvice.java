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

import org.gbif.api.vocabulary.UserRole;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;

@ControllerAdvice
public class AuthAdvice {
  @ResponseBody
  @ExceptionHandler(NotAuthorisedException.class)
  @ResponseStatus(HttpStatus.UNAUTHORIZED)
  String notAuthorised(NotAuthorisedException ex) {
    return ex.getMessage();
  }

  @ResponseBody
  @ExceptionHandler(IllegalArgumentException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  ErrorResponse badRequest(IllegalArgumentException ex) {
    return new ErrorResponse(ex.getMessage());
  }

  public static class ErrorResponse {
    private final String message;

    public ErrorResponse(String message) {
      this.message = message;
    }

    public String getMessage() {
      return message;
    }
  }

  public static class NotAuthorisedException extends RuntimeException {
    public NotAuthorisedException(String message) {
      super(message);
    }
  }

  /**
   * Checks if the currently logged-in user is the creator of the object or an administrator.
   *
   * @param creator The creator of the object to test against
   * @throws NotAuthorisedException If the user is not the creator or an administrator
   */
  static void assertCreatorOrAdmin(String creator) throws NotAuthorisedException {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    String loggedInUser = authentication.getName();
    if (!creator.equals(loggedInUser)) {

      boolean isAdmin =
          SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
              .anyMatch(r -> r.getAuthority().equals(UserRole.REGISTRY_ADMIN.toString()));

      if (!isAdmin) {
        throw new AuthAdvice.NotAuthorisedException(
            "Only the creator or an administrator can perform this action");
      }
    }
  }
}
