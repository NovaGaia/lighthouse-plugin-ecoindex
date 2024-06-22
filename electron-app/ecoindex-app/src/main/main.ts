import { chomp, chunksToLinesAsync } from '@rauschma/stringio'
import { ChildProcess, spawn } from 'child_process'
import { BrowserWindow, IpcMainEvent, app, dialog, ipcMain } from 'electron'

import fixPath from 'fix-path'
import fs from 'fs'
import { shellEnv } from 'shell-env'
import packageJson from '../../package.json'
import { channels } from '../shared/constants'

// const execFile = util.promisify(_execFile);

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string

let workDir = ''

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: true,
    },
  })

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  ipcMain.handle(channels.FAKE_RUN, handleRunFakeMesure)
  ipcMain.handle(channels.SELECT_FOLDER, handleSelectFolder)
  ipcMain.handle(channels.GET_NODE_VERSION, getNodeVersion)
  ipcMain.handle(channels.GET_WORKDIR, handleWorkDir)
  ipcMain.handle(
    channels.IS_LIGHTHOUSE_ECOINDEX_INSTALLED,
    handlePluginInstalled,
  )
  ipcMain.handle(channels.IS_NODE_INSTALLED, handleNodeInstalled)
  app.setAboutPanelOptions({
    applicationName: packageJson.productName,
    applicationVersion: packageJson.name,
    version: packageJson.version,
    credits: packageJson.description,
    copyright: packageJson.publisher,
  })
  _createWindow()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// #region Helpers
async function _echoReadable(event: IpcMainEvent, readable: any) {
  const webContents = event.sender
  const win = BrowserWindow.fromWebContents(webContents)
  for await (const line of chunksToLinesAsync(readable)) {
    // (C)
    console.log('> ' + chomp(line))
    // ipcRenderer.send('chomp', line);
    // i want to send to front the content of the line
    // I want to listen echo from main.ts and display it in the p tag without removing the previous content
    win.webContents.send(channels.ASYNCHRONOUS_LOG, chomp(line))
  }
}
const _createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    icon: '/assets/app-ico.png',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  })

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

const _getHomeDir = async () => {
  fixPath()
  const _shellEnv = await shellEnv()
  return _shellEnv.HOME
}

const _getNodeVersion = async () => {
  fixPath()
  const _shellEnv = await shellEnv()
  const nodeDir = _shellEnv.NODE || _shellEnv.npm_node_execpath
  const nodeVersion = nodeDir?.match(/v\d+\.\d+\.\d+/)?.[0]
  if (!nodeVersion) {
    throw new Error('Node version not found in PATH')
  }
  return nodeVersion
}

const _getNodeDir = async () => {
  fixPath()
  const _shellEnv = await shellEnv()
  // console.log(`Shell Env: ${JSON.stringify(_shellEnv, null, 2)}`);
  const nodeDir = _shellEnv.NODE || _shellEnv.npm_node_execpath
  if (!nodeDir) {
    throw new Error('Node dir not found in PATH')
  }
  // console.log(`Node dir: ${nodeDir}`);
  return nodeDir
}

const _getNpmDir = async () => {
  fixPath()
  const _shellEnv = await shellEnv()
  // console.log(`Shell Env: ${JSON.stringify(_shellEnv, null, 2)}`);

  const npmBinDir = _shellEnv.NVM_BIN || _shellEnv.npm_config_prefix + '/bin'
  if (!npmBinDir) {
    throw new Error('Npm dir not found in PATH')
  }
  const updatedNpmBinDir = npmBinDir?.replace(/\/bin$/, '')
  // console.log(`Npm dir: ${npmDir}`);
  // console.log(`Updated npm dir: ${updatedNpmBinDir}`);
  return updatedNpmBinDir + '/lib/node_modules'
}

const _isDev = () => {
  return process.env['WEBPACK_SERVE'] === 'true'
}

// #endregion

