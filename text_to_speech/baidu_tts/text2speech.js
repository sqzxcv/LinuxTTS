
"use strict";

const request_koa = require("../../common/request_koa.js")
const moment = require("moment")
const fs = require("fs")
const qiniu = require("qiniu")
const bluebird = require("bluebird")
const util = require('util');
const schedule = require("node-schedule");
var request = require('request')
const Get =  bluebird.promisify(request.get)
bluebird.promisifyAll(qiniu.form_up.FormUploader.prototype, {
    multiArgs: true
})
bluebird.promisifyAll(qiniu.fop.OperationManager.prototype, {
    multiArgs: true
})

var access_token = ""
var expires_date = 0
var qiniuAuth = ""

/**
 * @param  {string} text 
 * @return 返回 通过text 转换成 的mp3音频文件路径,如果转换失败,返回 null
 */
const text2speech = async(text) => {
    var splitArr = text.split(/(\.|\?|!|。|？|！)/g)
    var textArr = []
    var subText = ""
    splitArr.forEach(function (substr) {
        if ((subText + substr).length > 500 && subText.length != 0) {
            textArr.push(encodeURI(subText))
            subText = substr
        } else if ((subText + substr).length > 500 && subText.length == 0) {
            subText += substr
            textArr.push(encodeURI(subText))
            subText = ""
        } else {
            subText += substr
        }
    }, this);
    textArr.push(encodeURI(subText))

    var access_token = await login()
    if (access_token.length == 0) {
        console.error("baidu API token is empty")
    } else {
        var ttsurl = "http://tsn.baidu.com/text2audio?lan=zh&tok=" +
            access_token + "&ctp=1&cuid=aaaaaaaaaaaa&tex="
        var textfilepath = "audio_" + ((new Date()).getTime())
        var url = ""
        var filepath = ""
        var mp3urls = []
        for (var index in textArr) {
            if (textArr.hasOwnProperty(index)) {
                var sbtext = textArr[index];
                url = ttsurl + sbtext
                var res = await request_koa({
                    url: url,
                    encoding: null
                })
                if (res.response.headers['content-type'] == "audio/mp3") {
                    filepath = textfilepath + "_" + index + ".mp3"
                    if (0 == await uploadspeech(filepath, res.body)) {
                        console.error("上传音频文件失败")
                        return null
                    }
                    console.log("上传" + index + "音频文件成功")
                } else {
                    console.error("text span convert to audio failed,because:" + res.body)
                    return null
                }
                console.log("gen MP3 file:" + index + "span")
                mp3urls.push("http://ouyzqo88y.bkt.clouddn.com/"+filepath)
            }
        }
        mp3urls[0] = mp3urls[0].replace("http://ouyzqo88y.bkt.clouddn.com/","")
        // 上传完成开始合并
        var result = textfilepath + ".mp3"
       if (1 == await audioConcat(result, mp3urls)) {
           result = "http://oty38yumz.bkt.clouddn.com/" + result
           console.log("完整音频地址:" + result)
           return result
       } else {
           console.error("～～～～音频拼接失败")
           return null
       }
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
        `avconcat/2/format/mp3/${filepaths}|saveas/${ qiniu.util.urlsafeBase64Encode('pipixia:' + savekey)}`
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

var sleep = function (time) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve();
        }, time);
    })
};

/**
 *  upload file to qiniu, if upload failed, it will retry 3 times. 
 *  if upload still failed after retry, it return "None"
 * @param {string} key file name on qiniu
 * @param  {bytes} buffer
 * @return 0 = upload failed, 1 = upload successed
 */
const uploadspeech = async(key, buffer) => {
    var access_key = '_D2Iavhr-DRKHHhW0BTT7-liQ2jO-1cC_lqKn0eF'
    var secret_key = 'E3QKF99mgA8HAyGF1nMlKWVVaKlIxRpTZvEb1CiO'
    var mac = new qiniu.auth.digest.Mac(access_key, secret_key)
    var options = {
        scope: "pipixia-rawdata",
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
        var retry = 0
        while (retry < 3) {

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
            await sleep(1)
            console.log("retry count:" + retry)
            retry ++;
        }
    } catch (error) {
        console.error(error)
        return 0
    }
}

