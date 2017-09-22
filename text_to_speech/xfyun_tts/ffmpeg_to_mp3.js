var ffmpeg = require('fluent-ffmpeg');

function ffmpeg_to_mp3(audioStream, dest_path) {
    return new Promise(function (resolve, reject) {
        ffmpeg(audioStream)
            .audioCodec('libmp3lame')
            .audioBitrate('160k')
            .audioQuality(0)
            .on('progress', function (progress) {
                console.log('Processing: ' + progress.percent + '% done');
            })
            .on('error', function (err, stdout, stderr) {
                console.log('Cannot process video: ' + err.message);
                reject(err)
            })
            .on('end', function (stdout, stderr) {
                console.log('Transcoding succeeded !');
                resolve()
            })
            .save(dest_path)
    });
}

module.exports = ffmpeg_to_mp3

// var audio = `/var/www/LinuxTTS/source/text_to_speech/xfyun_tts/xfyun_tts/audio_1506072574292.wav`
// var despath = `/var/www/LinuxTTS/source/text_to_speech/xfyun_tts/xfyun_tts/dest2.mp3`
// var command = ffmpeg(audio)
//     .audioCodec('libmp3lame')
//     .audioBitrate('128k')
//     .audioQuality(0)
//     .on('progress', function (progress) {
//         console.log('Processing: ' + progress.percent + '% done');
//     })
//     // .on('stderr', function (stderrLine) {
//     //     console.log('error: ' + stderrLine);
//     // })
//     .on('error', function (err, stdout, stderr) {
//         console.log('Cannot process video: ' + err.message);
//     })
//     .on('end', function (stdout, stderr) {
//         console.log('Transcoding succeeded !');
//     })
//     .save(despath)