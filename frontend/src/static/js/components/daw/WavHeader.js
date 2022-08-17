// Reference:
// https://github.com/zhuker/lamejs/blob/32f6198fc9d7dc69894977152a08442607738c40/src/js/index.js#L138
export default function WavHeader() {
    this.dataOffset = 0;
    this.dataLen = 0;
    this.channels = 0;
    this.sampleRate = 0;
}

function fourccToInt(fourcc) {
    return fourcc.charCodeAt(0) << 24 | fourcc.charCodeAt(1) << 16 | fourcc.charCodeAt(2) << 8 | fourcc.charCodeAt(3);
}

WavHeader.RIFF = fourccToInt("RIFF");
WavHeader.WAVE = fourccToInt("WAVE");
WavHeader.fmt_ = fourccToInt("fmt ");
WavHeader.data = fourccToInt("data");

WavHeader.readHeader = function (dataView) {
    var w = new WavHeader();

    var header = dataView.getUint32(0, false);
    if (WavHeader.RIFF != header) {
        return;
    }
    var fileLen = dataView.getUint32(4, true);
    if (WavHeader.WAVE != dataView.getUint32(8, false)) {
        return;
    }
    if (WavHeader.fmt_ != dataView.getUint32(12, false)) {
        return;
    }
    var fmtLen = dataView.getUint32(16, true);
    var pos = 16 + 4;
    switch (fmtLen) {
        case 16:
        case 18:
            w.channels = dataView.getUint16(pos + 2, true);
            w.sampleRate = dataView.getUint32(pos + 4, true);
            break;
        default:
            throw 'extended fmt chunk not implemented';
    }
    pos += fmtLen;
    var data = WavHeader.data;
    var len = 0;
    while (data != header) {
        header = dataView.getUint32(pos, false);
        len = dataView.getUint32(pos + 4, true);
        if (data == header) {
            break;
        }
        pos += (len + 8);
    }
    w.dataLen = len;
    w.dataOffset = pos + 8;
    return w;
};
