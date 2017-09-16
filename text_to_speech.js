const wav_hdr = require("./wave_pcm_hdr")
const fs = require("fs")
const ttsAPI = require("./ttsAPI")


const text_to_speech = async(src_text, des_path, params) => {

    // console.log("开始转化文本：" + src_text)
    var ret = -1
    var sessionID = null
    var audio_len = 0
    var synth_status = ttsAPI.MSP_TTS_FLAG_STILL_HAVE_DATA

    if (null == src_text || null == des_path) {
        console.error("params is error!\n");
        return ret;
    }

    var result = ttsAPI.ttsSessionBegin(params)
    if (ttsAPI.MSP_SUCCESS != result.ret) {
        console.error("QTTSSessionBegin failed, error code: %d.\n", result.ret)
        return result.ret
    }
    sessionID = result.sessionID
    ret = result.ret
    ret = ttsAPI.ttsTextPut(sessionID, src_text)
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("QTTSTextPut failed, error code: %d.\n", ret)
        ttsAPI.ttsSessionEnd(result.sessionID, "TextPutError")
        return ret
    }
    console.log('正在合成 ...')

    var raw_data = null
    while (1) {
        var result = ttsAPI.ttsAudioGet(sessionID)
        if (result.errorCode != ttsAPI.MSP_SUCCESS) {
            console.error("获取音频数据失败，错误：" + JSON.stringify(result))
            break
        }
        ret = result.errorCode
        if (result.data != null) {
            if (raw_data == null) {
                raw_data = result.data
            } else {
                raw_data = Buffer.concat([raw_data, result.data])
            }
        }
        if (ttsAPI.MSP_TTS_FLAG_DATA_END == result.synth_status) {
            console.log("tts 转化完成")
            break
        }
        if (raw_data === null) {
            console.log("...ing...大小：0")
        } else {
            console.log("...ing...大小：" + raw_data.length)

        }
        await sleep(1.5)
    }
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("QTTSAudioGet failed, error code: %d.\n", ret)
        ttsAPI.ttsSessionEnd(sessionID, "AudioGetError")
        return ret
    }

    /* 创建wav文件头 */
    var buffer = new Buffer(44)
    var size_8 = raw_data.length + 44 - 8
    console.log(`size_8:${size_8}, audio length:${raw_data.length}`)
    buffer.write('RIFF', 0, 4, 'ascii')
    buffer.writeUInt32LE(size_8, 4)
    buffer.write('WAVE', 8, 4, 'ascii')
    buffer.write('fmt ', 12, 4, 'ascii')
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(1, 22)
    buffer.writeUInt32LE(16000, 24)
    buffer.writeUInt32LE(32000, 28)
    buffer.writeUInt16LE(2, 32)
    buffer.writeUInt16LE(16, 34)
    buffer.write('data', 36, 4, 'ascii')
    buffer.writeUInt32LE(raw_data.length, 40)

    var audio_data = Buffer.concat([buffer, raw_data])

    try {
        var fd = fs.openSync(des_path, "w");
        fs.writeSync(fd, audio_data, 0, audio_data.length);
        fs.closeSync(fd)
    } catch (error) {
        console.error(error)
    }

    ret = ttsAPI.ttsSessionEnd(sessionID, "Normal")
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("QTTSSessionEnd failed, error code: %d.\n", ret)
    }
    return ret
}

var sleep = function (time) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve();
        }, time * 1000);
    })
};

module.exports = text_to_speech