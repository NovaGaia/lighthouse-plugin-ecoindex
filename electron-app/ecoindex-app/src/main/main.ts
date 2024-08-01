import * as path from 'node:path'

import {
    BrowserWindow,
    IpcMainEvent,
    Menu,
    Notification,
    app,
    dialog,
    ipcMain,
    shell,
} from 'electron'
import { ChildProcess, spawn } from 'child_process'
import { UpdateSourceType, updateElectronApp } from 'update-electron-app'
import {
    channels,
    scripts as custom_scripts,
    scripts,
    utils,
} from '../shared/constants'
import { chomp, chunksToLinesAsync } from '@rauschma/stringio'
import {
    cleanLogString,
    convertJSONDatasFromISimpleUrlInput,
    convertJSONDatasFromString,
} from './utils'
import {
    getHomeDir,
    getMainWindow,
    getNodeDir,
    getNodeV,
    getNpmDir,
    getTryNode,
    getWorkDir,
    isDev,
    setHomeDir,
    setMainWindow,
    setNodeDir,
    setNodeV,
    setNpmDir,
    setTryNode,
    setWorkDir,
} from '../shared/memory'

import Updater from './Updater'
import fixPath from 'fix-path'
import fs from 'fs'
import log from 'electron-log/main'
import os from 'os'
import packageJson from '../../package.json'

if (require('electron-squirrel-startup')) {
    app.quit()
}

log.initialize()
const mainLog = log.scope('main')
log.info(`******************** APP IS STRATING ********************`)

// const execFile = util.promisify(_execFile);

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string

/**
 * Helpers, Fix Path
 */
const _runfixPath = () => {
    if (isDev()) mainLog.debug(`RUN fixPath and shellEnv`)
    fixPath()
    if (os.platform() === 'darwin') {
        if (isDev()) mainLog.debug(`darwin`)
        const { shell } = os.userInfo()
        if (isDev()) mainLog.debug(`shell`, shell)
    } else {
        if (isDev()) mainLog.debug(`win32`)
        if (isDev()) mainLog.debug(`shell`, `cmd.exe`)
    }
}
_runfixPath()

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit()
}

/**
 * Electron, Create Windows
 */
const createWindow = (): void => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        height: 600,
        width: 800,
        webPreferences: {
            preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
            nodeIntegration: true,
            // contextIsolation: false,
        },
    })

    // and load the index.html of the app.
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

    // Open the DevTools.
    mainWindow.webContents.openDevTools({ mode: 'detach' })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    // simple handlers
    ipcMain.handle(channels.SIMPLE_MESURES, handleSimpleCollect)
    // json handlers
    ipcMain.handle(channels.SAVE_JSON_FILE, handleJsonSaveAndCollect)
    ipcMain.handle(channels.READ_RELOAD_JSON_FILE, handleJsonReadAndReload)
    // communs handlers and getters
    ipcMain.handle(channels.GET_NODE_VERSION, handleGetNodeVersion)
    ipcMain.handle(channels.SELECT_FOLDER, handleSelectFolder)
    ipcMain.handle(channels.GET_WORKDIR, handleWorkDir)
    ipcMain.handle(channels.GET_HOMEDIR, handleHomeDir)
    ipcMain.handle(
        channels.IS_LIGHTHOUSE_ECOINDEX_INSTALLED,
        handlePluginInstalled
    )
    ipcMain.handle(channels.IS_NODE_INSTALLED, handleNodeInstalled)
    ipcMain.handle(
        channels.IS_JSON_CONFIG_FILE_EXIST,
        handleIsJsonConfigFileExist
    )
    ipcMain.handle(channels.INSTALL_ECOINDEX_PLUGIN, (event) =>
        handle_CMD_Actions(
            event as IpcMainEvent,
            channels.INSTALL_ECOINDEX_PLUGIN
        )
    )
    ipcMain.handle(channels.UPDATE_ECOINDEX_PLUGIN, (event) =>
        handle_CMD_Actions(
            event as IpcMainEvent,
            channels.UPDATE_ECOINDEX_PLUGIN
        )
    )
    app.setAboutPanelOptions({
        applicationName: packageJson.productName,
        applicationVersion: packageJson.name,
        version: packageJson.version,
        credits: packageJson.description,
        copyright: packageJson.publisher,
    })
    Updater.getInstance()
    // _showNotification()
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

