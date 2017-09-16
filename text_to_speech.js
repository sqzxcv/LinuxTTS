const wav_hdr = require("./wave_pcm_hdr")
const fs = require("fs")
const ttsAPI = require("./ttsAPI")


const text_to_speech = async(src_text, des_path, params) => {

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

    // var data_size = 0
    var raw_data = null
    while (1) {
        var result = ttsAPI.ttsAudioGet(sessionID)
        //console.error("获取音频数据" + JSON.stringify(result))
        if (result.errorCode != ttsAPI.MSP_SUCCESS) {
            console.error("获取音频数据失败，错误：" + JSON.stringify(result))
            console.error("errorcode:" + result.errorCode)
            break
        }
        ret = result.errorCode
        if (result.data != null) {
            // fs.appendFileSync(des_path, result.data)
            // data_size += result.audio_len
            if (raw_data == null) {
                raw_data = new Buffer.from(result.data)
            } else {
                raw_data = Buffer.concat([raw_data, new Buffer.from(result.data)])
            }
        }
        if (ttsAPI.MSP_TTS_FLAG_DATA_END == result.synth_status) {
            console.log("tts 转化完成")
            break
        }
        // console.log("...ing...大小：" + raw_data == null ? 0 :raw_data.length)
        await sleepp(1.5)
    }
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("QTTSAudioGet failed, error code: %d.\n", ret)
        ttsAPI.ttsSessionEnd(sessionID, "AudioGetError")
        return ret
    }

    var buffer = new Buffer(44)

    buffer.write("RIFF", 0, 4, "ascii")
    buffer.writeUInt32LE(raw_data.length - 44 - 8, 4) //todo: data_size + (sizeof(wav_hdr) - 8);
    buffer.write('WAVE', 8, 4, 'ascii')
    buffer.write('fmt', 12, 3, 'ascii')
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16Le(1, 20)
    buffer.writeUInt16Le(1, 22)
    buffer.writeUInt32LE(16000, 24)
    buffer.writeUInt32LE(32000, 28)
    buffer.writeUInt16Le(2, 32)
    buffer.writeUInt16Le(16, 34)
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

var sleepp = function (time) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve();
        }, time * 1000);
    })
};

module.exports = text_to_speech