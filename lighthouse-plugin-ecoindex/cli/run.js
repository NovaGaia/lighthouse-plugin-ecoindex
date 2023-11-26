import {
  endEcoindexPageMesure,
  getLighthouseConfig,
  getPuppeteerConfig,
  readExtraHeaderFile,
  readJSONFile,
  startEcoindexPageMesure,
} from './commands.js'

import logSymbols from 'log-symbols'
import puppeteer from 'puppeteer'
import { startFlow } from 'lighthouse'

const SEPARATOR = '\n---------------------------------\n'

async function runCourse(urls, cliFlags) {
  console.log(`${logSymbols.info} Mesure(s) start 🚀`)
  // console.log(`cliFlags`, cliFlags)

  // Launch a headless browser.
  const browser = await puppeteer.launch(getPuppeteerConfig)

  // Create a new page.
  const page = await browser.newPage()
  console.log('List of urls:', urls)
  console.log(SEPARATOR)

  // Add extra-header
  if (cliFlags['extraHeaderObj']) {
    console.log(`${logSymbols.info} Setting extra-header...`)
    console.log(
      `${logSymbols.success} extra-header`,
      cliFlags['extraHeaderObj'],
    )
    await page.setExtraHTTPHeaders(cliFlags['extraHeaderObj'])
    console.log(SEPARATOR)
  }
  // Get a session handle to be able to send protocol commands to the page.
  const session = await page.target().createCDPSession()
  // Get a flow handle to be able to send protocol commands to the page.
  const flow = await startFlow(
    page,
    getLighthouseConfig(false, `Warm Navigation: ${urls[0]}`),
  )

  console.log(`${logSymbols.info} Mesuring...`)
  console.log(`Mesure 0: ${urls[0]}`)

  // Navigate with first URL
  await flow.navigate(urls[0], {
    stepName: urls[0],
  })

  await startEcoindexPageMesure(page, session)
  await endEcoindexPageMesure(flow)

  // Navigate with next URLs
  for (var i = 1; i < urls.length; i++) {
    if (urls[i].trim() !== '') {
      console.log(`Mesure ${i}: ${urls[i]}`)
      await flow.navigate(
        urls[i],
        getLighthouseConfig(true, `Cold Navigation: ${urls[i]}`),
      )
      await startEcoindexPageMesure(page, session)
      await endEcoindexPageMesure(flow)
    }
  }

  console.log(SEPARATOR)
  console.log(`${logSymbols.success} Mesure(s) ended 🎉`)
  console.log(SEPARATOR)
  cliFlags['reportsFlows'].push(flow)
  // Close the browser.
  await browser.close()
}

async function runCourses(cliFlags) {
  // validate minimum options
  if (!cliFlags['json-file'] && !cliFlags['url'] && !cliFlags['demo']) {
    console.error(
      `${logSymbols.error} Use \`lighthouse-ecoindex collect --demo true\` \nOR please provide a file path \`lighthouse-ecoindex collect --json-file ./input-file.json\` \nOR provide URLs \`lighthouse-ecoindex collect --url https://www.example.com --url https://www.example1.com\` as options.`,
    )
    process.exit(1)
  }
  // validate no conflict options
  if (cliFlags['json-file'] && cliFlags['url']) {
    console.error(
      `${logSymbols.error} You can not use \`--json-file\` and \`--url\` options at the same time.`,
    )
    process.exit(1)
  }
  // Read config file
  await readJSONFile(cliFlags)
  // Read extra-header file
  await readExtraHeaderFile(cliFlags)
  // validate no conflict options
  if (cliFlags['jsonFileObj']?.['extra-header'] && cliFlags['extraHeaderObj']) {
    console.error(
      `${logSymbols.error} You can not use \`--json-file\` with an \`extra-header\` attribute and \`--extra-header\` options at the same time.`,
    )
    process.exit(1)
  }
  // save `extra-header` from input file in specific var.
  if (cliFlags['jsonFileObj']?.['extra-header']) {
    cliFlags['extraHeaderObj'] = cliFlags['jsonFileObj']?.['extra-header']
  }
  // send to the right workflow
  if (cliFlags['url']) {
    console.log(`${logSymbols.info} Course an array of urls`)
    // console.log(`urls`, cliFlags['url'])
    await runCourse(cliFlags['url'], cliFlags)
  } else if (cliFlags['jsonFileObj']?.parcours.length === 1) {
    console.log(`${logSymbols.info} One course in the json file`)
    // console.log(`jsonFileObj`, cliFlags['jsonFileObj'])
    await runCourse(cliFlags['jsonFileObj'].parcours[0].urls, cliFlags)
  } else {
    console.log(`${logSymbols.info} Multiples courses in the json file`)
    for (
      let index = 0;
      index < cliFlags['jsonFileObj'].parcours.length;
      index++
    ) {
      const parcours = cliFlags['jsonFileObj'].parcours[index]
      await runCourse(parcours.urls, cliFlags)
    }
  }
}

async function generateEnvironmentalStatement(cliFlags) {
  console.log(`${logSymbols.info} generateEnvironmentalStatement`)
  console.log(`cliFlags`, cliFlags)
}

export { generateEnvironmentalStatement, runCourses }
