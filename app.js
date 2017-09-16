
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
    // var text = `凌晨刚结束的苹果发布会稍显与众不同，苹果公司创始人乔布斯被再一次隆重缅怀。对，iPhone 已经诞生 10 年了，它卖出了 12 亿部。
    
    // 新世相的用户里 ，有一半人使用 iPhone。但并不是说只有用苹果手机才与此有关系。无论你在哪里，用什么手机，你生活的某个方面一定因为 iPhone 的诞生而发生过改变。
    
    // 一位读者跟我说，10 年前他上高中时，用妈妈买的山寨杂牌手机。班里的土豪买了 iphone 3GS，玩赛车游戏，左右晃就能控制，看得他直流口水。
    
    // 苹果手机只是个开始，它的跟随者与它一起，让我们真正进入了智能手机时代。`
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