// Electron, Create Window
app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

const isMac = process.platform === 'darwin'

const template = [
    // { role: 'appMenu' }
    ...(isMac
        ? [
              {
                  label: app.name,
                  submenu: [
                      { role: 'about' },
                      { type: 'separator' },
                      { role: 'services' },
                      { type: 'separator' },
                      { role: 'hide' },
                      { role: 'hideOthers' },
                      { role: 'unhide' },
                      { type: 'separator' },
                      { role: 'quit' },
                  ],
              },
          ]
        : []),
    // { role: 'fileMenu' }
    {
        label: 'File',
        submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    // { role: 'editMenu' }
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            ...(isMac
                ? [
                      { role: 'pasteAndMatchStyle' },
                      { role: 'delete' },
                      { role: 'selectAll' },
                      { type: 'separator' },
                      {
                          label: 'Speech',
                          submenu: [
                              { role: 'startSpeaking' },
                              { role: 'stopSpeaking' },
                          ],
                      },
                  ]
                : [
                      { role: 'delete' },
                      { type: 'separator' },
                      { role: 'selectAll' },
                  ]),
        ],
    },
    // { role: 'viewMenu' }
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
        ],
    },
    // { role: 'windowMenu' }
    {
        label: 'Window',
        submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            ...(isMac
                ? [
                      { type: 'separator' },
                      { role: 'front' },
                      { type: 'separator' },
                      { role: 'window' },
                  ]
                : [{ role: 'close' }]),
        ],
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'Learn More',
                click: async () => {
                    await shell.openExternal(
                        'https://cnumr.github.io/lighthouse-plugin-ecoindex/'
                    )
                },
            },
        ],
    },
]
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

// #region Helpers

/**
 * Helpers, Window Creation
 */
const _createWindow = (): void => {
    // Create the browser window.
    setMainWindow(
        new BrowserWindow({
            width: 1000,
            height: 800,
            icon: '/assets/app-ico.png',
            webPreferences: {
                preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
            },
        })
    )

    // and load the index.html of the app.
    getMainWindow().loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

    // Open the DevTools.
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
}

/**
 * Helpers, Launch Multi Debug
 * @param message any
 * @param optionalParams any
 */
const _debugLogs = (message?: any, ...optionalParams: any[]) => {
    _sendMessageToFrontLog(message, ...optionalParams)
    mainLog.debug(message, ...optionalParams)
}

/**
 * Send message to DEV consol log
 * @param message
 * @param optionalParams
 */
const _sendMessageToFrontLog = (message?: any, ...optionalParams: any[]) => {
    try {
        getMainWindow().webContents.send(
            channels.HOST_INFORMATIONS,
            message,
            optionalParams
        )
    } catch (error) {
        mainLog.error('Error in _sendMessageToFrontLog', error)
    }
}

// /**
//  * Write a log file in output dir / workDir
//  * @param message string
//  * @param optionalParams string[]
//  */
// function _sendMessageToLogFile(message?: any, ...optionalParams: any[]) {
//     const toStr = (inp: any) => {
//         try {
//             if (typeof inp !== 'string') {
//                 return JSON.stringify(inp, null, 2)
//             }
//             return inp
//         } catch (error) {
//             return JSON.stringify(error, null, 2)
//         }
//     }
//     const stout = toStr(message) + ' ' + optionalParams.map((str) => toStr(str))
//     mainLog.debug(stout)
//     return
//     if (!getWorkDir()) {
//         setWorkDir(getHomeDir())
//     }
//     const logFilePath = getLogFilePathFromDir(getWorkDir())

