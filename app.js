const ttsAPI = require("./ttsAPI")
const text_to_speech = require("./text_to_speech")
const asyncJob = require('async');
const request_koa = require("./common/request_koa.js")
const mysql = require('mysql')
bluebird.promisifyAll(require("mysql/lib/Connection").prototype);
bluebird.promisifyAll(require("mysql/lib/PoolConnection").prototype)
bluebird.promisifyAll(require("mysql/lib/Pool").prototype);
const config = require('./config')
const randomActor = require('./actor')


const mainjob = async() => {

    var filename = "test.wav"
    var text = "亲爱的用户，您好，这是一个语音合成示例，感谢您对科大讯飞语音技术的支持！科大讯飞是亚太地区最大的语音上市公司，股票代码：002230"
}

main()

const main = async => {

    /* 用户登录 */
    var ret = 0
    var login_params = "appid = 59b98543, work_dir = ."
    ret = ttsAPI.login(null, null, login_params)
    if (ttsAPI.MSP_SUCCESS != ret) {
        console.error("登陆失败")
        return
    }
    var pool = mysql.createPool({
        host: config['dbhost'],
        user: config['dbuser'],
        password: config['dbpwd'],
        database: "Nina",
        connectionLimit: 100,
        port: "3306",
        waitForConnections: false
    });
    try {
        connection = await pool.getConnectionAsync();
    } catch (error) {
        console.error(error)
        console.error("创建数据库链接失败")
        return
    }
    var sql = `select doc_id, content, contentHtml from document where audio is NULL and news_time != 0  order by doc_id desc limit 20;`
    var update = `update document set audio=${audio} where doc_id = ${result.doc_id}`
    var insert = `insert ignore into radioDB(news_id, catalog_name, catalog_id,image, duration, summary, text, tags, source, hot,news_time,title,audio,collect_time, catalogid) values`
    while (1) {

        var results = await connection.queryAsync(sql)
        if (results.length == 0) {
            console.warn("没有查询到数据")
            await sleep(60 * 5)
        }

        asyncJob.mapLimit(results, async(result, callback) => {

            //update resource
            /* 文本合成 */
            try {
                ret = await text_to_speech(text, filename, randomActor())
                if (ttsAPI.MSP_SUCCESS != ret) {
                    console.error("合成失败")
                }
            } catch (error) {
                console.error(error)
            }
        }, async(err, results) => {
            await sleep(20)
        })
    }
    await pool.endAsync();
    await connection.releaseAsync();
}

var sleep = function (time) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve();
        }, time * 1000);
    })
};