// #region Public API - handleRunFakeMesure, handleSetTitle, handleWorkDir, handlePluginInstalled, handleNodeInstalled

const handleNodeInstalled = async (event: IpcMainEvent) => {
  const nodeDir = await _getNodeDir()
  try {
    fs.accessSync(nodeDir, fs.constants.F_OK)
    return true
  } catch (error) {
    return false
  }
}

const handlePluginInstalled = async (event: IpcMainEvent) => {
  const npmDir = await _getNpmDir()
  const pluginDir = `${npmDir}/lighthouse-plugin-ecoindex`
  try {
    fs.accessSync(pluginDir, fs.constants.F_OK)
    return true
  } catch (error) {
    return false
  }
}

const handleWorkDir = async (event: IpcMainEvent, newDir: string) => {
  if (newDir) {
    workDir = newDir
  } else {
    workDir = await _getHomeDir()
  }
  console.log(`workDir: ${workDir}`)
  return await workDir
}

async function handleRunFakeMesure(event: IpcMainEvent) {
  console.log('fake mesure start...')
  // create stream to log the output. TODO: use specified path
  const _workDir = await workDir
  if (!_workDir || _workDir === '') {
    throw new Error('Work dir not found')
  }
  console.log(`Work dir: ${_workDir}`)
  const logFilePath = `${_workDir}/logfile.txt`
  const logStream = fs.createWriteStream(logFilePath)
  logStream.write('fake mesure start...\n')
  try {
    const _shellEnv = await shellEnv()
    logStream.write(`Shell Env: ${JSON.stringify(_shellEnv, null, 2)}\n`)

    const nodeDir = await _getNodeDir()
    logStream.write(`Node dir: ${nodeDir}\n`)
    console.log(`Node dir: ${nodeDir}`)

    const npmDir = await _getNpmDir()
    logStream.write(`Npm dir: ${npmDir}\n`)
    console.log(`Npm dir: ${npmDir}`)

    // Fake mesure and path. TODO: use specified path and urls
    const childProcess: ChildProcess = spawn(
      `${nodeDir}`,
      [
        `${npmDir}/lighthouse-plugin-ecoindex/cli/index.js`,
        'collect',
        '-u',
        'https://novagaia.fr/',
        '-u',
        'https://novagaia.fr/a-propos/',
        '-o',
        'html',
        '--output-path',
        _workDir,
      ],
      { stdio: ['pipe', 'pipe', process.stderr], shell: true },
    )

    childProcess.on('exit', (code, signal) => {
      logStream.write(
        `Child process exited with code ${code} and signal ${signal}\n`,
      )
    })

    childProcess.on('close', code => {
      logStream.write(`Child process close with code ${code}\n`)
      logStream.write('fake mesure done 🚀\n')
    })

    childProcess.stdout.on('data', data => {
      logStream.write(`stdout: ${data}\n`)
    })

    if (childProcess.stderr) {
      childProcess.stderr.on('data', data => {
        logStream.write(`stderr: ${data.toString()}\n`)
      })
    }

    childProcess.on('disconnect', () => {
      logStream.write('Child process disconnected\n')
    })

    childProcess.on('message', (message, sendHandle) => {
      logStream.write(`Child process message: ${message}\n`)
    })

    await _echoReadable(event, childProcess.stdout)
    // process.stdout.write(data)
    // console.log(result.stdout.toString());
    console.log('fake mesure done 🚀')
    return 'mesure done'
  } catch (error) {
    logStream.write(`stderr: ${error}\n`)
  }
  // alert process done
}

async function handleSelectFolder() {
  const options: Electron.OpenDialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
  }
  const { canceled, filePaths } = await dialog.showOpenDialog(options)
  if (!canceled) {
    workDir = filePaths[0]
    return filePaths[0]
  }
}

async function getNodeVersion() {
  return await _getNodeVersion()
}

// #endregion