const login = async() => {

    if (expires_date > moment().unix() && access_token.length > 0) {

        return access_token
    }
    var url = " https://openapi.baidu.com/oauth/2.0/token?grant_type=client_credentials&client_id=6NCOZQHM7f2bGzc9tKemZovU&client_secret=X0uXNGMIUkiockwY8Q16P6B41E3Xc98a&"
    try {
        var resStr = await request_koa({
            url: url
        });
        var res = JSON.parse(resStr.body)
        access_token = res['access_token']
        expires_date = moment().unix() + res["expires_in"] - 1000
        return access_token
    } catch (error) {
        console.error("get baidu  tts token faild")
        console.error(error)
        access_token = ""
        expires_date = 0
        return ""
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

module.exports = text2speech;

// var content = "文|朱昂 导读：去年年 底的时候，我们就做过“新零售”的研究。我们一直认为新零售是今年变革最大的行业之一，无论是阿里巴巴对于银泰百货的私有化，还是盒马生鲜的模式，以及亚马逊收购Whole Foods。我们看到全球最大的两大电商都在加速布局线下零售。 我们年初就提出一个观点： 新零售是融合，O2O是割裂。 新零售不是换了名字的O2O。而最近，对于新零售我又有了一些新的想法，和大家分享。 新零售是线上对线下的革命 许多人认为新零售会对传统零售带来价值的重估，这个想法部分正确。由于整个互联网线上的流量红利宣告结束，线下获取流量的成本已经比线上更低。而随着电商渗透率的继续提高，从标准化的商品向非标准化的服务迈进，也需要线下实体店作为电商的载体。 但是从全渠道的角度看，实体零售店将继续面临更大冲击。 可以说新零售的系统将有阿里，京东，小米这类电商设置。 未来如果没有被纳入电商系统的实体零售，会面临比过去几年更加严峻的冲击。从企业基因的角度看，互联网企业能给实体零售带来更加高效的渠道系统，全平台的流量分发，以及价值越来越大的用户数据管理。而传统实体零售根本无法突破自己的基因。我曾经和某位在大实体百货公司的朋友交流，以他们目前的体系和后台管理系统，要对抗互联网企业是完全不可能的。 所以新零售在一开始是线上和线下的融合，但是在这个过程中制定游戏规则的依然是效率更高，创新精神更强的互联网企业。实体线下零售商通过和互联网企业的合作拿到未来零售业的门票，在这种实体零售店明显产能过剩的时代，线下如果不融入线上在未来几年可能遭遇灭顶之灾。 未来我们看到的新零售店是阿里的线下实体店，京东的线下实体店，网易的线下实体店，小米的线下实体店。这些互联网企业，将在这两年大规模推进线下实体店，通过网上和网下同价模式，线下提供服务，线上提供流量来继续增加他们对于整个零售行业的改造。 线上线下数字化：打破B2C之间的割裂 传统零售还有一个问题，就是 商家（B）和用户（C）之间是割裂的。 比如传统的超市，每天只能提供卖了多少牛肉，多少鳕鱼，多少鸡蛋，多少可乐等。但是到底谁买了这些产品，他们并不知道。所以传统零售要提高用户忠诚度就比较难，要么是利用物理半径的优势，要么就是价格绝对便宜。 以前在美国，每个星期六超市都是邮寄折扣券给住在附近的人，但是由于对用户没有认知，这本折扣券非常厚，对于大部分人来说没啥价值。 但是今天的阿里巴巴、盒马生鲜就不同。 每一个用户买了什么，系统都是有数据的。 用户不能支付现金，必须下载APP通过支付宝完成支付。最终阿里会有所有的用户数据，这些数据能让阿里更准确知道用户是谁，他们喜欢什么。最终基于大数据，商家能精准推送用户喜欢的商品，每一个人看到的商品都是不同的。而且由于超市有区域半径，不同社区的人群收入，消费层次也不同，最终将导致每一个盒马生鲜的产品也会不同。 不管线上还是线下，新零售用互联网， 从用户身份到购买行为，完全的数字化了。 B2C之间的割裂打破，将极大提高商家和用户的效率。 甚至你走到商场的镜子前， 因为你的画像和数据不同，就能看到不同的广告。 用户走进一场商场，就会自动收到符合他消费习惯商店的商品信息提示。过去我们都希望用户逛超市，逛商场的时间越多越好。未来，互联网企业希望用户有最好的体验。他们能够迅速找到自己喜欢的商品，然后有更多时间来娱乐。 B2C之间的割裂打破，一定是未来最确定的趋势。 严选模式的崛起 过去线上电商有一个优势，就是无限货架。但是进入线下实体后，必须面临有限货架的难题。 这会逐渐催生严选模式的崛起。事实上，在我们过去对于Costco模式的分析中，就说过Costco的增速能够超过沃尔玛，在亚马逊崛起后依然股价上涨5倍，一个原因就是Costco是严选模式。用户面临20种牙膏也不知道如何选择，而Costco提供三种品质优良的牙膏就足够了。 我们看到小米之家，看到盒马都是严选模式。我来帮助用户做过滤，提供足够好的商品。 今天在盒马生鲜，用户能够在最短时间找到自己需要的东西。而不是在迷失在里面乱搞。盒马提供了基本上所有我们需要的商品，而且每一个都有品质保证。这让用户的体验大幅提高，如果不吃里面的海鲜，基本上20分钟内就逛完了。 曾经有一次要给小孩买一个儿童桌，去了N多年没去过的宜家。大家都知道宜家就算不买，要按照里面的路线走完也要几乎一个小时，其实仅仅是为了买一个儿童桌而已。显然，这种希望用户停留时间过长的商业模式已经开始伤害新一代互联网用户了。今天，时间是最宝贵的，而许多人一定会愿意为了更高的效率，支付一定溢价。 苏宁的教训：为什么无法反攻线上？ 我印象最深的就是2013年看到美国的百思买，国内的苏宁都是开始建立自己的互联网平台，将通过线下实体店提供服务的股市。但是最终的结果是，他们竞争的对手亚马逊，阿里，京东都越来越强。苏宁有着中国最优秀的管理层，也曾经一度用颠覆性的商业模式改变了家电卖场。 但为什么今天，苏宁无法走入线上呢？ 我的理解还是企业基因。在大部分企业，除非传统业务大规模亏损了，否则利润部门一定会是强势部门。除非公司管理层亲自带队做转型和革命，否则新业务部门是颠覆不了传统部门的。这导致企业的资源，投入都很难全面转向创新部门。最终无法革命的是他们的基因。 从企业的效率，反应速度，包容程度看，线下的传统企业也根本无法赶上互联网企业。这点和当年苹果推出智能手机后，诺基亚也曾经想效仿一样。最终传统企业是难以变革自己的。任何一次革命都是反人性的。这也是为什么，新零售一定是线上包容线下。 最终的结果是电商越来越庞大。 新零售最终的结果是实体零售被电商们融入到自己的体系。这会让阿里，京东们的体量越来越大。目前整体电商的渗透率不到20%，未来从10%向50%渗透的过程，一定伴随着更好的用户体验，更高的购物效率，更精准的服务和数据推送。从这点看，阿里巴巴的尽头似乎还远远没到。"

// text2speech(content)

// urlsStr = `["http://ouyzqo88y.bkt.clouddn.com/audio_1503302624710_0.mp3","audio_1503302624710_1.mp3","audio_1503302624710_2.mp3","audio_1503302624710_3.mp3","audio_1503302624710_4.mp3","audio_1503302624710_5.mp3","audio_1503302624710_6.mp3","audio_1503302624710_7.mp3","audio_1503302624710_8.mp3"]`
// urlsStr = `["audio_1501673039.mp3","audio_1501673056.mp3","audio_1501673080.mp3"]`

// urlsStr = `["audio_1501673039.mp3","http://oty38yumz.bkt.clouddn.com/audio_1501673056.mp3","http://oty38yumz.bkt.clouddn.com/audio_1501673080.mp3"]`
// urls = JSON.parse(urlsStr)
// if (urls !=0 ) {
//     audioConcat((new Date()).getTime() + ".mp3", urls)
// }