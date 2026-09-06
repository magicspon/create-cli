/**
 * The public entry point.
 *
 * Both exports are identity functions that exist for their types, so there is
 * exactly one runtime behaviour worth asserting per overload — plus the one
 * mistake `defineTemplate` refuses by name rather than failing later with an
 * undefined render.
 */

import { describe, expect, it } from 'vitest'
import { defineConfig, defineTemplate } from './define-config.ts'

import type { Template, TemplateMeta } from './tool/generators.ts'

describe('defineConfig', () => {
  it('hands back exactly what it was given', () => {
    const config = {
      presets: ['storybook'],
      directories: { components: 'app' },
    }

    expect(defineConfig(config)).toBe(config)
  })
})

describe('defineTemplate', () => {
  it('returns a bare render untouched — it overrides the render and nothing else', () => {
    const render: Template = () => 'contents'

    expect(defineTemplate(render)).toBe(render)
  })

  it('folds a declaration and a render into one template', () => {
    const meta: TemplateMeta = {
      description: 'A route module',
      directory: 'routes',
      fileName: ({ kebabName }) => `${kebabName}.route.ts`,
    }
    const render: Template = ({ pascalName }) => pascalName

    const declared = defineTemplate(meta, render)

    expect(declared.description).toBe('A route module')
    expect(declared.directory).toBe('routes')
    expect(declared.render).toBe(render)
  })

  it('refuses a declaration with no render, rather than failing later', () => {
    const withoutRender = defineTemplate as (first: TemplateMeta) => unknown

    expect(() => withoutRender({ directory: 'routes' })).toThrow(
      /needs a render function/,
    )
  })
})
