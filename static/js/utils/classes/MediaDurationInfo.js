import { isPositiveIntegerOrZero } from '../helpers/';

const _MediaDurationInfoData = {};

export class MediaDurationInfo {
  constructor(seconds) {
    _MediaDurationInfoData[
      Object.defineProperty(this, 'id', { value: 'MediaDurationInfo_' + Object.keys(_MediaDurationInfoData).length }).id
    ] = {
      fn: {
        infoToString: function (v) {
          return v < 10 ? '0' + v : v;
        },
      },
    };

    if (isPositiveIntegerOrZero(seconds)) {
      this.update(seconds);
    }
  }

  update(seconds) {
    _MediaDurationInfoData[this.id].toString = void 0;
    _MediaDurationInfoData[this.id].ariaLabel = void 0;

    if (isPositiveIntegerOrZero(seconds)) {
      _MediaDurationInfoData[this.id].days = Math.floor(seconds / 86400);
      _MediaDurationInfoData[this.id].seconds = seconds % 86400;
      _MediaDurationInfoData[this.id].date = _MediaDurationInfoData[this.id].seconds
        ? new Date(_MediaDurationInfoData[this.id].seconds * 1000)
        : null;
      _MediaDurationInfoData[this.id].hours = _MediaDurationInfoData[this.id].date
        ? 24 * _MediaDurationInfoData[this.id].days + _MediaDurationInfoData[this.id].date.getUTCHours()
        : 0;
      _MediaDurationInfoData[this.id].minutes = _MediaDurationInfoData[this.id].date
        ? _MediaDurationInfoData[this.id].date.getUTCMinutes()
        : 0;
      _MediaDurationInfoData[this.id].seconds = _MediaDurationInfoData[this.id].date
        ? _MediaDurationInfoData[this.id].date.getSeconds()
        : 0;
    }
  }

  toString() {
    if (void 0 === _MediaDurationInfoData[this.id].toString) {
      _MediaDurationInfoData[this.id].toString =
        (0 < _MediaDurationInfoData[this.id].hours ? _MediaDurationInfoData[this.id].hours + ':' : '') +
        (0 < _MediaDurationInfoData[this.id].hours && 10 > _MediaDurationInfoData[this.id].minutes ? '0' : '') +
        _MediaDurationInfoData[this.id].minutes +
        ':' +
        _MediaDurationInfoData[this.id].fn.infoToString(_MediaDurationInfoData[this.id].seconds);
    }
    return _MediaDurationInfoData[this.id].toString;
  }

  ariaLabel() {
    if (void 0 === _MediaDurationInfoData[this.id].ariaLabel) {
      let r = [];
      if (0 < _MediaDurationInfoData[this.id].hours) {
        r.push(_MediaDurationInfoData[this.id].hours + ' hours');
      }
      if (0 < _MediaDurationInfoData[this.id].minutes) {
        r.push(_MediaDurationInfoData[this.id].minutes + ' minutes');
      }
      if (0 < _MediaDurationInfoData[this.id].seconds) {
        r.push(_MediaDurationInfoData[this.id].seconds + ' seconds');
      }
      _MediaDurationInfoData[this.id].ariaLabel = r.join(', ');
    }
    return _MediaDurationInfoData[this.id].ariaLabel;
  }

  // LINK: https://en.wikipedia.org/wiki/ISO_8601#Durations
  ISO8601() {
    return (
      'P0Y0M0DT' +
      _MediaDurationInfoData[this.id].hours +
      'H' +
      _MediaDurationInfoData[this.id].minutes +
      'M' +
      _MediaDurationInfoData[this.id].seconds +
      'S'
    );
  }
}
