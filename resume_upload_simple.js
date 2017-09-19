const qiniu = require("qiniu");
const proc = require("process");

var bucket = `pipixia`;
var access_key = '_D2Iavhr-DRKHHhW0BTT7-liQ2jO-1cC_lqKn0eF'
var access_key = 'E3QKF99mgA8HAyGF1nMlKWVVaKlIxRpTZvEb1CiO'
var mac = new qiniu.auth.digest.Mac(access_key, access_key);
var options = {
  scope: bucket,
}
var putPolicy = new qiniu.rs.PutPolicy(options);

var uploadToken = putPolicy.uploadToken(mac);
var config = new qiniu.conf.Config();
var localFile = "/var/www/LinuxTTS/source/audio_1505745859801.wav";
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
putExtra.progressCallback = function(uploadBytes, totalBytes) {
  console.log("progress:" + uploadBytes + "(" + totalBytes + ")");
}

//file
console.log(uploadToken)
console.log(localFile)
console.log(putExtra)
resumeUploader.putFile(uploadToken, null, localFile, putExtra, function(respErr,
  respBody, respInfo) {
  if (respErr) {
    console.error(respErr)
    throw respErr;
  }

  if (respInfo.statusCode == 200) {
    console.log(respBody);
  } else {
    console.log(respInfo.statusCode);
    console.log(respBody);
  }
});
