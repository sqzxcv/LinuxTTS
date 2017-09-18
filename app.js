"use strict";

const ttsAPI = require("./text_to_speech/xfyun_tts/ttsAPI")
const text_to_speech = require("./text_to_speech/xfyun_tts/text2speech")
// const text_to_speech = require("./text_to_speech/baidu_tts/text2speech")
const asyncJob = require('async');
const request_koa = require("./common/request_koa.js")
const mysql = require('mysql')
const bluebird = require("bluebird")
const sqlStringM = require('sqlstring')
const moment = require("moment")
bluebird.promisifyAll(require("mysql/lib/Connection").prototype)
bluebird.promisifyAll(require("mysql/lib/PoolConnection").prototype)
bluebird.promisifyAll(require("mysql/lib/Pool").prototype)
const config = require('./config')


var connection = null
const main = async() => {

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
    var results
    
    while (1) {

        results = await convertTTSJob()
        if (results.length == 0) {
            // 数据库中数据已经处理完毕
            await sleep(60 * 5)
        } else {
            await sleep(20)
        }
    }
    await pool.endAsync();
    await connection.releaseAsync();
}

const convertTTSJob = () => {

    return new Promise(async function (resolve, reject) {

        // var sql = `select doc_id, content, contentHtml,news_time, title, url from document where audio is NULL and news_time != 0  order by doc_id desc limit 1;`
        var sql = `select * from document where doc_id = 7919`
        var update = `insert into document (doc_id, audio, url) values`
        var insert = `insert ignore into radioDB(news_id, catalog_name, catalog_id,image, duration, summary, text, tags, source, hot,news_time,title,audio,collect_time, catalogid) values`
        var results = await connection.queryAsync(sql)
        if (results.length == 0) {
            console.warn("没有查询到数据")
            // await sleep(60 * 5)
            resolve({
                results: []
            })
        }

        asyncJob.mapLimit(results, 1, (result, callback) => {

            const job = async() => {
                //只要调用callback(error,null) mapLimit即可终止循环
                //update resource
                try {
                    var audio_path = await text_to_speech(result.content)
                    if (audio_path == null) {
                        console.error("合成失败")
                        callback(null, null)
                    } else {
                        console.log("合成完成：" + audio_path)
                        // callback(null, ret)
                        var newtime = result.news_time
                        //todo:tags, catalogid
                        var catalogid = 1
                        var tags = sqlStringM.escape("")
                        var radioValue = `('${"doc_"+result.doc_id}', '${""}', '${"0"}', '${""}', ${0}, '${""}', '${''}', ${tags}, '${""}', ${0}, ${newtime}, ${sqlStringM.escape(result.title)}, ${sqlStringM.escape(audio_path)}, ${moment().unix()}, ${catalogid})`

                        var updateDoc = `(${result.doc_id}, ${sqlStringM.escape(audio_path)}, ${sqlStringM.escape(result.url)})`
                        callback(null, {radioValue:radioValue, updateDoc:updateDoc})
                
                    }
                } catch (error) {
                    console.error(error)
                    callback(null, null)
                }
            }
            job()
        }, async(err, results) => {
            try {
                var radioValues = [], updateDocs = []
                for (var index = 0; index < results.length; index++) {
                    var element = results[index];
                    if (element !== null) {
                        radioValues.push(element.radioValue)
                        updateDocs.push(element.updateDoc)
                    }
                }
                if (updateDocs.length != 0) {
                    update += updateDocs.join(', ')
                    update += ` on duplicate key update audio=values(audio)`
                    var res = await connection.queryAsync(update)
                    console.log("update document row:" + res.affectedRows)
                }
                if (radioValues.length != 0) {
                    insert += radioValues.join(', ')
                    res = await connection.queryAsync(insert)
                    console.log("insert into radioDB rwo:" + res.affectedRows)
                }
                
                if (res.affectedRows)
                resolve({
                    length: results.length
                })
            } catch (error) {
                console.error(error)
            }
        })
    });
}

var sleep = function (time) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve();
        }, time * 1000);
    })
};

main()