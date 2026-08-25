/**
 * The package's public entry point — what a project imports to write its
 * `scaffold.config.ts`.
 *
 * `defineConfig` is an identity function that exists purely for its type: it is
 * what makes a config file autocomplete and typecheck, which is the property
 * ADR 0002 valued in templates and ADR 0003 extends to user-supplied ones.
 */

import type { ScaffoldUserConfig } from './tool/config.ts'
import type {
  DeclaredTemplate,
  Template,
  TemplateMeta,
} from './tool/generators.ts'

export type {
  DeclaredTemplate,
  Generator,
  GeneratorId,
  NameCasings,
  Registry,
  Template,
  TemplateContext,
  TemplateMeta,
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
 * Type a template file in the templates directory without annotating its
 * context.
 *
 * The same identity trick as `defineConfig`, for the same reason: a file whose
 * whole content is one exported function has nowhere else to hang the type.
 *
 * Given only a render, it overrides the render of the generator its filename
 * names and nothing else (ADR 0005). Given a config first, it overrides
 * whatever else that config names — or, for a filename naming no existing
 * generator, declares one, which is how a project adds a generator without a
 * config file. There is no `id`: the filename is the id. (ADR 0006)
 *
 * ```ts
 * // scaffold/templates/component.ts — the built-in, our house style
 * export default defineTemplate(({ pascalName }) => `...`)
 * ```
 *
 * ```ts
 * // scaffold/templates/route.ts — a generator this project invented
 * export default defineTemplate(
 *   {
 *     description: 'A route module',
 *     directory: 'routes',
 *     fileName: ({ kebabName }) => `${kebabName}.route.ts`,
 *   },
 *   ({ kebabName, pascalName }) =>
 *     `export const ${pascalName}Route = {\n  path: '/${kebabName}',\n}\n`,
 * )
 * ```
 */
export function defineTemplate(render: Template): Template
export function defineTemplate(
  config: TemplateMeta,
  render: Template,
): DeclaredTemplate
export function defineTemplate(
  first: Template | TemplateMeta,
  second?: Template,
): Template | DeclaredTemplate {
  if (typeof first === 'function') return first

  // Reachable only from JavaScript, or from the mistake of pasting a config
  // object where a render belongs — both worth naming rather than failing
  // later with an undefined render.
  if (!second) {
    throw new Error(
      'defineTemplate(config, render) needs a render function as its second ' +
        'argument. Pass only a render function to override a generator’s render.',
    )
  }

  return { ...first, render: second }
}
