"use strict";

const fs = require("fs")
const ttsAPI = require("./ttsAPI")
const randomActor = require('./actor')
const qiniu = require("qiniu")
const bluebird = require("bluebird")
bluebird.promisifyAll(qiniu.form_up.FormUploader.prototype, {
    multiArgs: true
})
bluebird.promisifyAll(qiniu.fop.OperationManager.prototype, {
    multiArgs: true
})

const text2speech = async(text) => {

    console.log(`text.length:${text.length}-------------byte length:${Buffer.byteLength(text
    , 'utf8')}`)
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

    if (textArr.length > 1) {
        var textfilepath = "audio_" + ((new Date()).getTime())
        var filepath = ""
        var mp3urls = []
        for (var index in textArr) {
            if (textArr.hasOwnProperty(index)) {
                var sbtext = textArr[index];
                filepath = textfilepath + "_" + index + ".wav"
                try {
                    var res = await text_to_speech(sbtext, filepath, randomActor())
                    if (ttsAPI.MSP_SUCCESS != res.ret) {
                        console.error("合成失败")
                        return null
                    }
                    if (0 == await uploadspeech(filepath, res.data, "pipixia-rawdata")) {
                        console.error("上传音频文件失败")
                        return null
                    }
                    console.log("上传" + index + "音频文件成功")
                } catch (error) {
                    console.error(error)
                }
                console.log("gen MP3 file:" + index + "span")
                mp3urls.push("http://ouyzqo88y.bkt.clouddn.com/" + filepath)
            }
        }
        mp3urls[0] = mp3urls[0].replace("http://ouyzqo88y.bkt.clouddn.com/", "")
        // 上传完成开始合并
        var result = textfilepath + ".wav"
        if (1 == await audioConcat(result, mp3urls)) {
            result = "http://oty38yumz.bkt.clouddn.com/" + result
            console.log("完整音频地址:" + result)
            return result
        } else {
            return null
        }
    } else {
        //音频只有一个片段，不需要拼接
        var filepath = textfilepath + "_" + index + ".wav"
        var res = await text_to_speech(text, filepath, randomActor())
        if (ttsAPI.MSP_SUCCESS != res.ret) {
            console.error("生成音频失败")
            return null
        }
        if (0 == await uploadspeech(filepath, res.data, "pipixia")) {
            console.error("上传音频文件失败")
            return null
        }
        console.log("上传音频文件成功")
        result = "http://oty38yumz.bkt.clouddn.com/" + result
        console.log("完整音频地址:" + result)
        return
    }

}

const text_to_speech = async(src_text, des_path, params) => {

    // console.log("开始转化文本：" + src_text)
    var ret = -1
    var sessionID = null
    var audio_len = 0
    var synth_status = ttsAPI.MSP_TTS_FLAG_STILL_HAVE_DATA

    if (null == src_text || null == des_path) {
        console.error("params is error!\n");
        return {
            ret: ret
        };
    }

    var result = ttsAPI.ttsSessionBegin(params)
    if (ttsAPI.MSP_SUCCESS != result.ret) {
        console.error("QTTSSessionBegin failed, error code: %d.\n", result.ret)
        return {
            ret: result.ret
        }
    }
    sessionID = result.sessionID
    ret = result.ret
    ret = ttsAPI.ttsTextPut(sessionID, src_text)
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("QTTSTextPut failed, error code: %d.\n", ret)
        ttsAPI.ttsSessionEnd(result.sessionID, "TextPutError")
        return {
            ret: ret
        }
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
        return {
            ret: ret
        }
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

    //todo remove
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
    return {
        ret: ret,
        data: audio_data
    }
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
 * @return 0 = upload failed, 1 = upload successed
 */
const uploadspeech = async(key, buffer, saveBucket) => {
    var access_key = '_D2Iavhr-DRKHHhW0BTT7-liQ2jO-1cC_lqKn0eF'
    var secret_key = 'E3QKF99mgA8HAyGF1nMlKWVVaKlIxRpTZvEb1CiO'
    var mac = new qiniu.auth.digest.Mac(access_key, secret_key)
    var options = {
        scope: saveBucket//"pipixia-rawdata",
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
    var formUploader = new qiniu.form_up.FormUploader(config)
    var putExtra = new qiniu.form_up.PutExtra()
    putExtra.mimeType = "audio/mpeg"
    putExtra.fname = key
    // var key = "audio_" + moment().unix()+".mp3"
    try {
        var results = await formUploader.putAsync(uploadToken, key, buffer, putExtra)
        var respBody = results[0]
        var respInfo = results[1]
        if (respInfo.statusCode == 200) {
            console.log(respBody)
            return 1
        } else {
            console.log(respInfo.statusCode)
            console.log(respBody)
            throw new Error(respInfo.statusCode + respBody)
        }
    } catch (error) {
        console.error(error)
        return 0
    }
}

/**
 * @param  {} audio1
 * @param  {} audio2
 */
const audioConcat = async(savekey, urls) => {

    if (urls.length == 0) {
        return null
    } else if (urls.length == 1) {
        return urls[0]
    }

    var access_key = '_D2Iavhr-DRKHHhW0BTT7-liQ2jO-1cC_lqKn0eF'
    var secret_key = 'E3QKF99mgA8HAyGF1nMlKWVVaKlIxRpTZvEb1CiO'
    var mac = new qiniu.auth.digest.Mac(access_key, secret_key)
    var config = new qiniu.conf.Config()
    // 空间对应的机房
    config.zone = qiniu.zone.Zone_z2;
    // 是否使用https域名
    //config.useHttpsDomain = true;
    // 上传是否使用cdn加速
    config.useCdnDomain = true;
    var operManager = new qiniu.fop.OperationManager(mac, config)

    //处理指令集合
    var filepaths = qiniu.util.urlsafeBase64Encode(urls[1])
    for (var index = 2; index < urls.length; index++) {
        var url = urls[index];
        filepaths += '/' + qiniu.util.urlsafeBase64Encode(url)
    }
    var fops = [
        `avconcat/2/format/wav/${filepaths}|saveas/${ qiniu.util.urlsafeBase64Encode('pipixia:' + savekey)}`
    ];
    var pipeline = 'pipixia_concat';
    var srcBucket = 'pipixia-rawdata';
    try {
        var results = await operManager.pfopAsync(srcBucket, urls[0], fops, pipeline, null)
        if (results[1].statusCode == 200) {
            var persistentId = results[0].persistentId
            while (1) {
                //每各一秒查询一次状态
                await sleep(1000)
                var checkProcess = await operManager.prefopAsync(persistentId)
                console.log("=========================================")
                if (checkProcess[1].statusCode == 200) {
                    console.log(checkProcess[0].code);
                    if (checkProcess[0].code == 0) {
                        console.log("音频合成完成")
                        break;
                    }
                } else {
                    console.log(checkProcess[1].statusCode);
                    console.log(checkProcess[0]);
                    throw new Error("statusCode:" + checkProcess[1].statusCode + "info:音频合成失败." + checkProcess[0].error)
                }
            }
            return 1
        } else {
            console.log(results[1].statusCode);
            console.log(results[0]);
            throw new Error("statusCode:" + results[1].statusCode + "info:创建音频合成任务失败." + results[0].error)
        }
    } catch (error) {
        console.error(error)
        console.error("音频合成失败")
        return 0
    }
}

module.exports = text2speech