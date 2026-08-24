/**
 * The package's public entry point — what a project imports to write its
 * `scaffold.config.ts`.
 *
 * `defineConfig` is an identity function that exists purely for its type: it is
 * what makes a config file autocomplete and typecheck, which is the property
 * ADR 0002 valued in templates and ADR 0003 extends to user-supplied ones.
 */

import type { ScaffoldUserConfig } from './tool/config.ts'
import type { Template } from './tool/generators.ts'

export type {
  Generator,
  GeneratorId,
  NameCasings,
  Registry,
  Template,
  TemplateContext,
} from './tool/generators.ts'

export type { ScaffoldConfig, ScaffoldUserConfig } from './tool/config.ts'

/**
 * Type a `scaffold.config.ts` without annotating it.
 *
 * ```ts
 * import { defineConfig } from '@magicspon/scaffold'
 *
 * export default defineConfig({
 *   presets: ['storybook'],
 *   directories: { components: 'app/ui' },
 * })
 * ```
 */
export function defineConfig(config: ScaffoldUserConfig): ScaffoldUserConfig {
  return config
}

/**
 * Type a template file in the configured `templates` directory without
 * annotating its context.
 *
 * The same identity trick as `defineConfig`, for the same reason: a file whose
 * whole content is one exported function has nowhere else to hang the type.
 *
 * ```ts
 * // scaffold/templates/component.ts
 * import { defineTemplate } from '@magicspon/scaffold'
 *
 * export default defineTemplate(({ pascalName }) => `...`)
 * ```
 */
export function defineTemplate(template: Template): Template {
  return template
}
