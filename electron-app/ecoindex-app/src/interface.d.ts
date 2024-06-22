export interface IVersionsAPI {
  node: () => string
  chrome: () => string
  electron: () => string
  getNodeVersion: () => Promise<string>
}

export interface IElectronAPI {
  sendLogToFront: (callback) => string
  sendHostInfoToFront: (callback) => object
  handleSetFolderOuput: () => Promise<string>
  handleSelectFolder: () => Promise<string>
  getWorkDir: (newDir: string) => Promise<string>
  isNodeInstalled: () => Promise<boolean>
  isLighthouseEcoindexPluginInstalled: () => Promise<boolean>
  simpleMesures: (urlsList: SimpleUrlInput[]) => void
}

declare global {
  interface Window {
    versions: IVersionsAPI
    electronAPI: IElectronAPI
  }
}
