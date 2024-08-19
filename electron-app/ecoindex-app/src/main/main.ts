// #region Imports
import * as menuFactoryService from '../services/menuFactory'

import { BrowserWindow, app, ipcMain } from 'electron'
import {
    getMainWindow,
    getWelcomeWindow,
    hasShowWelcomeWindow,
    isDev,
    setHasShowedWelcomeWindow,
    setMainWindow,
    setWelcomeWindow,
} from '../shared/memory'
import {
    handleJsonSaveAndCollect,
    handleSimpleCollect,
} from './handlers/HandleCollectAll'

import Store from 'electron-store'
import Updater from './Updater'
import { channels } from '../shared/constants'
import { convertVersion } from './utils'
import fixPath from 'fix-path'
import { handleGetNodeVersion } from './handlers/HandleGetNodeVersion'
import { handleHomeDir } from './handlers/HandleHomeDir'
import { handleIsJsonConfigFileExist } from './handlers/HandleIsJsonConfigFileExist'
import { handleJsonReadAndReload } from './handlers/HandleJsonReadAndReload'
import { handleNodeInstalled } from './handlers/HandleGetNodeDir_NpmDir'
import { handleSelectFolder } from './handlers/HandleSelectFolder'
import { handleWorkDir } from './handlers/HandleWorkDir'
import { handle_CMD_Actions } from './handlers/HandleCMDActions'
import i18n from '../configs/i18next.config'
import { isLighthouseEcoindexInstalled } from './handlers/IsLighthouseEcoindexInstalled'
import { isPupperteerBrowserInstalled } from './handlers/IsPuppeteerBrowserInstalled'
import log from 'electron-log/main'
import os from 'os'
import packageJson from '../../package.json'
import { updateElectronApp } from 'update-electron-app'

// #endregion
// #region Intialization
if (require('electron-squirrel-startup')) {
    app.quit()
}

log.initialize()
// log.transports.file.level =
//     process.env.NODE_ENV === 'production' ? 'info' : 'debug'
const mainLog = log.scope('main')

const store = new Store()
mainLog.debug(`userData`, app.getPath('userData'))

export const getMainLog = () => {
    return log
}
log.info(`******************** APP IS STARTING ********************`)

// const execFile = util.promisify(_execFile);

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string
declare const HELLO_WINDOW_WEBPACK_ENTRY: string
declare const HELLO_WINDOW_PRELOAD_WEBPACK_ENTRY: string

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
// #endregion

