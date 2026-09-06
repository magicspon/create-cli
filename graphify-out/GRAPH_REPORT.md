# Graph Report - create-cli  (2026-09-06)

## Corpus Check
- 82 files · ~41,883 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 532 nodes · 835 edges · 45 communities (34 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5a86ac9b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Damp CLI Output and Directory Prompt|Damp CLI: Output and Directory Prompt]]
- [[_COMMUNITY_Build and Tooling Configuration|Build and Tooling Configuration]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Storybook Example Components|Storybook Example Components]]
- [[_COMMUNITY_Router and Query Runtime|Router and Query Runtime]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_TypeScript Compiler Options|TypeScript Compiler Options]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_shadcn components.json Config|shadcn components.json Config]]
- [[_COMMUNITY_Package Manifest and Scripts|Package Manifest and Scripts]]
- [[_COMMUNITY_shadcn Skill Index|shadcn Skill Index]]
- [[_COMMUNITY_shadcn CLI Reference|shadcn CLI Reference]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Renovate Dependency Automation|Renovate Dependency Automation]]
- [[_COMMUNITY_shadcn Theming and Customization|shadcn Theming and Customization]]
- [[_COMMUNITY_Storybook Docs and Sharing Assets|Storybook Docs and Sharing Assets]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Prettier Config Module|Prettier Config Module]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Changesets Release Config|Changesets Release Config]]
- [[_COMMUNITY_AGENTS.md Project Conventions|AGENTS.md Project Conventions]]
- [[_COMMUNITY_ESLint Config Module|ESLint Config Module]]
- [[_COMMUNITY_pnpm Workspace Install Policy|pnpm Workspace Install Policy]]
- [[_COMMUNITY_Claude Code Permissions|Claude Code Permissions]]
- [[_COMMUNITY_Accessibility and Addon Ecosystem|Accessibility and Addon Ecosystem]]
- [[_COMMUNITY_Storybook Testing and Theming|Storybook Testing and Theming]]
- [[_COMMUNITY_Component Styling Options|Component Styling Options]]
- [[_COMMUNITY_Learning Resource Links|Learning Resource Links]]
- [[_COMMUNITY_Component Context Layers|Component Context Layers]]
- [[_COMMUNITY_Changesets README|Changesets README]]
- [[_COMMUNITY_Commitlint Config|Commitlint Config]]
- [[_COMMUNITY_Static Assets Illustration|Static Assets Illustration]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 21 edges
2. `resolveConfig()` - 19 edges
3. `Generator` - 17 edges
4. `ScaffoldConfig` - 15 edges
5. `scripts` - 14 edges
6. `pickTarget()` - 13 edges
7. `plan` - 13 edges
8. `unwrap()` - 12 edges
9. `releaseStdin()` - 11 edges
10. `@magicspon/create-cli` - 11 edges

## Surprising Connections (you probably didn't know these)
- `pnpm onlyBuiltDependencies Allowlist` --semantically_similar_to--> `Claude Code Permission Policy`  [INFERRED] [semantically similar]
  package.json → .claude/settings.json
- `generate-routes (tsr generate)` --implements--> `File-Based Routing in src/routes`  [INFERRED]
  package.json → README.md
- `TypeScript Bundler-Mode Compiler Options` --conceptually_related_to--> `Router Full Type Inference Philosophy`  [INFERRED]
  tsconfig.json → AGENTS.md
- `T3Env Type-Safe Environment Variables` --semantically_similar_to--> `Isomorphic-by-Default Execution Model`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `T3Env Type-Safe Environment Variables` --shares_data_with--> `#/* Subpath Import Alias`  [EXTRACTED]
  README.md → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Directory Prompt: search, rank, anchor, write** — readme_picking_a_directory, cli_directories_createdirectorysearch, cli_directories_fuzzyscore, cli_output_writeresult [EXTRACTED 0.90]

## Communities (45 total, 11 thin omitted)

### Community 0 - "Damp CLI: Output and Directory Prompt"
Cohesion: 0.29
Nodes (6): A directory key nothing configures resolves under `src`, Consequences, `scaffold/templates` is found without being configured, Template files declare their own generator, The filename is still the only id, What still catches a typo

### Community 1 - "Build and Tooling Configuration"
Cohesion: 0.11
Nodes (21): Claude Code Permission Policy, Devtools EventClient Protocol, TanStack Devtools Plugin System, Devtools Vite Plugin Must Be First, Router Full Type Inference Philosophy, Isomorphic-by-Default Execution Model, TanStack Intent Skill Registry, generate-routes (tsr generate) (+13 more)

### Community 2 - "Dev Dependencies"
Cohesion: 0.11
Nodes (17): config, devDependencies, @changesets/changelog-github, @changesets/cli, @commitlint/cli, @commitlint/config-conventional, husky, nano-staged (+9 more)

### Community 3 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (16): DirectoryOption, IGNORED, listDirectories(), walk(), fuzzyScore(), normalise(), createRegistry(), listFiles() (+8 more)

### Community 4 - "Storybook Example Components"
Cohesion: 0.10
Nodes (29): commit(), format(), accepted, rejected, isInside(), casingsOf(), GeneratorId, hookNameOf() (+21 more)

### Community 5 - "Router and Query Runtime"
Cohesion: 0.09
Nodes (48): Chosen, createMain(), GeneratorArgs, kitCommand, loadCliConfig(), parseWith(), resolveChoice(), runGenerator() (+40 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (37): 1. Install, 2. Add a script, 3. Run it, 4. Add a config file when you need one, 5. Try the wizard, A directory of templates, A first generator, A generator in one file (+29 more)

### Community 7 - "TypeScript Compiler Options"
Cohesion: 0.08
Nodes (23): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, isolatedModules, lib, module, moduleResolution, noEmit (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.50
Nodes (3): Consequences, Generators come from the project's config, not from the package, Templates stay TypeScript functions

### Community 9 - "shadcn components.json Config"
Cohesion: 0.50
Nodes (3): Consequences, The package ships compiled JavaScript, What builds it

### Community 10 - "Package Manifest and Scripts"
Cohesion: 0.04
Nodes (44): author, bin, scaffold, bugs, default, dependencies, c12, citty (+36 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (16): commitMessageAction, commitMessagePrefix, commitMessageTopic, customManagers, dependencyDashboard, extends, lockFileMaintenance, commitMessageTopic (+8 more)

### Community 16 - "Storybook Docs and Sharing Assets"
Cohesion: 0.18
Nodes (14): Discord Community Support Channel, Discord Brand Icon (SVG), argTypes and Controls-Driven Props Table, Autodocs Screenshot: Meta tags autodocs to generated Docs page, Storybook autodocs Tag in Component Meta, Design-to-Story Visual Parity, Figma Plugin Screenshot: Storybook Connect in Figma Design File, Storybook Connect Figma Plugin (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.40
Nodes (4): A template that matches nothing is an error, Consequences, Template files are matched to generators by filename, Why the filename, and not a map in the config

### Community 20 - "Prettier Config Module"
Cohesion: 0.17
Nodes (11): categories, correctness, env, builtin, ignorePatterns, options, typeAware, overrides (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (8): A named kit that is missing or empty refuses the run, A project's own templates win, Consequences, `kit` is a reserved generator id, Kits live in the user's home directory, Kits never apply unless they are named, Templates resolve `@magicspon/create-cli` from the tool, not from themselves, The kit is parsed out of argv by hand, and then again by citty

### Community 22 - "Community 22"
Cohesion: 0.50
Nodes (3): 1.0.0, @magicspon/create-cli, Major Changes

### Community 23 - "Changesets Release Config"
Cohesion: 0.18
Nodes (10): access, baseBranch, changelog, commit, fixed, format, ignore, linked (+2 more)

### Community 30 - "AGENTS.md Project Conventions"
Cohesion: 0.17
Nodes (11): Architecture in one paragraph, Commands, Comments, Communication, Conventions, fallow, graphify, Grilling (+3 more)

### Community 31 - "ESLint Config Module"
Cohesion: 0.22
Nodes (8): ignorePatterns, overrides, printWidth, $schema, semi, singleQuote, sortPackageJson, trailingComma

### Community 32 - "pnpm Workspace Install Policy"
Cohesion: 0.36
Nodes (8): allowBuilds Postinstall Allowlist, esbuild (native build dependency), minimumReleaseAgeExclude Supply-Chain Cooldown Bypass, Single-Package Root Workspace ('.'), @tanstack/react-start-client@1.168.26, @tanstack/start-server-core@1.169.27, unrs-resolver (native build dependency), pnpm Workspace Definition

### Community 33 - "Claude Code Permissions"
Cohesion: 0.29
Nodes (6): permissions, allow, ask, defaultMode, deny, $schema

### Community 34 - "Accessibility and Addon Ecosystem"
Cohesion: 0.33
Nodes (6): Accessibility Addon Panel Screenshot, Automated Accessibility Audit Panel, Axe Rule Result List, Accessibility Icon (Universal Access Glyph), Storybook Addon Ecosystem Grid, Storybook Addon / Integration Ecosystem

### Community 35 - "Storybook Testing and Theming"
Cohesion: 0.33
Nodes (6): Storybook Test Runner Panel Screenshot, Histogram: Default Story Under Test, Interaction Test Panel with Pass/Fail State and Step Playback Controls, Storybook Theming Before/After Screenshot, Branded Storybook UI (Acme Dark Theme Overlay on Default Light Theme), Storybook Sidebar Story Tree (Example > Button > Docs/Primary/Secondary/Large/Small)

### Community 38 - "Component Styling Options"
Cohesion: 0.67
Nodes (3): Styling Ecosystem Icon Grid, Component Styling Approach, CSS Styling Tool Logos (Tailwind, MUI, Emotion, Styled Components, Bootstrap, Sass)

### Community 39 - "Learning Resource Links"
Cohesion: 0.67
Nodes (3): Tutorials Book Icon (SVG), YouTube Play Button Logo (SVG), Video-Based Learning Resource Link

### Community 48 - "Claude Settings"
Cohesion: 0.40
Nodes (4): Agent skills, Domain docs, Issue tracker, Triage labels

### Community 51 - "Community 51"
Cohesion: 0.06
Nodes (40): defineConfig(), defineTemplate(), renderComponent(), renderHook(), renderHookTest(), renderMswTest(), renderStory(), renderTest() (+32 more)

### Community 54 - "Community 54"
Cohesion: 0.29
Nodes (6): Boundaries, Context: @magicspon/create-cli, Decisions, Glossary, Invariants, Scaffolding

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (5): Conventions, Issue tracker: GitHub, Labels, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

## Ambiguous Edges - Review These
- `GitHub Source Repository Link` → `Chromatic Hosted Storybook Publishing`  [AMBIGUOUS]
  src/stories/assets/share.png · relation: conceptually_related_to

## Knowledge Gaps
- **250 isolated node(s):** `$schema`, `baseBranch`, `access`, `format`, `changelog` (+245 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `GitHub Source Repository Link` and `Chromatic Hosted Storybook Publishing`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Generator` connect `Community 51` to `Runtime Dependencies`, `Storybook Example Components`, `Router and Query Runtime`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Dev Dependencies` to `Package Manifest and Scripts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `resolveConfig()` connect `Community 51` to `Runtime Dependencies`, `Storybook Example Components`, `Router and Query Runtime`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `$schema`, `baseBranch`, `access` to the rest of the system?**
  _253 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Build and Tooling Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.11428571428571428 - nodes in this community are weakly interconnected._
- **Should `Dev Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._