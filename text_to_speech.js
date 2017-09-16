var ffi = require('ffi');
var libPath = __dirname + '/libs/x64/libmsc'
const ttsSessionBegin = (params) => {
    
    var libm = ffi.Library(libPath, {
        'QTTSSessionBegin': ['string', ['string', 'int *']]
    });

    var ret = ref.alloc(ref.types.int, -1)
    libm.QTTSSessionBegin(params, ret)
    console.log("QTTSSessionBegin 返回值：" + ret)
    return ret
}

const login = (usr,pwd, params) => {
    var libm = ffi.Library(libPath, {
        'MSPLogin': ['int',['string','string','string']]
    })
    var ret = MSPLogin(usr, pwd, params)
    console("登陆返回值：" + ret)
    return ret
}

module.exports = {
    ttsSessionBegin: ttsSessionBegin,
    login:login
}