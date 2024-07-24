import {
    BrowserWindow,
    IpcMainEvent,
    Notification,
    app,
    dialog,
    ipcMain,
} from 'electron'
import { ChildProcess, spawn } from 'child_process'
import { channels, scripts as custom_scripts, utils } from '../shared/constants'
import { chomp, chunksToLinesAsync } from '@rauschma/stringio'
import {
    cleanLogString,
    convertJSONDatasFromISimpleUrlInput,
    convertJSONDatasFromString,
} from './utils'
import {
    getHomeDir,
    getLogFilePathFromDir,
    getLogSteam,
    getMainWindow,
    getNodeDir,
    getNodeV,
    getNpmDir,
    getWorkDir,
    setHomeDir,
    setLogStream,
    setMainWindow,
    setNodeDir,
    setNodeV,
    setNpmDir,
    setWorkDir,
} from '../shared/memory'

import { autoUpdater } from 'electron-updater'
import fixPath from 'fix-path'
import fs from 'fs'
import os from 'os'
import packageJson from '../../package.json'

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
    console.log(`RUN fixPath and shellEnv`)
    fixPath()
    const { shell } = os.userInfo()
    console.log(`shell`, shell)
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
    autoUpdater.checkForUpdatesAndNotify()
    // simple handlers
    ipcMain.handle(channels.SIMPLE_MESURES, handleSimpleCollect)
    // json handlers
    ipcMain.handle(channels.SAVE_JSON_FILE, handleJsonSaveAndCollect)
    ipcMain.handle(channels.READ_RELOAD_JSON_FILE, handleJsonReadAndReload)
    // communs handlers and getters
    ipcMain.handle(channels.GET_NODE_VERSION, handleGetNodeVersion)
    ipcMain.handle(channels.SELECT_FOLDER, handleSelectFolder)
    ipcMain.handle(channels.GET_WORKDIR, handleWorkDir)
    ipcMain.handle(
        channels.IS_LIGHTHOUSE_ECOINDEX_INSTALLED,
        handlePluginInstalled
    )
    ipcMain.handle(channels.IS_NODE_INSTALLED, handleNodeInstalled)
    ipcMain.handle(
        channels.IS_JSON_CONFIG_FILE_EXIST,
        handleIsJsonConfigFileExist
    )
    ipcMain.handle(
        channels.INSTALL_ECOINDEX_PLUGIN,
        handleLighthouseEcoindexPluginInstall
    )
    app.setAboutPanelOptions({
        applicationName: packageJson.productName,
        applicationVersion: packageJson.name,
        version: packageJson.version,
        credits: packageJson.description,
        copyright: packageJson.publisher,
    })
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

autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...')
})
autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('Update available.')
})
autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('Update not available.')
})
autoUpdater.on('error', (err) => {
    sendStatusToWindow('Error in auto-updater. ' + err)
})
autoUpdater.on('download-progress', (progressObj) => {
    let log_message = 'Download speed: ' + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
    log_message =
        log_message +
        ' (' +
        progressObj.transferred +
        '/' +
        progressObj.total +
        ')'
    sendStatusToWindow(log_message)
})
autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Update downloaded')
})

function sendStatusToWindow(text: string) {
    // log.info(text)
    getMainWindow().webContents.send('message', text)
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

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
    _sendMessageToLogFile(message, ...optionalParams)
}

/**
 * Send message to DEV consol log
 * @param message
 * @param optionalParams
 */
const _sendMessageToFrontLog = (message?: any, ...optionalParams: any[]) => {
    getMainWindow().webContents.send(
        channels.HOST_INFORMATIONS,
        message,
        optionalParams
    )
}

/**
 * Write a log file in output dir / workDir
 * @param message string
 * @param optionalParams string[]
 */
