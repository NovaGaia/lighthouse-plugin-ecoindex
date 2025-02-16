import * as LH from 'lighthouse/types/lh.js'
import * as constants from 'lighthouse/core/config/constants.js'

import path, { dirname, join } from 'path'

import _slugify from 'slugify'
import { cleanPath } from './converters.js'
import { exit } from 'process'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { getMandatoryBrowserExecutablePath } from '../install-browser.cjs'
import { isDate } from 'util/types'
import logSymbols from 'log-symbols'

// const moduleDir = '../'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const moduleDir = join(__dirname, '..')

// eslint-disable-next-line no-unused-vars
const fake = LH.Audit

/**
 * Returns list of audit names for external querying.
 * @return {Array<string>}
 */
async function getAuditList() {
  const ignoredFiles = ['lighthouse-nodes.js']

  const fileList = [
    ...fs.readdirSync(path.join(moduleDir, './audits')),
    ...fs.readdirSync(path.join(moduleDir, './audits/bp')).map(f => `bp/${f}`),
  ]
  return fileList
    .filter(f => {
      return /\.js$/.test(f) && !ignoredFiles.includes(f)
    })
    .sort()
}

async function listAudits() {
  const auditsList = await getAuditList()
  const audits = auditsList.map(i => i.replace(/\.js$/, ''))
  process.stdout.write(JSON.stringify({ audits }, null, 2))
  process.stdout.write('\n')
  //   process.exit(0)
}

async function dateToFileString(date) {
  if (isDate(date)) {
    return date.toISOString().replace(/:/g, '-')
  }
  return date.replace(/:/g, '-')
}

/**
 * Read en config JSON file
 * @param {*} cliFlags
 */
async function readJSONFile(cliFlags) {
  const filePath = cliFlags['json-file']
  if (filePath) {
    console.log(`${logSymbols.info} Reading file ${filePath}`)
    const resolvedPath = await path.resolve(filePath)
    try {
      const data = fs.readFileSync(resolvedPath, 'utf8')
      console.log(`${logSymbols.success} File ${filePath} readed.`)
      cliFlags['jsonFileObj'] = await JSON.parse(data)
    } catch (error) {
      console.error(
        `${logSymbols.error} Error reading file from disk: ${error}`,
      )
      process.exit(1)
    }
  }
}

/**
 * Read en extra-heder JSON file
 * @param {*} cliFlags
 */
async function readExtraHeaderFile(cliFlags) {
  const extraHeader = cliFlags['extra-header']
  if (extraHeader && typeof extraHeader === 'string') {
    console.log(`${logSymbols.info} Parsing extra-header JSON...`)
    try {
      cliFlags['extraHeaderObj'] = JSON.stringify(JSON.parse(extraHeader))
      console.log(`${logSymbols.info} Parsing extra-header JSON as a string.`)
      // console.log(`extra-header`, extraHeaderObj)
    } catch (e) {
      // console.error(`Error parsing extra-header JSON: ${e}`)
      console.log(`${logSymbols.info} Reading file ${extraHeader}`)
      const resolvedPath = await path.resolve(extraHeader)
      try {
        const data = fs.readFileSync(resolvedPath, 'utf8')
        console.log(`${logSymbols.success} File ${extraHeader} readed.`)
        // extraHeaderObj = JSON.stringify(JSON.parse(data))
        cliFlags['extraHeaderObj'] = JSON.parse(data)
        // console.log(`extra-header`, extraHeaderObj)
      } catch (error) {
        console.error(
          `${logSymbols.error} Error reading file from disk: ${error}`,
        )
        process.exit(1)
      }
    }
  }
}

/**
 * Init Ecoindex flow. Wait 3s, then navigate to bottom of page.
 * @param {PUPPETEER.Page} page
 * @param {PUPPETEER.CDPSession} session
 */
async function startEcoindexPageMesure(page, session) {
  page.setViewport({
    width: 1920,
    height: 1080,
  })
  await new Promise(r => setTimeout(r, 3 * 1000))
  const dimensions = await page.evaluate(() => {
    var body = document.body,
      html = document.documentElement

    var height = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight,
    )
    return {
      width: document.documentElement.clientWidth,
      height: height,
      deviceScaleFactor: window.devicePixelRatio,
    }
  })
  // console.log('dimensions', dimensions)
  // We need the ability to scroll like a user. There's not a direct puppeteer function for this, but we can use the DevTools Protocol and issue a Input.synthesizeScrollGesture event, which has convenient parameters like repetitions and delay to somewhat simulate a more natural scrolling gesture.
  // https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-synthesizeScrollGesture
  await session.send('Input.synthesizeScrollGesture', {
    x: 100,
    y: 600,
    yDistance: -dimensions.height,
    speed: 1000,
  })
}