//     if (!getLogSteam()) {
//         setLogStream(logFilePath)
//         getLogSteam().write('')
//     }

//     try {
//         getLogSteam().write(stout + '\n')
//     } catch (error) {
//         getLogSteam().write(JSON.stringify(error, null, 2))
//     }
// }

/**
 * Utils, Send data to Front.
 * @param data any
 */
function sendDataToFront(data: any) {
    getMainWindow().webContents.send(
        channels.HOST_INFORMATIONS_BACK,
        typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    )
}

/**
 * Utils, prepare Json Collect.
 * @returns Promise<{
  command: string[]
  nodeDir: string
  workDir: string
}>
 */
async function _prepareCollect(): Promise<{
    command: string[]
    nodeDir: string
    workDir: string
}> {
    // create stream to log the output. TODO: use specified path
    try {
        const _workDir = getWorkDir()
        if (!_workDir || _workDir === '') {
            throw new Error('Work dir not found')
        }

        let nodeDir = getNodeDir()
        _debugLogs(`Node dir: ${nodeDir}`)

        const npmDir = getNpmDir()
        _debugLogs(`Npm dir: ${npmDir}`)

        const command = [
            `${npmDir}/lighthouse-plugin-ecoindex/cli/index.js`.replace(
                /\//gm,
                path.sep
            ),
            'collect',
        ]
        if (os.platform() === `win32`) {
            nodeDir = nodeDir.replace(/\\/gm, path.sep)
        }
        return { command, nodeDir, workDir: _workDir }
    } catch (error) {
        mainLog.error('Error in _prepareCollect', error)
    }
}

/**
 * Send message to log zone in front of the app
 * @param event
 * @param readable
 */
async function _echoReadable(event: IpcMainEvent, readable: any) {
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)
    for await (const line of chunksToLinesAsync(readable)) {
        // (C)
        if (isDev()) mainLog.debug('> ' + chomp(line))
        // eslint-disable-next-line no-control-regex, no-useless-escape
        win.webContents.send(
            channels.ASYNCHRONOUS_LOG,
            chomp(cleanLogString(line))
        )
    }
}

/**
 * Utils, Show Notification
 * @param options
 */
function _showNotification(options: any) {
    if (!options) {
        options = {
            body: 'Notification body',
            subtitle: 'Notification subtitle',
        }
    }
    if (!options.title || options.title === '') {
        options.title = packageJson.productName
    }
    const customNotification = new Notification(options)
    customNotification.show()
}

/**
 * Utils, Collect
 * @param command string[]
 * @param nodeDir string
 * @param event IpcMainEvent
 * @param logStream
 * @returns string
 */
async function _runCollect(
    command: string[],
    nodeDir: string,
    event: IpcMainEvent,
    isSimple = false
): Promise<string> {
    try {
        const out: string[] = []

        _debugLogs(`runCollect: ${nodeDir} ${JSON.stringify(command, null, 2)}`)
        // const controller = new AbortController()
        // const { signal } = controller
        const childProcess: ChildProcess = spawn(`"${nodeDir}"`, command, {
            stdio: ['pipe', 'pipe', process.stderr],
            shell: true,
            windowsHide: true,
            // signal,
        })

        childProcess.on('exit', (code, signal) => {
            if (isSimple && out.length > 0) {
                const fl = (item: string) => {
                    return item.includes('Report generated')
                }
                const filtered = out.filter(fl)
                const url =
                    'file:///' +
                    filtered
                        .at(-1)
                        .replace(`Report generated: `, ``)
                        .split('generic.report.html')[0] +
                    `generic.report.html`
                mainLog.debug(`url`, url)
                shell.openExternal(url, { activate: true })
                // getMainWindow().webContents.send(channels.OPEN_REPORT, url)
            }
            _debugLogs(
                `Child process exited with code ${code} and signal ${signal}`
            )
        })

        childProcess.on('close', (code) => {
            _debugLogs(`Child process close with code ${code}`)
            _debugLogs('Mesure done 🚀')
        })

        childProcess.stdout.on('data', (data) => {
            out.push(data.toString())
            _debugLogs(`stdout: ${data}`)
        })

        if (childProcess.stderr) {
            childProcess.stderr.on('data', (data) => {
                _debugLogs(`stderr: ${data.toString()}`)
            })
        }

        childProcess.on('disconnect', () => {
            _debugLogs('Child process disconnected')
        })

        childProcess.on('message', (message, sendHandle) => {
            _debugLogs(`Child process message: ${message}`)
        })

        await _echoReadable(event, childProcess.stdout)
        // controller.abort()
        return 'mesure done'
    } catch (error) {
        mainLog.error('Error in _runCollect', error)
    }
}

