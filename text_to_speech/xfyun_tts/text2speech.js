"use strict";

const fs = require("fs")
const Readable = require('stream').Readable;
const ttsAPI = require("./ttsAPI")
const randomActor = require('./actor')
const qiniu = require("qiniu")
const bluebird = require("bluebird")
const ffmpeg_to_mp3 = require('./ffmpeg_to_mp3')
bluebird.promisifyAll(qiniu.resume_up.ResumeUploader.prototype, {
    multiArgs: true
})

const text2speech = async(text) => {

    var splitArr = text.split(/(\.|\?|!|。|？|！)/g)
    var textArr = []
    var subText = ""
    splitArr.forEach(function (substr) {
        if ((subText + substr).length > 1000 && subText.length != 0) {
            textArr.push(subText)
            subText = substr
        } else if ((subText + substr).length > 1000 && subText.length == 0) {
            subText += substr
            textArr.push(subText)
            subText = ""
        } else {
            subText += substr
        }
    }, this);
    textArr.push(subText)

    var raw_data = null
    for (var index in textArr) {
        if (textArr.hasOwnProperty(index)) {
            var sbtext = textArr[index];
            try {
                var raw_data_slice = await text_to_speech(sbtext, randomActor())
                if (null == raw_data_slice) {
                    console.error("获取tts数据失败")
                    return null
                }
                if (raw_data == null) {
                    raw_data = raw_data_slice
                } else {
                    raw_data = Buffer.concat([raw_data, raw_data_slice])
                }

            } catch (error) {
                console.error(error)
            }
            console.log("gen MP3 raw data :" + index + " span")
        }
    }

    // raw_data = Buffer.concat([raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data])
    // raw_data = Buffer.concat([raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data /*, raw_data, raw_data, raw_data, raw_data, raw_data, raw_data */ ])
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

    console.log("audiosize:" + audio_data.length)
    var key = await uploadspeech(audio_data)
    if (key == null) {
        console.error("上传音频文件失败")
        return null
    }
    console.log("上传音频文件成功")
    console.log("完整音频地址:" + key)
    return key

}

const text_to_speech = async(src_text, params) => {

    // console.log("开始转化文本：" + src_text)
    var ret = -1
    var sessionID = null
    var audio_len = 0
    var synth_status = ttsAPI.MSP_TTS_FLAG_STILL_HAVE_DATA

    if (null == src_text) {
        console.error("params is error!\n");
        return null;
    }

    var result = ttsAPI.ttsSessionBegin(params)
    if (ttsAPI.MSP_SUCCESS != result.ret) {
        console.error("QTTSSessionBegin failed, error code: %d.\n", result.ret)
        return null
    }
    sessionID = result.sessionID
    ret = result.ret
    ret = ttsAPI.ttsTextPut(sessionID, src_text)
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("QTTSTextPut failed, error code: %d.\n", ret)
        ttsAPI.ttsSessionEnd(result.sessionID, "TextPutError")
        return null
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
        await sleep(0.7)
    }
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("QTTSAudioGet failed, error code: %d.\n", ret)
        ttsAPI.ttsSessionEnd(sessionID, "AudioGetError")
        return null
    }

    ret = ttsAPI.ttsSessionEnd(sessionID, "Normal")
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("QTTSSessionEnd failed, error code: %d.\n", ret)
    }
    return raw_data
}

var sleep = function (time) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve();
        }, time * 1000);
    })
};

/**
 *  upload file to qiniu, if upload failed, it will retry 3 times. 
 *  if upload still failed after retry, it return "None"
 * @param {string} key file name on qiniu
 * @param  {bytes} buffer
 * @return null = upload failed, or uploaded key
 */
const uploadspeech = async(buffer) => {

    var audioFileFolder = __dirname + "/xfyun_tts"
    if (fsExistsSync(audioFileFolder) == false) {
        fs.mkdirSync(audioFileFolder);
    }
    var key = "audio_" + ((new Date()).getTime()) + ".mp3"
    var localfile = audioFileFolder + "/" + key
    var fsStream = new Readable();
    fsStream.push(buffer);
    fsStream.push(null);
    await ffmpeg_to_mp3(fsStream, localfile)

    var access_key = '_D2Iavhr-DRKHHhW0BTT7-liQ2jO-1cC_lqKn0eF'
    var secret_key = 'E3QKF99mgA8HAyGF1nMlKWVVaKlIxRpTZvEb1CiO'
    var mac = new qiniu.auth.digest.Mac(access_key, secret_key)
    var options = {
        scope: 'pipixia',
        expires: 7200
    }
    var putPolicy = new qiniu.rs.PutPolicy(options)

    var uploadToken = putPolicy.uploadToken(mac)
    var config = new qiniu.conf.Config()
    // 空间对应的机房
    config.zone = qiniu.zone.Zone_z2;
    // 是否使用https域名
    //config.useHttpsDomain = true;
    // 上传是否使用cdn加速
    config.useCdnDomain = true;
    var resumeUploader = new qiniu.resume_up.ResumeUploader(config)
    var putExtra = new qiniu.resume_up.PutExtra()
    putExtra.mimeType = "audio/mpeg"
    putExtra.fname = key
    // putExtra.resumeRecordFile = 'progress.log'
    
    putExtra.progressCallback = function (uploadBytes, totalBytes) {
        console.log(`upload progress:......${parseInt(uploadBytes * 1009/totalBytes)/10} %....${uploadBytes/1000000} MB/ ${totalBytes/1000000}MB`);
    }
    try {
        var results = await resumeUploader.putFileAsync(uploadToken, null, localfile, putExtra);
        console.log("results:" + results)
        var respBody = results[0]
        var respInfo = results[1]
        if (respInfo.statusCode == 200) {
            console.log(respBody)
            fs.unlinkSync(localfile)
            return key
        } else {
            console.log(respInfo.statusCode)
            console.log(respBody)
            throw new Error(respInfo.statusCode + respBody)
        }
    } catch (error) {
        console.error(error)
        return null
    }
}

function fsExistsSync(path) {
    try {
        fs.accessSync(path, fs.F_OK);
    } catch (e) {
        return false;
    }
    return true;
}

module.exports = text2speech