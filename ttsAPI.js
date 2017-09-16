var ffi = require('ffi');
const ref = require("ref");

var libPath = __dirname + '/libs/x64/libmsc'
const MSP_SUCCESS = 0
const MSP_TTS_FLAG_STILL_HAVE_DATA = 1
const MSP_TTS_FLAG_DATA_END = 2

const ttsSessionBegin = (params) => {

    var libm = ffi.Library(libPath, {
        'QTTSSessionBegin': ['string', ['string', ref.refType('int')]]
    });

    var ret = ref.alloc(ref.types.int, -1)
    var sessionID = libm.QTTSSessionBegin(params, ret)
    ret = ret.deref()
    console.log("QTTSSessionBegin 返回值：" + ret + ` sessionID:${sessionID}`)
    return {
        ret: ret,
        sessionID: sessionID
    }
}

const ttsTextPut = (sessionID, src_text) => {

    var libm = ffi.Library(libPath, {
        'QTTSTextPut': ['int', ['string', 'string', 'int', 'string']]
    })
    return libm.QTTSTextPut(sessionID, src_text, src_text.length, ref.NULL)
}

const ttsAudioGet = (sessionID) => {

    var audio_len = ref.alloc(ref.types.int, 0)
    var synth_status = ref.alloc(ref.types.int, 0)
    var errorCode = ref.alloc(ref.types.int, 0)
    var libm = ffi.Library(libPath, {
        'QTTSAudioGet': ['pointer', ['string', ref.refType('int'), ref.refType('int'), ref.refType('int')]]
    })

    //var data = ref.alloc(ref.types.void)
    var dataPtr = libm.QTTSAudioGet(sessionID, audio_len, synth_status, errorCode)
    var data = null
    if (dataPtr.isNull()) {
        console.error("dataPtr is null")
    } else {
        data = ref.reinterpret(dataPtr, audio_len.deref(), 0)
        if (data.isNull()) {
            console.error('data is null')
        }
    }

    return {
        audio_len: audio_len.deref(),
        synth_status: synth_status.deref(),
        errorCode: errorCode.deref(),
        data: data
    }
}

const ttsSessionEnd = (sessionID, errorInfo) => {

    var libm = ffi.Library(libPath, {
        'QTTSSessionEnd': ['int', ['string', 'string']]
    })
    return libm.QTTSSessionEnd(sessionID, errorInfo)
}

const login = (usr, pwd, params) => {
    var libm = ffi.Library(libPath, {
        'MSPLogin': ['int', ['string', 'string', 'string']]
    })
    var ret = libm.MSPLogin(usr, pwd, params)
    console.log("登陆返回值：" + ret)
    return ret
}

module.exports = {
    ttsSessionBegin: ttsSessionBegin,
    ttsSessionEnd: ttsSessionEnd,
    ttsAudioGet: ttsAudioGet,
    ttsTextPut: ttsTextPut,
    MSP_SUCCESS: MSP_SUCCESS,
    MSP_TTS_FLAG_DATA_END: MSP_TTS_FLAG_DATA_END,
    MSP_TTS_FLAG_STILL_HAVE_DATA: MSP_TTS_FLAG_STILL_HAVE_DATA,
    login: login
}