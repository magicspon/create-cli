/**
 * The `meta` boilerplate, which is the only part of a story nobody enjoys
 * writing twice.
 *
 * The component is imported by co-location: same name, same directory. The
 * symbol is derived from the name by casing convention rather than by reading
 * the component — occasionally wrong, always a one-line fix, and it is what
 * keeps a generator cheap enough to be worth adding. (ADR 0001)
 *
 * `Default` carries a `play` function so the story is an interaction test from
 * the first run, wherever the project's Storybook Vitest project executes it.
 * It asserts against the scaffolded component's rendered children, which is the
 * only behaviour a generator can know about — rewrite it as the component grows
 * one.
 *
 * The renderer import is `@storybook/react`, the framework-agnostic default. A
 * project on a framework-specific package overrides `story` in
 * `scaffold.config.ts`. (ADR 0003)
 */

import type { TemplateContext } from '../tool/generators.ts'

/** Render a story whose component import is resolved by co-location. */
export function renderStory({
  pascalName,
  targetImport,
}: TemplateContext): string {
  return `import { ${pascalName} } from '${targetImport}'
import { expect } from 'storybook/test'

import type { Meta, StoryObj } from '@storybook/react'

const meta = {
  component: ${pascalName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ${pascalName}>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: '${pascalName}',
  },
  // TODO: assert what \`${pascalName}\` actually does. This placeholder only
  // proves the story mounts and renders its children.
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('${pascalName}')).toBeVisible()
  },
}
`
}