/**
 * Utils, wait method.
 * @param ms number
 * @returns Promise<unknown>
 */
async function _sleep(ms: number) {
    return new Promise((resolve) => {
        if (isDev()) mainLog.debug(`wait ${ms / 1000}s`)
        setTimeout(resolve, ms)
    })
}

// #endregion

// #region Public API - handleRunFakeMesure, handleSetTitle, handleWorkDir, handlePluginInstalled, handleNodeInstalled

/**
 * Handlers, Get ans Set NodeDir, NpmDir and NodeVersion.
 * @param event IpcMainEvent
 * @returns boolean
 */
const handleNodeInstalled: any = async (event: IpcMainEvent) => {
    // get Node Dir
    try {
        const _nodeDir = await handle_CMD_Actions(
            event,
            channels.IS_NODE_INSTALLED
        )
        if (_nodeDir === '' && getTryNode() > 0) {
            await _sleep(2000)
            setTryNode()
            return handleNodeInstalled(event)
        }
        if (_nodeDir.includes(';')) {
            if (isDev()) mainLog.debug(`Clean nodeDir path`)
            setNodeDir(_nodeDir.split(';')[2].replace('\x07', '').trim())
        } else setNodeDir(_nodeDir)
        if (isDev()) mainLog.debug(`nodeDir returned: `, _nodeDir)
        if (isDev()) mainLog.debug(`nodeDir:`, getNodeDir())

        if (os.platform() === `darwin`) {
            setNpmDir(
                getNodeDir()?.replace(/\/bin\/node$/, '') +
                    '/lib/node_modules'.replace(/\//gm, path.sep)
            )
        } else {
            setNpmDir(
                os.userInfo().homedir + `\\AppData\\Roaming\\npm\\node_modules`
            )
        }

        if (isDev()) mainLog.debug(`npmDir: `, getNpmDir())

        sendDataToFront({ 'nodeDir-raw': _nodeDir })
        sendDataToFront({ nodeDir: getNodeDir() })
        sendDataToFront({ npmDir: getNpmDir() })
        const { shell } = os.userInfo()
        sendDataToFront({ shell })
        sendDataToFront({ platform: os.platform() })
        sendDataToFront({ env: process.env })

        try {
            fs.accessSync(getNodeDir())
            return true
        } catch (error) {
            mainLog.error(`has NOT access to Node DIR 🚫`, error)
            return false
        }
    } catch (error) {
        mainLog.error(`Check is Node Installed failed 🚫`, error)
    }
}

/**
 * Handlers, Node Version
 * @returns string
 */
const handleGetNodeVersion = async (event: IpcMainEvent) => {
    try {
        setNodeV(await handle_CMD_Actions(event, channels.GET_NODE_VERSION))
        sendDataToFront({ 'node-version': getNodeV() })
        return getNodeV()
    } catch (error) {
        mainLog.error(`Check is Node version failed 🚫`, error)
    }
}

/**
 * Handlers, Is Ecoindex Lighthouse Plugin installed.
 * @param event IpcMainEvent
 * @returns boolean
 */
const handlePluginInstalled = async (event: IpcMainEvent) => {
    try {
        fs.accessSync(getNodeDir())
    } catch (error) {
        mainLog.error(
            `in handlePluginInstalled, nodeDir is in error! 🚫`,
            error
        )

        return false
    }
    const npmDir = getNpmDir()
    const pluginDir = `${npmDir}/lighthouse-plugin-ecoindex`.replace(
        /\//gm,
        path.sep
    )
    try {
        fs.accessSync(pluginDir)
        return true
    } catch (error) {
        mainLog.debug(`Lighthouse plugin not installed`)
        return false
    }
}

const handleHomeDir = async (event: IpcMainEvent) => {
    try {
        const { homedir } = os.userInfo()
        return homedir
    } catch (error) {
        mainLog.error(`Error on handleHomeDir 🚫`)
        return `Error on handleHomeDir 🚫`
    }
}

/**
 * Handlers, Get WorkDir
 * @param event IpcMainEvent
 * @param newDir string
 * @returns string
 */
const handleWorkDir = async (event: IpcMainEvent, newDir: string) => {
    const { homedir } = os.userInfo()
    if (!homedir) {
        mainLog.error('Home dir not found in userInfo()')
        throw new Error('Home dir not found in userInfo()')
    }
    setHomeDir(`${homedir}`)
    if (newDir) {
        // log replaced by electron-log
        // setLogStream(getLogFilePathFromDir(newDir))

        setWorkDir(`${newDir}`)
    } else {
        setWorkDir(`${getHomeDir()}`)
    }
    return await getWorkDir()
}

/**
 * Handlers, Test if Json Config File exist in folder after selected it.
 * @param event IpcMainEvent
 * @param workDir string
 * @returns boolean
 */
const handleIsJsonConfigFileExist = async (
    event: IpcMainEvent,
    workDir: string
) => {
    if (workDir === 'chargement...' || workDir === 'loading...') return
    const jsonConfigFile = `${workDir}/${utils.JSON_FILE_NAME}`.replace(
        /\//gm,
        path.sep
    )
    if (isDev()) mainLog.debug(`handleIsJsonConfigFileExist`, jsonConfigFile)
    try {
        fs.accessSync(jsonConfigFile, fs.constants.F_OK)
        _showNotification({
            body: 'Config file founded 👀',
            subtitle: 'loading file content...',
        })
        return true
    } catch (error) {
        mainLog.debug(`Error in handleIsJsonConfigFileExist`)
        return false
    }
}

/**
 * Handlers, SimpleCollect
 * @param event IpcMainEvent
 * @param urlsList ISimpleUrlInput[]
 * @returns string
 */
const handleSimpleCollect = async (
    event: IpcMainEvent,
    urlsList: ISimpleUrlInput[]
) => {
    if (!urlsList || urlsList.length === 0) {
        throw new Error('Urls list is empty')
    }
    _showNotification({
        subtitle: '🧩 Simple collect',
        body: 'Process intialization.',
    })

    const { command, nodeDir, workDir: _workDir } = await _prepareCollect()
    _debugLogs('Simple mesure start, process intialization...')
    _debugLogs(`Urls list: ${JSON.stringify(urlsList)}`)
    try {
        urlsList.forEach((url) => {
            if (url.value) {
                command.push('-u')
                command.push(url.value)
            }
        })
        command.push('-o')
        command.push('html')
        command.push('--output-path')
        command.push(_workDir)
        // Fake mesure and path. TODO: use specified path and urls
        _showNotification({
            subtitle: ' 🚀Simple collect',
            body: 'Collect started...',
        })
        try {
            if (isDev())
                mainLog.debug(`before (simple) runCollect`, nodeDir, command)

            await _runCollect(command, nodeDir, event, true)
        } catch (error) {
            _showNotification({
                subtitle: '🚫 Simple collect',
                body: `Collect KO, ${error}\n'`,
            })
            throw new Error('Simple collect error')
        }
        // process.stdout.write(data)
        _showNotification({
            subtitle: '🎉 Simple collect',
            body: `Collect done, you can consult reports in\n${_workDir}'`,
        })
        if (isDev()) mainLog.debug('Simple collect done 🚀')
        return 'collect done'
    } catch (error) {
        _debugLogs(`stderr: ${error}`)
    }
    // alert process done
}

/**
 * Handler, JsonSaveAndCollect
 * @param event IpcMainEvent
 * @param jsonDatas IJsonMesureData
 * @param andCollect boolean
 * @returns string
 */
const handleJsonSaveAndCollect = async (
    event: IpcMainEvent,
    jsonDatas: IJsonMesureData,
    andCollect: boolean
) => {
    if (!jsonDatas) {
        throw new Error('Json data is empty')
    }
    _showNotification({
        subtitle: andCollect ? '🧩 JSON save and collect' : '🧩 JSON save',
        body: 'Process intialization.',
    })
    _debugLogs('Json save or/and collect start...')

    try {
        const _workDir = await getWorkDir()
        if (!_workDir || _workDir === '') {
            throw new Error('Work dir not found')
        }
        if (isDev()) mainLog.debug(`Work dir: ${_workDir}`)
        const jsonFilePath = `${_workDir}/${utils.JSON_FILE_NAME}`
        const jsonStream = fs.createWriteStream(jsonFilePath)
        _showNotification({
            subtitle: andCollect ? '🚀 JSON save and collect' : '🚀 JSON save',
            body: andCollect
                ? 'Json save and collect started...'
                : 'Json save started...',
        })
        try {
            if (jsonDatas && typeof jsonDatas === 'object') {
                jsonStream.write(
                    JSON.stringify(
                        convertJSONDatasFromISimpleUrlInput(jsonDatas),
                        null,
                        2
                    )
                )
            } else {
                mainLog.error('jsonDatas have a problem!')
                throw new Error('jsonDatas have a problem!')
            }
        } catch (error) {
            _showNotification({
                subtitle: andCollect
                    ? '🚫 JSON save and collect'
                    : '🚫 JSON save',
                body: 'Json file not saved.',
            })
            _debugLogs(`Error writing JSON file. ${error}`)
            throw new Error(`Error writing JSON file. ${error}`)
        }
        if (!andCollect) {
            _showNotification({
                subtitle: '💾 JSON save',
                body: 'Json file saved.',
            })
        } else {
            if (isDev()) mainLog.debug('Json mesure start...')

            const {
                command,
                nodeDir,
                workDir: _workDir,
            } = await _prepareCollect()
            _debugLogs('Json mesure start...')
            _debugLogs(`JSON datas ${JSON.stringify(jsonDatas, null, 2)}`)
            command.push('--json-file')
            command.push(_workDir + '/' + utils.JSON_FILE_NAME)
            command.push('--output-path')
            command.push(_workDir)
            try {
                await _runCollect(command, nodeDir, event)
            } catch (error) {
                mainLog.error('Simple collect error', error)
                throw new Error('Simple collect error')
            }
            _showNotification({
                subtitle: '🎉 JSON collect',
                body: `Mesures done, you can consult reports in\n${_workDir}`,
            })
            _debugLogs('Json collect done 🚀')
            return 'mesure done'
        }
    } catch (error) {
        if (!andCollect) {
            _sendMessageToFrontLog('ERROR, Json file not saved', error)
            _debugLogs('ERROR, Json file not saved', error)
            _showNotification({
                subtitle: '🚫 JSON save',
                body: 'Json file not saved.',
            })
        } else {
            _sendMessageToFrontLog(
                'ERROR, Json file not saved or collect',
                error
            )
            _debugLogs('ERROR, Json file not saved or collect', error)
            _showNotification({
                subtitle: '🚫 JSON save and collect',
                body: 'Json file not saved or collect.',
            })
        }
    }
}

/**
 * Handlers, Json config Read and Reload.
 * @param event IpcMainEvent
 * @returns Promise<IJsonMesureData>
 */
const handleJsonReadAndReload = async (
    event: IpcMainEvent
): Promise<IJsonMesureData> => {
    _showNotification({
        subtitle: '🧩 JSON reload',
        body: 'Process intialization.',
    })
    try {
        const _workDir = await getWorkDir()
        if (!_workDir || _workDir === '') {
            throw new Error('Work dir not found')
        }
        const jsonFilePath = `${_workDir}/${utils.JSON_FILE_NAME}`
        return new Promise((resolve, reject) => {
            const jsonStream = fs.createReadStream(jsonFilePath)
            jsonStream.on('data', function (chunk) {
                const jsonDatas = JSON.parse(chunk.toString())
                if (isDev()) mainLog.debug(`jsonDatas`, jsonDatas)

                _showNotification({
                    subtitle: '🔄 JSON reload',
                    body: 'Json file read and reloaded.',
                })
                resolve(
                    convertJSONDatasFromString(jsonDatas) as IJsonMesureData
                )
            })
        })
    } catch (error) {
        _sendMessageToFrontLog(
            'ERROR',
            'Json file not read and reloaded',
            error
        )
        _debugLogs('ERROR', 'Json file not read and reloaded', error)
        _showNotification({
            subtitle: '🚫 JSON reload',
            body: `Json file not read and reloaded. ${error}`,
        })
        // throw new Error(`Json file not read and reloaded. ${error}`)
    }
}

/**
 * Handlers, Generic CMD action
 * @param event IpcMainEvent
 * @param action string
 * @returns Promise<string>
 */
const handle_CMD_Actions = async (
    event: IpcMainEvent,
    action: string
): Promise<string> => {
    // Create configuration from host and script_type
    const config: {
        runner: string
        launcher: string
        filePath: string[]
        actionCMDFile: string
        actionName: string
        actionShortName: string
        cmd: string
        out: string[]
    } = {
        runner: os.platform() === 'win32' ? 'cmd.exe' : 'sh',
        launcher: os.platform() === 'win32' ? '/c' : '-c',
        filePath: undefined,
        actionCMDFile: undefined,
        actionName: undefined,
        actionShortName: undefined,
        cmd: undefined,
        out: [],
    }

    const ext = os.platform() === 'win32' ? 'bat' : 'sh'
    switch (action) {
        case channels.INSTALL_ECOINDEX_PLUGIN:
            config['actionName'] = 'LighthouseEcoindexPluginInstall'
            config['actionShortName'] = 'Install plugin'
            config['actionCMDFile'] =
                `${custom_scripts.INSTALL_PLUGIN_AND_UTILS}.${ext}`
            break
        case channels.UPDATE_ECOINDEX_PLUGIN:
            config['actionName'] = 'LighthouseEcoindexPluginUpdate'
            config['actionShortName'] = 'Update plugin'
            config['actionCMDFile'] = `${custom_scripts.UPDATED_PLUGIN}.${ext}`
            break
        case channels.IS_NODE_INSTALLED:
            config['actionName'] = 'isNodeInstalled'
            config['actionShortName'] = 'Node installed'
            config['actionCMDFile'] = `${scripts.GET_NODE}.${ext}`
            break
        case channels.GET_NODE_VERSION:
            config['actionName'] = 'getNodeVersion'
            config['actionShortName'] = 'Node version'
            config['actionCMDFile'] = `${scripts.GET_NODE_VERSION}.${ext}`
            break

        default:
            throw new Error(`${action} not handled in handle_CMD_Actions`)
    }
    try {
        _debugLogs(`handle${config['actionName']} started 🚀`)

        config['filePath'] = [
            `${
                process.env['WEBPACK_SERVE'] === 'true'
                    ? __dirname
                    : process.resourcesPath
            }/scripts/${os.platform()}/${config['actionCMDFile']}`.replace(
                /\//gm,
                path.sep
            ),
        ]
        _debugLogs(`Try childProcess on`, config['filePath'])

        if (os.platform() === `darwin`) {
            config['cmd'] =
                `chmod +x ${config['filePath']} && ${config['runner']} ${config['filePath']}`
        } else if (os.platform() === `win32`) {
            config['cmd'] = ` ${config['filePath']}`
        }

        return new Promise((resolve, reject) => {
            const childProcess: ChildProcess = spawn(
                config['runner'] as string,
                [config['launcher'], config['cmd']],
                {
                    stdio: ['pipe', 'pipe', process.stderr, 'ipc'],
                    env: process.env,
                    windowsHide: true,
                    // shell: shell,
                }
            )

            childProcess.on('exit', (code, signal) => {
                _debugLogs(
                    `${config['actionName']} exited: ${code}; signal: ${signal}`
                )
            })

            childProcess.on('close', (code) => {
                _debugLogs(`${config['actionName']} closed: ${code}`)
                if (code === 0) {
                    // _sendMessageToFrontLog(`${config['actionShortName']} done 🚀`)
                    _debugLogs(`${config['actionShortName']} done 🚀`)
                    if (
                        action === channels.IS_NODE_INSTALLED ||
                        action === channels.GET_NODE_VERSION
                    ) {
                        if (config['out'].at(-1)) {
                            resolve(
                                config['out']
                                    .at(-1)
                                    .replace(/[\r\n]/gm, '')
                                    //.replace('\\node.exe', '') // voir si il faut l'enlever...
                                    .trim() as string
                            )
                        } else {
                            reject(
                                `Process ${config['actionShortName']} failed, out is unknown 🚫`
                            )
                        }
                    } else if (
                        action === channels.INSTALL_ECOINDEX_PLUGIN ||
                        action === channels.UPDATE_ECOINDEX_PLUGIN
                    ) {
                        resolve(`${config['actionShortName']} done 🚀`)
                    }
                } else {
                    // _sendMessageToFrontLog(`${config['actionShortName']} failed 🚫`)
                    _debugLogs(`${config['actionShortName']} failed 🚫`)
                    reject(`${config['actionShortName']} failed 🚫`)
                }
            })

            if (childProcess.stderr) {
                childProcess.stderr.on('data', (data) => {
                    console.error(
                        `${config['actionShortName']} stderr: ${data}`
                    )
                    _debugLogs(`${config['actionShortName']} stderr: ${data}`)
                })
            }

            childProcess.on('disconnect', () => {
                _debugLogs(
                    `${config['actionShortName']} Child process disconnected`
                )
            })

            childProcess.on('message', (message, sendHandle) => {
                _debugLogs(
                    `${config['actionShortName']} Child process message: ${message}`
                )
            })

            if (childProcess.stdout) {
                _echoReadable(event, childProcess.stdout)
                childProcess.stdout.on('data', (data) => {
                    config['out'].push(data.toString())
                })
            }
        })
    } catch (error) {
        _debugLogs(`error`, error)
        return `${config['actionShortName']} failed 🚫`
    }
}

/**
 * Handlers, SelectFolder
 * @returns string
 */
const handleSelectFolder = async () => {
    try {
        const options: Electron.OpenDialogOptions = {
            properties: ['openDirectory', 'createDirectory'],
        }
        const { canceled, filePaths } = await dialog.showOpenDialog(options)
        if (!canceled) {
            setWorkDir(`"${filePaths[0]}"`)
            return `"${filePaths[0]}"`
        }
    } catch (error) {
        mainLog.error(`Error in handleSelectFolder`)
    }
}

// #endregion