/**
 * End Ecoindex flow. Wait 3s.
 * @param {LH.UserFlow} flow
 * @param {boolean} [snapshotEnabled=false]
 */
async function endEcoindexPageMesure(flow, snapshotEnabled = false) {
  await new Promise(r => setTimeout(r, 3 * 1000))
  if (snapshotEnabled) await flow.snapshot()
}

/**
 * Authenticate process
 * @param {PUPPETEER.Page} page
 * @param {PUPPETEER.Browser} browser
 * @param {PUPPETEER.CDPSession} session
 * @param {LH.UserFlow} flow
 * @param {object} authenticate
 */
async function authenticateEcoindexPageMesure(
  page,
  authenticate,
  browser,
  session,
  flow,
) {
  await page.setViewport({
    width: 1920,
    height: 1080,
  })
  try {
    await page.type(authenticate.user.target, authenticate.user.value)
    const searchValue = await page.$eval(
      authenticate.user.target,
      el => el.value,
    )
    console.log(
      `${logSymbols.info} (test) ${authenticate.user.target} setted with`,
      searchValue,
    )

    await page.type(authenticate.pass.target, authenticate.pass.value)
    await page.click('[type="submit"]')
    await page.waitForNavigation()
    const u = page.url()

    console.log(`${logSymbols.info} Authenticated! Landed on`, u)
    // try to mesure landed page, NOT WORKING.
    // await flow.navigate(u, { name: 'Navigate only' })
    startEcoindexPageMesure(page, session)
    endEcoindexPageMesure(flow)
    await flow.snapshot({ name: 'Landed page' })
    return u
  } catch (error) {
    console.error(`${logSymbols.error} Connection failed!`)
    console.error(error)
    exit(1)
  }
}

/**
 * Return config for Lighthouse
 * @param {boolean} isWarm
 * @returns {lighthouse.Config}
 */
function getLighthouseConfig(
  isWarm = false,
  stepName = `undefined`,
  onlyCategories = ['lighthouse-plugin-ecoindex'],
  userAgent,
) {
  return {
    name: stepName,
    config: {
      extends: 'lighthouse:default',
      artifacts: [
        {
          id: 'DOMInformations',
          gatherer: 'lighthouse-plugin-ecoindex/gatherers/dom-informations',
        },
      ],
      settings: {
        onlyCategories: onlyCategories,
        formFactor: 'desktop',
        throttling: constants.throttling.desktopDense4G,
        screenEmulation: {
          mobile: false,
          width: 1920,
          height: 1080,
        },
        emulatedUserAgent:
          userAgent === 'random'
            ? userAgentStrings[
                Math.floor(Math.random() * userAgentStrings.length)
              ]
            : userAgent,
        maxWaitForLoad: 60 * 1000,
        disableStorageReset: isWarm,
      },
      plugins: ['lighthouse-plugin-ecoindex'],
    },
  }
}

const userAgentStrings = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.2227.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.3497.92 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
]

async function getPuppeteerConfig() {
  return {
    headless: true,
    executablePath: await getMandatoryBrowserExecutablePath(),
    ignoreHTTPSErrors: true,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
    ],
  }
}

function getEnvStatementsObj(exportPath, withStatement = true) {
  const _exportPath = withStatement
    ? `${exportPath}/statements`
    : `${exportPath}`
  return {
    courses: [],
    statements: {
      json: cleanPath(`${_exportPath}/ecoindex-environmental-statement.json`),
      html: cleanPath(`${_exportPath}/ecoindex-environmental-statement.html`),
      md: cleanPath(`${_exportPath}/ecoindex-environmental-statement.md`),
    },
  }
}

const normalizeSlug = str => {
  if (str === ``) {
    throw new Error(`Object or String argument can't be empty.`)
  }
  let output = ``

  if (typeof str === 'object') {
    if (Array.isArray(str)) {
      str.forEach(child => {
        output = output + normalizeSlug(child)
      })
      return output
    } else if (str.props && str.props.children) {
      return normalizeSlug(str.props.children)
    }
  }

  try {
    output = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  } catch (error) {
    console.warn(error)
    console.warn(`str`, str)
  }
  return output
}

/**
 * Méthode pour slugifier un object ou une string
 * @param {*} children
 * @returns {String} Object or String mith slug format.
 */
const slugify = children => {
  let slug = ``

  slug = normalizeSlug(children).replace(/\W/g, '-')

  return _slugify(slug, {
    lower: true,
  })
}

export {
  authenticateEcoindexPageMesure,
  dateToFileString,
  endEcoindexPageMesure,
  getEnvStatementsObj,
  getLighthouseConfig,
  getPuppeteerConfig,
  listAudits,
  readExtraHeaderFile,
  readJSONFile,
  slugify,
  startEcoindexPageMesure,
}
