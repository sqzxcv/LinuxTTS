const qiniu = require("qiniu");
const proc = require("process");
const Readable = require('stream').Readable;

var bucket = "pipixia-rawdata"
var access_key = "OhNE1MBZ4gK9BabORyt6t1SCWnvXJaKOqUU4W1Dp"
var secret_key = "IsFwIU4Wm-08kjbg3veg5pjCoRzf43LLAO5vCVCS"
var mac = new qiniu.auth.digest.Mac(access_key, secret_key);
var options = {
  scope: bucket,
  expires: 7200
}
var putPolicy = new qiniu.rs.PutPolicy(options);

var uploadToken = putPolicy.uploadToken(mac);
var config = new qiniu.conf.Config();
// var localFile = "/var/www/LinuxTTS/source/audio_1505745859801.wav";
var localFile = `/Users/xiajun/Documents/Codes/wav/audio_1505728753388_3.wav`
config.zone = qiniu.zone.Zone_z2;
config.useCdnDomain = true;
var resumeUploader = new qiniu.resume_up.ResumeUploader(config);
var putExtra = new qiniu.resume_up.PutExtra();
putExtra.params = {
  "x:name": "",
  "x:age": 27,
}
putExtra.fname = 'testfile.wave';
putExtra.resumeRecordFile = 'progress.log';
putExtra.progressCallback = function (uploadBytes, totalBytes) {
  console.log("progress:" + uploadBytes + "(" + totalBytes + ")");
}

//file
console.log(uploadToken)
console.log(localFile)
console.log(putExtra)


// resumeUploader.putFile(uploadToken, null, localFile, putExtra, function(respErr,
//   respBody, respInfo) {
//   if (respErr) {
//     console.error(respErr)
//     throw respErr;
//   }

//   if (respInfo.statusCode == 200) {
//     console.log(respBody);
//   } else {
//     console.log(respInfo.statusCode);
//     console.log(respBody);
//   }
// });

var buffer = new Buffer.from("哈哈哈哈啊哈哈哈啊哈哈哈啊哈哈", 'utf8')
buffer = Buffer.concat([buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer])
buffer = Buffer.concat([buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer])
buffer = Buffer.concat([buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer])
buffer = Buffer.concat([buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer])
// buffer = Buffer.concat([buffer, buffer, buffer, buffe,])
// buffer = Buffer.concat([buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer])
// buffer = Buffer.concat([buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer])

console.log("buffer size: " + buffer.length)

var fsStream = new Readable();
fsStream.push(buffer);
// fsStream.push(null);
fsStream.resume()

// var streamBuffers = require('stream-buffers');

// var fsStream = new streamBuffers.ReadableStreamBuffer({
// 	frequency: 10,   // in milliseconds.
// 	chunkSize: 2048  // in bytes.
// });

// fsStream.put(buffer)

resumeUploader.putStream(uploadToken, null, fsStream, buffer.length, putExtra, function (respErr,respBody,respInfo) {
  if (respErr) {
    console.error(respErr)
    // throw respErr;
  }

  if (respInfo.statusCode == 200) {
    console.log(respBody);
  } else {
    console.log(respInfo.statusCode);
    console.log(respBody);
  }
});