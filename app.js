
const ttsAPI = require("./ttsAPI")
const text_to_speech = require("./text_to_speech")


const main = async () => {

    var ret = 0
    var login_params = "appid = 59b98543, work_dir = ."
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

    var session_begin_params = "voice_name = xiaoyan, text_encoding = utf8, sample_rate = 16000, speed = 50, volume = 50, pitch = 50, rdn = 2"
    var filename = "test.wav"
    var text = "亲爱的用户，您好，这是一个语音合成示例，感谢您对科大讯飞语音技术的支持！科大讯飞是亚太地区最大的语音上市公司，股票代码：002230"
    /* 用户登录 */
    ret = ttsAPI.login(null, null, login_params)
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("登陆失败")
        return
    }
    /* 文本合成 */
    try {
        ret = await text_to_speech(text, filename, session_begin_params)
        if (ttsAPI.MSP_SUCCESS != ret) {
            console.error("合成失败")
        }
    } catch (error) {
        console.error(error)
    }
}

main()