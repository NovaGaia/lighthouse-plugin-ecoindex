import * as yargsHelpers from 'yargs/helpers'

import fs from 'fs'
import path from 'path'
import { readFile } from 'node:fs/promises'
import yargs from 'yargs'

const fileUrl = new URL('../package.json', import.meta.url)
const jsonPackage = JSON.parse(await readFile(fileUrl, 'utf8'))

const EPILOGUE_STRING =
  'For more information on this Lighthouse Ecoindex script helper, see https://github.com/cnumr/lighthouse-plugin-ecoindex#readme'

/**
 * @param {string=} manualArgv
 */
function getYargsParser(manualArgv) {
  // console.log(jsonPackage.version)
  const y = manualArgv
    ? // @ts-expect-error - undocumented, but yargs() supports parsing a single `string`.
      yargs(manualArgv)
    : yargs(yargsHelpers.hideBin(process.argv))
  return y
    .help('help')
    .version(jsonPackage.version)
    .showHelpOnFail(false, 'Specify --help for available options')
    .usage('lighthouse-ecoindex <command> <options>')
    .example(
      'lighthouse-ecoindex collect --demo',
      'Generates a report for the demo URLs.',
    )
    .demand(1)
    .command(
      'collect',
      'Run Lighthouse and save the results to a local folder.',
      commandYargs => collectCommand(commandYargs),
    )
    .command(
      'convert',
      'Convert JSON report(s) generated by `lighthouse-ecoindex` to Environmental Statement file.',
      commandYargs => convertCommand(commandYargs),
    )
    .option('_', {
      array: true, // Always an array, but this lets the type system know.
      type: 'string',
    })
    .epilogue(EPILOGUE_STRING)
}

function collectCommand(yargs) {
  return yargs
    .example(
      'lighthouse-ecoindex collect --demo',
      'Generates a report with the demo file.',
    )
    .example(
      'lighthouse-ecoindex collect --json-file ./input-file.json',
      'Generates multiples reports for multiples courses.',
    )
    .example(
      'lighthouse-ecoindex collect --url https://ecoindex.fr/ ',
      'Generates one report for one URL.',
    )
    .option('demo', {
      alias: 'd',
      type: 'boolean',
      default: false,
      description: 'Use demo collect configuration.',
    })
    .option('url', {
      alias: 'u',
      type: 'array',
      description: 'URL to process, supports multiple values',
    })
    .option('json-file', {
      alias: 'j',
      type: 'string',
      describe: 'Structured file, must respect a schema (see documentation).',
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
      default: './reports/<date-time>',
      coerce: coerceOutputPath,
      description: 'Output folder.',
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      default: /** @type {const} */ (['html']),
      coerce: coerceOutput,
      description:
        'Reporter for the results, supports multiple values. choices: "json", "html", "statement". WARN: "statement" need "json", "csv" is not avalailable.',
    })
    .option('audit-category', {
      alias: 'a',
      type: 'array',
      default: /** @type {const} */ ([
        'performance',
        'seo',
        'accessibility',
        'best-practices',
        'lighthouse-plugin-ecoindex',
      ]),
      description: 'Audit to run, supports multiple values.',
    })
    .epilogue(EPILOGUE_STRING)
}

function convertCommand(yargs) {
  return yargs
    .example(
      'lighthouse-ecoindex convert --input-report ./lh-export-1.json --input-report ./lh-export-2.json',
      'Convert JSON report(s) generated by `lighthouse-ecoindex` to Environmental Statement file.',
    )
    .option('input-report', {
      alias: 'i',
      type: 'array',
      describe:
        'JSON file generate by `lighthouse-ecoindex`. WARN: first is Best pages.',
    })
    .option('output-path', {
      alias: 'p',
      type: 'string',
      default: './reports',
      coerce: coerceOutputPath,
      description: 'Output folder.',
    })
    .epilogue(EPILOGUE_STRING)
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

  // Display referenced audits
  cliFlags['listAllAudits'] = false

  // Save results as reports.
  cliFlags['generationDate'] = new Date().toISOString()

  // Prepare statements reports name
  // if (!cliFlags['input-report']) {
  //   cliFlags['input-report'] = []
  // }

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
  const outputTypes = ['json', 'html', 'statement']
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
