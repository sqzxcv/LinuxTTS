/*
 * rdn:           合成音频数字发音方式
 * volume:        合成音频的音量
 * pitch:         合成音频的音调
 * speed:         合成音频对应的语速
 * voice_name:    合成发音人
 * sample_rate:   合成音频采样率
 * text_encoding: 合成文本编码格式
 *
 */

var xiaoyan = "voice_name = xiaoyan, aue = speex-wb, text_encoding = utf8, sample_rate = 16000, speed = 50, volume = 50, pitch = 50, rdn = 2"

var xiaofeng = "voice_name = xiaofeng, text_encoding = utf8, sample_rate = 16000, speed = 50, volume = 50, pitch = 50, rdn = 2"

var xiaomeng = "voice_name = xiaomeng, text_encoding = utf8, sample_rate = 16000, speed = 50, volume = 50, pitch = 50, rdn = 2"

var yanping = "voice_name = yanping, text_encoding = utf8, sample_rate = 16000, speed = 50, volume = 50, pitch = 50, rdn = 2"

var xiaoqian = "voice_name = jinger, text_encoding = utf8, sample_rate = 16000, speed = 50, volume = 50, pitch = 50, rdn = 2"

var xiaolin = "voice_name = xiaolin, text_encoding = utf8, sample_rate = 16000, speed = 50, volume = 50, pitch = 50, rdn = 2"

var xiaoyuan = ""

var actors = [xiaoyan, xiaofeng, xiaomeng, xiaofeng, yanping, xiaofeng, xiaoqian, xiaofeng, xiaolin]

const randomActor = () => {

    return xiaofeng
    var max = actors.length - 1
    min = 0
    var index = parseInt(Math.random()*(max-min+1)+min,10);
    return actors[index]
}

module.exports = randomActor