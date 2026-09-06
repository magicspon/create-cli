#!/usr/bin/env node
/**
 * The scaffolder CLI — the bin, and nothing else.
 *
 * The config is loaded before the command is defined rather than inside a
 * handler: the subcommand list *is* the registry, so it cannot be built until
 * the config file has been read. That is also why this file holds only these
 * two lines — importing it loads a config and runs a command, so everything
 * worth testing lives in `tool/cli.ts` instead.
 */

import { runMain } from 'citty'
import { createMain, loadCliConfig } from './tool/cli.ts'

const config = await loadCliConfig(process.argv.slice(2))

void runMain(createMain(config))