// #region App config

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
    ipcMain.handle(channels.GET_HOMEDIR, handleHomeDir)
    ipcMain.handle(channels.GET_WORKDIR, handleWorkDir)
    ipcMain.handle(channels.IS_NODE_INSTALLED, handleNodeInstalled)
    ipcMain.handle(channels.GET_NODE_VERSION, handleGetNodeVersion)
    // ipcMain.handle(
    //     channels.INSTALL_OR_UPDATE_ECOINDEX_PLUGIN,
    //     isLighthousePluginEcoindexMustBeInstallOrUpdated
    // )
    ipcMain.handle(channels.IS_LIGHTHOUSE_ECOINDEX_INSTALLED, async (event) => {
        const webContents = event.sender
        const win = BrowserWindow.fromWebContents(webContents)
        const isInstalled = await isLighthouseEcoindexInstalled(event)
        mainLog.debug(`isLighthouseEcoindexInstalled`, isInstalled.result)
        if (!isInstalled.result) {
            const result = await handle_CMD_Actions(
                event,
                channels.INSTALL_LIGHTHOUSE_PLUGIN_ECOINDEX
            )
            win.webContents.send(
                channels.ASYNCHRONOUS_LOG,
                `Lighthouse plugin ecoindex installed.`
            )
            return {
                result,
                message: `Lighthouse plugin ecoindex installed`,
                targetVersion: isInstalled.targetVersion,
            }
        } else {
            win.webContents.send(
                channels.ASYNCHRONOUS_LOG,
                `Lighthouse plugin ecoindex allready installed.`
            )
            return isInstalled
        }
    })
    ipcMain.handle(channels.SELECT_FOLDER, handleSelectFolder)
    ipcMain.handle(
        channels.IS_JSON_CONFIG_FILE_EXIST,
        handleIsJsonConfigFileExist
    )
    // ipcMain.handle(
    //   channels.IS_LIGHTHOUSE_ECOINDEX_INSTALLED,
    //   handlePluginInstalled,
    // )
    //   ipcMain.handle(channels.INSTALL_ECOINDEX_PLUGIN, event =>
    //     handle_CMD_Actions(event as IpcMainEvent, channels.INSTALL_ECOINDEX_PLUGIN),
    //   )
    //   ipcMain.handle(channels.UPDATE_ECOINDEX_PLUGIN, event =>
    //     handle_CMD_Actions(event as IpcMainEvent, channels.UPDATE_ECOINDEX_PLUGIN),
    //   )
    // Not used for the moment...
    ipcMain.handle(channels.INSTALL_PUPPETEER_BROWSER, async (event) => {
        const webContents = event.sender
        const win = BrowserWindow.fromWebContents(webContents)
        const isInstalled = isPupperteerBrowserInstalled(event)
        mainLog.debug(`isPupperteerBrowserInstalled`, isInstalled)
        if (!isInstalled) {
            const result = await handle_CMD_Actions(
                event,
                channels.INSTALL_PUPPETEER_BROWSER
            )
            win.webContents.send(
                channels.ASYNCHRONOUS_LOG,
                `Puppeteer Browser installed.`
            )
            return result
        } else {
            win.webContents.send(
                channels.ASYNCHRONOUS_LOG,
                `Puppeteer Browser allready installed.`
            )
            return isInstalled
        }
        // if (isAdmin()) {
        //     handleInstallPuppeteerBrowser()
        // } else {
        //     handleInstallSudoPuppeteerBrowser()
        // }
    })

    ipcMain.handle('store-set', (event, key: string, value: any) => {
        store.set(key, value)
    })

    ipcMain.handle('store-get', (event, key: string, defaultValue?: any) => {
        return store.get(key, defaultValue)
    })

    ipcMain.handle('store-delete', (event, key: string) => {
        store.delete(key)
    })
    ipcMain.handle(channels.SHOW_HIDE_WELCOME_WINDOW, () => {
        getWelcomeWindow().hide()
    })

    app.setAboutPanelOptions({
        applicationName: packageJson.productName,
        applicationVersion: packageJson.name,
        version: packageJson.version,
        credits: packageJson.description,
        copyright: packageJson.publisher,
    })
    // #region Updates
    // Updater.getInstance().checkForUpdates(false)
    // updateElectronApp({
    //     logger: log.scope('update-electron-app'),
    // })
    // #endregion
    // showNotification()
    createMainWindow()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    } else {
        // todo
    }
})

// Electron, Create Window
app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
    }
})
// #endregion

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// #region i18n helpers
const _changeLanguage = (lng: string) => {
    try {
        i18n.isInitialized &&
            getMainWindow().webContents.send(
                channels.CHANGE_LANGUAGE_TO_FRONT,
                lng
            )
        i18n.isInitialized &&
            !getWelcomeWindow().isDestroyed() &&
            getWelcomeWindow().webContents.send(
                channels.CHANGE_LANGUAGE_TO_FRONT,
                lng
            )
        i18n.isInitialized &&
            menuFactoryService.buildMenu(app, getMainWindow(), i18n)
    } catch (error) {
        // Welcome Window is distroyed on close, i need to catch
    }
}

const i18nInit = () => {
    try {
        i18n.on('loaded', (loaded) => {
            try {
                i18n.changeLanguage('en')
                i18n.off('loaded')
            } catch (error) {
                //
            }
        })
        i18n.on('languageChanged', (lng) => {
            _changeLanguage(lng)
        })
    } catch (error) {
        mainLog.error(`i18n`, error)
    }
    // read language in store
    i18n.changeLanguage(store.get(`language`, `en`) as string)
}
// #endregion

// #region Windows creation
export const createHelloWindow = () => {
    if (!hasShowWelcomeWindow()) {
        const displayHello = `displayHello.${convertVersion(packageJson.version)}`
        setWelcomeWindow(
            new BrowserWindow({
                width: 800,
                height: 700,
                icon: '/assets/app-ico.png',
                webPreferences: {
                    preload: HELLO_WINDOW_PRELOAD_WEBPACK_ENTRY,
                },
                parent: getMainWindow(),
                modal: true,
                show:
                    !store.get(displayHello) &&
                    store.get(displayHello) !== true,
            })
        )
        getWelcomeWindow().loadURL(HELLO_WINDOW_WEBPACK_ENTRY)
    } else {
        setHasShowedWelcomeWindow(true)
    }
}

/**
 * Helpers, Main Window Creation
 */
const createMainWindow = (): void => {
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

    createHelloWindow()

    i18nInit()

    _changeLanguage(store.get(`language`, `en`) as string)
    // Open the DevTools.
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
}

// #endregion
