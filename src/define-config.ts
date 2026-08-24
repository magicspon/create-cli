/**
 * The package's public entry point — what a project imports to write its
 * `scaffold.config.ts`.
 *
 * `defineConfig` is an identity function that exists purely for its type: it is
 * what makes a config file autocomplete and typecheck, which is the property
 * ADR 0002 valued in templates and ADR 0003 extends to user-supplied ones.
 */

import type { ScaffoldUserConfig } from './tool/config.ts'

export type {
  Generator,
  GeneratorId,
  NameCasings,
  Registry,
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
