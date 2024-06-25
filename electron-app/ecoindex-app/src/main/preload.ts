// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron'

import { channels } from '../shared/constants'
import { json } from 'react-router-dom'

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // Front → Main
  getNodeVersion: () => ipcRenderer.invoke(channels.GET_NODE_VERSION),
})

contextBridge.exposeInMainWorld('electronAPI', {
  // Front → Main
  // simple handlers
  handleSimpleMesures: (urlsList: SimpleUrlInput[]) =>
    ipcRenderer.invoke(channels.SIMPLE_MESURES, urlsList),
  // json handlers
  handleJsonMesures: (jsonDatas: IJsonMesureData) =>
    ipcRenderer.invoke(channels.JSON_MESURES, jsonDatas),
  handleJsonSave: (jsonDatas: IJsonMesureData) =>
    ipcRenderer.invoke(channels.SAVE_JSON_FILE, jsonDatas),
  handleJsonReadAndReload: () =>
    ipcRenderer.invoke(channels.READ_RELOAD_JSON_FILE),

  // communs handlers and getters
  handleSelectFolder: () => ipcRenderer.invoke(channels.SELECT_FOLDER),
  getWorkDir: (newDir: string) =>
    ipcRenderer.invoke(channels.GET_WORKDIR, newDir),
  isLighthouseEcoindexPluginInstalled: () =>
    ipcRenderer.invoke(channels.IS_LIGHTHOUSE_ECOINDEX_INSTALLED),
  isNodeInstalled: () => ipcRenderer.invoke(channels.IS_NODE_INSTALLED),

  // Main → Front
  sendLogToFront: (callback: any) =>
    ipcRenderer.on(channels.ASYNCHRONOUS_LOG, (_event, value) =>
      callback(value),
    ),
  // sendJsonDatasToFront: (callback: any) =>
  //   ipcRenderer.on(channels.READED_JSON_FILE, (_event, value) =>
  //     callback(value),
  //   ),
  sendMessageToFrontLog: (callback: any) =>
    ipcRenderer.on(
      channels.HOST_INFORMATIONS,
      (_event, message, optionalParams) => callback(message, optionalParams),
    ),
})
