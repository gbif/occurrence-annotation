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
package org.gbif.occurrence.annotation.config;

import java.io.Serializable;
import java.util.Collection;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.annotation.Order;
import org.springframework.security.access.AccessDecisionManager;
import org.springframework.security.access.ConfigAttribute;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.method.configuration.GlobalMethodSecurityConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.core.Authentication;

@TestConfiguration
@Configuration
@Order(1)
public class TestSecurityConfig extends WebSecurityConfigurerAdapter {

  @Override
  protected void configure(HttpSecurity http) throws Exception {
    http.csrf().disable().authorizeRequests().anyRequest().permitAll();
  }

  /** Override method security configuration to allow all access in tests */
  @Configuration
  @EnableGlobalMethodSecurity(prePostEnabled = true, securedEnabled = true, jsr250Enabled = true)
  @Primary
  public static class TestMethodSecurityConfiguration extends GlobalMethodSecurityConfiguration {

    @Override
    protected MethodSecurityExpressionHandler createExpressionHandler() {
      DefaultMethodSecurityExpressionHandler expressionHandler =
          new DefaultMethodSecurityExpressionHandler();
      expressionHandler.setPermissionEvaluator(new PermitAllPermissionEvaluator());
      return expressionHandler;
    }

    @Override
    protected AccessDecisionManager accessDecisionManager() {
      // Use a voter that always grants access
      return new PermitAllAccessDecisionManager();
    }
  }

  /** Permission evaluator that permits all access */
  public static class PermitAllPermissionEvaluator implements PermissionEvaluator {
    @Override
    public boolean hasPermission(
        Authentication authentication, Object targetDomainObject, Object permission) {
      return true;
    }

    @Override
    public boolean hasPermission(
        Authentication authentication,
        Serializable targetId,
        String targetType,
        Object permission) {
      return true;
    }
  }

  /** AccessDecisionManager that always grants access */
  public static class PermitAllAccessDecisionManager implements AccessDecisionManager {
    @Override
    public void decide(
        Authentication authentication,
        Object object,
        Collection<ConfigAttribute> configAttributes) {
      // Always allow access in tests - do nothing
    }

    @Override
    public boolean supports(ConfigAttribute attribute) {
      return true;
    }

    @Override
    public boolean supports(Class<?> clazz) {
      return true;
    }
  }
}
