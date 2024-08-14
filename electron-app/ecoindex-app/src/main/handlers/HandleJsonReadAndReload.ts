import { getWorkDir, isDev } from '../../shared/memory'

import { IpcMainEvent } from 'electron'
import Store from 'electron-store'
import { _debugLogs } from '../utils/MultiDebugLogs'
import { _sendMessageToFrontLog } from '../utils/SendMessageToFrontLog'
import { convertJSONDatasFromString } from '../utils/ConvertJSONDatas'
import fs from 'node:fs'
import { getMainLog } from '../main'
import i18n from '../../configs/i18next.config'
import { showNotification } from '../utils/ShowNotification'
import { utils } from '../../shared/constants'

const store = new Store()

/**
 * Handlers, Json config Read and Reload.
 * @param event IpcMainEvent
 * @returns Promise<IJsonMesureData>
 */
export const handleJsonReadAndReload = async (
    event: IpcMainEvent
): Promise<IJsonMesureData> => {
    const mainLog = getMainLog().scope('main/handleJsonReadAndReload')
    showNotification({
        subtitle: i18n.t('🧩 JSON reload'),
        body: i18n.t('Process intialization.'),
    })
    try {
        let _workDir = await getWorkDir()
        _workDir = store.get(`lastWorkDir`, _workDir) as string
        if (!_workDir || _workDir === '') {
            throw new Error('Work dir not found')
        }
        const jsonFilePath = `${_workDir}/${utils.JSON_FILE_NAME}`
        return new Promise((resolve, reject) => {
            const jsonStream = fs.createReadStream(jsonFilePath)
            jsonStream.on('data', function (chunk) {
                const jsonDatas = JSON.parse(chunk.toString())
                if (isDev()) mainLog.debug(`jsonDatas`, jsonDatas)

                showNotification({
                    subtitle: i18n.t('🔄 JSON reload'),
                    body: i18n.t('Json file read and reloaded.'),
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
        showNotification({
            subtitle: i18n.t('🚫 JSON reload'),
            body: i18n.t(`Json file not read and reloaded. {{error}}`, error),
        })
        // throw new Error(`Json file not read and reloaded. ${error}`)
    }
}
