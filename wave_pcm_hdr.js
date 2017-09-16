class wave_pcm_hdr {

    constructor() {

        self.riff = "RIFF"
        self.size_8 = 0
        self.wave = "WAVE"
        self.fmt = "fmt"
        self.fmt_size = 16
        self.format_tag = 1
        self.channels = 1
        self.samples_per_sec = 16000
        self.avg_bytes_per_sec = 32000
        self.block_align = 2
        self.bits_per_sample = 16
        self.data = "data"
        self.data_size = 0
    }
}





module.exports = wave_pcm_hdr