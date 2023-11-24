import fs from 'fs'
import path from 'path'

import yargs from 'yargs'
import * as yargsHelpers from 'yargs/helpers'

/**
 * @param {string=} manualArgv
 */
function getYargsParser(manualArgv) {
  const y = manualArgv
    ? // @ts-expect-error - undocumented, but yargs() supports parsing a single `string`.
      yargs(manualArgv)
    : yargs(yargsHelpers.hideBin(process.argv))
  return y
    .help('help')
    .version(JSON.parse(fs.readFileSync(`../package.json`, 'utf-8')).version)
    .showHelpOnFail(false, 'Specify --help for available options')
    .usage('lighthouse-ecoindex <command> <options>')
    .example(
      'lighthouse-ecoindex collect --demo',
      'Generates a report for the demo URLs.',
    )
    .demand(1)
    .command(
      'collect',
      'Run Lighthouse and save the results to a local folder',
      commandYargs => buildCommand(commandYargs),
    )
    .command(
      'generate',
      'Convert JSON report to Environmental Statement file.',
      // commandYargs => generateCmd.buildCommand(commandYargs),
    )
    .option('_', {
      array: true, // Always an array, but this lets the type system know.
      type: 'string',
    })

    .epilogue(
      'For more information on this Lighthouse Ecoindex script helper, see https://github.com/cnumr/lighthouse-plugin-ecoindex#readme',
    )
}

function buildCommand(yargs) {
  return yargs
    .example(
      'lighthouse-ecoindex collect --demo',
      'Generates a report for the demo URLs.',
    )
    .option('demo', {
      alias: 'd',
      type: 'boolean',
      default: false,
      description: 'Use demo URLs.',
    })
    .option('url', {
      alias: 'u',
      type: 'array',
      description: 'URL to process, supports multiple values',
    })
    .option('urls-file', {
      alias: 'f',
      type: 'string',
      describe: 'Input file path. 1 url per line.',
    })
    .option('extra-header', {
      alias: 'h',
      type: 'string',
      default: null,
      description:
        'Extra object config for Lighthouse. JSON string or path to a JSON file.',
    })
    .option('output-path', {
      alias: 'p',
      type: 'string',
      default: './reports',
      coerce: coerceOutputPath,
      description: 'Output folder.',
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      default: /** @type {const} */ (['html']),
      coerce: coerceOutput,
      description:
        'Reporter for the results, supports multiple values. choices: "json", "html". WARN: "csv" is not avalailable with flow.',
    })
}

function generateCommand(yargs) {
  return yargs
}

/**
 * @param {string=} manualArgv
 * @param {{noExitOnFailure?: boolean}=} options
 * @return {LH.CliFlags}
 */
function getFlags(manualArgv, options = {}) {
  let parser = getYargsParser(manualArgv)

  if (options.noExitOnFailure) {
    // Silence console.error() logging and don't process.exit().
    // `parser.fail(false)` can be used in yargs once v17 is released.
    parser = parser.fail((msg, err) => {
      if (err) throw err
      else if (msg) throw new Error(msg)
    })
  }

  // Augmenting yargs type with auto-camelCasing breaks in tsc@4.1.2 and @types/yargs@15.0.11,
  // so for now cast to add yarg's camelCase properties to type.
  const argv = /** @type {Awaited<typeof parser.argv>} */ (parser.argv)
  const cliFlags =
    /** @type {typeof argv & LH.Util.CamelCasify<typeof argv>} */ (argv)

  // yargs will return `undefined` for options that have a `coerce` function but
  // are not actually present in the user input. Instead of passing properties
  // explicitly set to undefined, delete them from the flags object.
  for (const [k, v] of Object.entries(cliFlags)) {
    if (v === undefined) delete cliFlags[k]
  }

  return cliFlags
}

/**
 * Coerce output CLI input to `LH.SharedFlagsSettings['output']` or throw if not possible.
 * @param {Array<unknown>} values
 * @return {Array<LH.OutputMode>}
 */
// eslint-disable-next-line no-unused-vars
function coerceOutput(values) {
  // console.log(`values`, values)
  // console.log(`typeof values`, typeof values)
  // console.log(`Array.isArray(values)`, Array.isArray(values))
  const outputTypes = ['json', 'html']
  const errorHint = `Argument 'output' must be an array from choices "${outputTypes.join(
    '", "',
  )}"`
  if (!Array.isArray(values)) {
    values = [values]
  }
  if (
    !values.every(/** @return {boolean} */ item => typeof item === 'string')
  ) {
    throw new Error('Invalid values. ' + errorHint)
  }
  // Allow parsing of comma-separated values.
  const strings = values.flatMap(value => value.split(','))
  const validValues = strings.filter(
    /** @return {str is LH.OutputMode} */ str => {
      if (!outputTypes.includes(str)) {
        throw new Error(`"${str}" is not a valid 'output' value. ` + errorHint)
      }
      return true
    },
  )

  return validValues
}

/**
 * Verifies outputPath is something we can actually write to.
 * @param {unknown=} value
 * @return {string=}
 */
// eslint-disable-next-line no-unused-vars
function coerceOutputPath(value) {
  if (value === undefined) return

  if (
    typeof value !== 'string' ||
    !value ||
    !fs.existsSync(path.dirname(value))
  ) {
    throw new Error(`--output-path (${value}) cannot be written to`)
  }

  return value
}

export { getFlags }