function _sendMessageToLogFile(message?: any, ...optionalParams: any[]) {
    if (!getWorkDir()) {
        setWorkDir(getHomeDir())
    }
    const logFilePath = getLogFilePathFromDir(getWorkDir())

    if (!getLogSteam()) {
        setLogStream(logFilePath)
        getLogSteam().write('')
    }
    const toStr = (inp: any) => {
        try {
            if (typeof inp !== 'string') {
                return JSON.stringify(inp, null, 2)
            }
            return inp
        } catch (error) {
            return JSON.stringify(error, null, 2)
        }
    }
    try {
        const stout =
            toStr(message) + ' ' + optionalParams.map((str) => toStr(str))
        getLogSteam().write(stout + '\n')
    } catch (error) {
        getLogSteam().write(JSON.stringify(error, null, 2))
    }
}

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
async function _prepareJsonCollect(): Promise<{
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

        const nodeDir = getNodeDir()
        _debugLogs(`Node dir: ${nodeDir}`)
        console.log(`Node dir: ${nodeDir}`)

        const npmDir = getNpmDir()
        _debugLogs(`Npm dir: ${npmDir}`)
        console.log(`Npm dir: ${npmDir}`)

        const command = [
            `${npmDir}/lighthouse-plugin-ecoindex/cli/index.js`,
            'collect',
        ]
        return { command, nodeDir, workDir: _workDir }
    } catch (error) {
        console.error('Error', error)
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
        console.log('> ' + chomp(line))
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
    event: IpcMainEvent
): Promise<string> {
    try {
        _debugLogs(`runCollect: ${nodeDir} ${JSON.stringify(command, null, 2)}`)
        // const controller = new AbortController()
        // const { signal } = controller
        const childProcess: ChildProcess = spawn(`${nodeDir}`, command, {
            stdio: ['pipe', 'pipe', process.stderr],
            shell: true,
            // signal,
        })

        childProcess.on('exit', (code, signal) => {
            _debugLogs(
                `Child process exited with code ${code} and signal ${signal}`
            )
        })

        childProcess.on('close', (code) => {
            _debugLogs(`Child process close with code ${code}`)
            _debugLogs('Mesure done 🚀')
        })

        childProcess.stdout.on('data', (data) => {
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
        console.log(error)
    }
}

/**
 * Utils, Launch script on host.
 * @param event IpcMainEvent
 * @param script_type string. see constants.scripts
 * @param isReadable boolean
 * @returns Promise<string>
 */
async function _getHostInformations(
    event: IpcMainEvent,
    script_type: string,
    isReadable = true
): Promise<string> {
    try {
        console.log(`getHostInformations`)
        _debugLogs(`getHostInformations for ${script_type} started 🚀`)
        // Create configuration from host and script_type
        const config: { [key: string]: any } = {}
        config['script_file'] = `${script_type}`
        config['ext'] = os.platform() === 'win32' ? 'bat' : 'sh'
        config['filePath'] = `${
            process.env['WEBPACK_SERVE'] === 'true'
                ? __dirname
                : process.resourcesPath
        }/scripts/${os.platform()}/${config['script_file']}.${config['ext']}`
        config['out'] = []
        const { shell, homedir } = os.userInfo()
        if (shell === '/bin/zsh') {
            config['runner'] = 'zsh'
        }

        const informations = {
            script_type,
            shell,
            runner: config['runner'],
            filePath: config['filePath'],
            __dirname,
            homedir,
        }
        _debugLogs(`informations`, JSON.stringify(informations, null, 2))
        _debugLogs(`Try childProcess on`, config['filePath'])

        return new Promise((resolve, reject) => {
            const childProcess: ChildProcess = spawn(
                config['runner'] as string,
                [
                    '-c',
                    `chmod +x ${config['filePath']} && ${config['runner']} ${config['filePath']}`,
                ],
                {
                    stdio: ['pipe', 'pipe', process.stderr, 'ipc'],
                    env: process.env,
                    // shell: shell,
                }
            )

            childProcess.on('exit', (code, signal) => {
                _debugLogs(
                    `Process ${script_type.toUpperCase()} exited: ${code}; signal: ${signal}`
                )
            })

            childProcess.on('close', (code) => {
                _debugLogs(
                    `Process ${script_type.toUpperCase()} closed: ${code}`
                )

                if (code === 0) {
                    // _sendMessageToFrontLog(`Intallation done 🚀`)
                    _debugLogs(`Process ${script_type.toUpperCase()} done 🚀`)
                    // resolve(`Process ${script_type.toUpperCase()} done 🚀`)
                    if (config['out'].at(-1)) {
                        resolve(
                            config['out']
                                .at(-1)
                                .replace('\\n', '')
                                .trim() as string
                        )
                    } else {
                        reject(
                            `Process ${script_type.toUpperCase()} failed, out is unknown 🚫`
                        )
                    }
                } else {
                    // _sendMessageToFrontLog(`Intallation failed 🚫`)
                    _debugLogs(`Process ${script_type.toUpperCase()} failed 🚫`)
                    reject(`Process ${script_type.toUpperCase()} failed 🚫`)
                }
            })

            if (childProcess.stderr) {
                childProcess.stderr.on('data', (data) => {
                    console.error(
                        `Process ${script_type.toUpperCase()} stderr: ${data}`
                    )
                    _debugLogs(
                        `Process ${script_type.toUpperCase()} stderr: ${data}`
                    )
                })
            }

            childProcess.on('disconnect', () => {
                _debugLogs(
                    `Process ${script_type.toUpperCase()} Child process disconnected`
                )
            })

            childProcess.on('message', (message, sendHandle) => {
                _debugLogs(
                    `Process ${script_type.toUpperCase()} Child process message: ${message}`
                )
            })

            if (childProcess.stdout) {
                isReadable && _echoReadable(event, childProcess.stdout)
                childProcess.stdout.on('data', (data) => {
                    config['out'].push(data.toString())
                })
            }
        })
    } catch (error) {
        _debugLogs(`error on ${script_type}`, JSON.stringify(error, null, 2))
        return new Promise((resolve, reject) => {
            reject(`getHostInformations on ${script_type} failed 🚫`)
        })
    }
}

/**
 * Utils, wait method.
 * @param ms number
 * @returns Promise<unknown>
 */
async function _sleep(ms: number) {
    return new Promise((resolve) => {
        console.log(`wait ${ms / 1000}s`)
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
const handleNodeInstalled = async (event: IpcMainEvent) => {
    // get Node Dir
    try {
        const _nodeDir = await _getHostInformations(
            event,
            custom_scripts.GET_NODE
        )
        if (_nodeDir.includes(';')) {
            console.log(`Clean nodeDir path`)
            setNodeDir(_nodeDir.split(';')[2].replace('\x07', '').trim())
        } else setNodeDir(_nodeDir)
        console.log(`nodeDir`, getNodeDir())

        setNpmDir(
            getNodeDir()?.replace(/\/bin\/node$/, '') + '/lib/node_modules'
        )
        console.log(`npmDir: `, getNpmDir())

        // setNodeV(await _getHostInformations(event, custom_scripts.GET_NODE_VERSION))
        // console.log(`nodeVersion`, getNodeV())
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
            console.log(`has NOT access to Node DIR 🚫`, error)
            return false
        }
    } catch (error) {
        console.log(`Check is Node Installed failed 🚫`, error)
    }
}

/**
 * Handlers, Node Version
 * @returns string
 */
const handleGetNodeVersion = async (event: IpcMainEvent) => {
    try {
        setNodeV(
            await _getHostInformations(event, custom_scripts.GET_NODE_VERSION)
        )
        sendDataToFront({ 'node-version': getNodeV() })
        return getNodeV()
    } catch (error) {
        console.log(`Check is Node version failed 🚫`, error)
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
        console.log(`in handlePluginInstalled, nodeDir is in error! 🚫`, error)

        return false
    }
    const npmDir = getNpmDir()
    const pluginDir = `${npmDir}/lighthouse-plugin-ecoindex`
    try {
        fs.accessSync(pluginDir)
        return true
    } catch (error) {
        return false
    }
}

/**
 * Handlers, Get WorkDir
 * @param event IpcMainEvent
 * @param newDir string
 * @returns string
 */
const handleWorkDir = async (event: IpcMainEvent, newDir: string) => {
    // fixPath()
    const { shell, homedir } = os.userInfo()
    if (!homedir) {
        // _debugLogs('ERROR', 'Home dir not found in PATH', _shellEnv)
        throw new Error('Home dir not found in PATH')
    }
    setHomeDir(homedir)
    // console.log(`newDir`, newDir)
    if (newDir) {
        // logStream = null
        setLogStream(getLogFilePathFromDir(newDir))
        // console.log(`Reset logStream`)

        setWorkDir(newDir)
    } else {
        setWorkDir(getHomeDir())
    }
    // console.log(`workDir: ${workDir}`)
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
    const jsonConfigFile = `${workDir}/${utils.JSON_FILE_NAME}`
    console.log(`handleIsJsonConfigFileExist`, jsonConfigFile)
    try {
        fs.accessSync(jsonConfigFile, fs.constants.F_OK)
        _showNotification({
            body: 'Config file founded 👀',
            subtitle: 'loading file content...',
        })
        return true
    } catch (error) {
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

    const { command, nodeDir, workDir: _workDir } = await _prepareJsonCollect()
    console.log('Simple mesure start, process intialization...')
    _debugLogs('Simple mesure start, process intialization...')
    console.log(`Urls list: ${JSON.stringify(urlsList)}`)
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
            console.log(`before (simple) runCollect`, nodeDir, command)

            await _runCollect(command, nodeDir, event)
        } catch (error) {
            _showNotification({
                subtitle: '🚫 Simple collect',
                body: `Collect KO, ${error}\n'`,
            })
            throw new Error('Simple collect error')
        }
        // process.stdout.write(data)
        // console.log(result.stdout.toString());
        _showNotification({
            subtitle: '🎉 Simple collect',
            body: `Collect done, you can consult reports in\n${_workDir}'`,
        })
        console.log('Simple collect done 🚀')
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
    console.log('Json save or/and collect start...')
    _debugLogs('Json save or/and collect start...')

    try {
        const _workDir = await getWorkDir()
        if (!_workDir || _workDir === '') {
            throw new Error('Work dir not found')
        }
        console.log(`Work dir: ${_workDir}`)
        const jsonFilePath = `${_workDir}/${utils.JSON_FILE_NAME}`
        const jsonStream = fs.createWriteStream(jsonFilePath)
        // if ((jsonDatas['extra-header'], jsonDatas['extra-header'])) {
        //     try {
        //         console.log(`extra-header`, jsonDatas['extra-header'])
        //         if (typeof jsonDatas['extra-header'] === 'object') {
        //             jsonDatas['extra-header'] = Object(
        //                 String(jsonDatas['extra-header']).replace(/\\/g, '')
        //             )
        //         } else {
        //             jsonDatas['extra-header'] = JSON.parse(
        //                 String(jsonDatas['extra-header']).replace(/\\/g, '')
        //             )
        //         }
        //     } catch (error) {
        //         throw new Error(`extra-header is not in Json format. ${error}`)
        //     }
        // }
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
            console.log('Json mesure start...')

            const {
                command,
                nodeDir,
                workDir: _workDir,
            } = await _prepareJsonCollect()
            _debugLogs('Json mesure start...')
            _debugLogs(`JSON datas ${JSON.stringify(jsonDatas, null, 2)}`)
            command.push('--json-file')
            command.push(_workDir + '/' + utils.JSON_FILE_NAME)
            command.push('--output-path')
            command.push(_workDir)
            try {
                await _runCollect(command, nodeDir, event)
            } catch (error) {
                throw new Error('Simple collect error')
            }
            _showNotification({
                subtitle: '🎉 JSON collect',
                body: `Mesures done, you can consult reports in\n${_workDir}`,
            })
            _debugLogs('Json collect done 🚀')
            console.log('Json collect done 🚀')
            return 'mesure done'
        }
    } catch (error) {
        if (!andCollect) {
            _sendMessageToFrontLog('ERROR, Json file not saved', error)
            _showNotification({
                subtitle: '🚫 JSON save',
                body: 'Json file not saved.',
            })
        } else {
            _sendMessageToFrontLog(
                'ERROR, Json file not saved or collect',
                error
            )
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
        // console.log(`Work dir: ${_workDir}`)
        const jsonFilePath = `${_workDir}/${utils.JSON_FILE_NAME}`
        return new Promise((resolve, reject) => {
            const jsonStream = fs.createReadStream(jsonFilePath)
            jsonStream.on('data', function (chunk) {
                const jsonDatas = JSON.parse(chunk.toString())
                console.log(`jsonDatas`, jsonDatas)

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
        _showNotification({
            subtitle: '🚫 JSON reload',
            body: `Json file not read and reloaded. ${error}`,
        })
        // throw new Error(`Json file not read and reloaded. ${error}`)
    }
}

async function test_handleLighthouseEcoindexPluginInstall(event: IpcMainEvent) {
    try {
        const { shell, homedir } = os.userInfo()
        let runner = ''
        if (shell === '/bin/zsh') {
            runner = 'zsh'
        }
        // const filePath = path.join(
        //   __dirname,
        //   'scripts',
        //   os.platform(),
        //   'install-plugin.sh',
        // )
        // const filePath = [`${__dirname}/scripts/${os.platform()}/install-plugin.sh`]

        const filePath = [
            `${
                process.env['WEBPACK_SERVE'] === 'true'
                    ? __dirname
                    : process.resourcesPath
            }/scripts/${os.platform()}/install-plugin.sh`,
        ]
        _debugLogs(`filePath: ${filePath}`)
        return new Promise((resolve, reject) => {
            const options = {
                name: 'Electron App',
            }
            // Execute the script
            const install = spawn('zsh', [
                '-c',
                `chmod +x ${filePath} && ${runner} ${filePath}`,
            ])

            install.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`)
                _debugLogs(`stdout: ${data}`)
            })

            install.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`)
                _debugLogs(`stderr: ${data}`)
            })
            install.on(`exit`, (code, signal) => {
                _debugLogs(`Intallation exited: ${code}; signal: ${signal}`)
                if (code === 0) {
                    _debugLogs(`Intallation done 🚀`)
                    resolve(`Intallation done 🚀`)
                } else {
                    _debugLogs(`Intallation failed 🚫`)
                    reject(`Intallation failed 🚫`)
                }
            })
        })
    } catch (error) {
        _debugLogs(`error`, JSON.stringify(error, null, 2))
    }
}

/**
 * Handlers, Install Ecoindex Plugin.
 * @param event IpcMainEvent
 * @returns Promise<string>
 */
const handleLighthouseEcoindexPluginInstall = async (
    event: IpcMainEvent
): Promise<string> => {
    try {
        console.log(`handleLighthouseEcoindexPluginInstall`)
        _debugLogs(`handleLighthouseEcoindexPluginInstall started 🚀`)

        // const filePath = [`${__dirname}/scripts/${os.platform()}/install-plugin.sh`]
        const filePath = [
            `${
                process.env['WEBPACK_SERVE'] === 'true'
                    ? __dirname
                    : process.resourcesPath
            }/scripts/${os.platform()}/install-plugin.sh`,
        ]
        const { shell, homedir } = os.userInfo()
        let runner = ''
        if (shell === '/bin/zsh') {
            runner = 'zsh'
        }
        const o = { shell, runner, filePath, __dirname, homedir }
        _debugLogs(`informations`, JSON.stringify(o, null, 2))
        _debugLogs(`Try childProcess on`, filePath)
        return new Promise((resolve, reject) => {
            const childProcess: ChildProcess = spawn(
                runner,
                ['-c', `chmod +x ${filePath} && ${runner} ${filePath}`],
                {
                    stdio: ['pipe', 'pipe', process.stderr, 'ipc'],
                    env: process.env,
                    // shell: shell,
                }
            )

            childProcess.on('exit', (code, signal) => {
                _debugLogs(`Installation exited: ${code}; signal: ${signal}`)
            })

            childProcess.on('close', (code) => {
                _debugLogs(`Installation closed: ${code}`)
                if (code === 0) {
                    // _sendMessageToFrontLog(`Intallation done 🚀`)
                    _debugLogs(`Installation done 🚀`)
                    resolve(`Installation done 🚀`)
                } else {
                    // _sendMessageToFrontLog(`Intallation failed 🚫`)
                    _debugLogs(`Installation failed 🚫`)
                    reject(`Installation failed 🚫`)
                }
            })

            if (childProcess.stderr) {
                childProcess.stderr.on('data', (data) => {
                    console.error(`Installation stderr: ${data}`)
                    _debugLogs(`Installation stderr: ${data}`)
                })
            }

            childProcess.on('disconnect', () => {
                _debugLogs('Installation Child process disconnected')
            })

            childProcess.on('message', (message, sendHandle) => {
                _debugLogs(`Installation Child process message: ${message}`)
            })

            if (childProcess.stdout) _echoReadable(event, childProcess.stdout)
        })
    } catch (error) {
        _debugLogs(`error`, JSON.stringify(error, null, 2))
        return 'Installation failed'
    }
}

/**
 * Handlers, SelectFolder
 * @returns string
 */
const handleSelectFolder = async () => {
    const options: Electron.OpenDialogOptions = {
        properties: ['openDirectory', 'createDirectory'],
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(options)
    if (!canceled) {
        setWorkDir(filePaths[0])
        return filePaths[0]
    }
}

// #endregion
