import { months as monthList } from '../constants/';

export function formatManagementTableDate(date) {
  const day = date.getDate();
  const month = monthList[date.getMonth()].substring(0, 3);
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  let ret = month + ' ' + day + ', ' + year;
  ret += ' ' + (hours < 10 ? '0' : '') + hours;
  ret += ':' + (minutes < 10 ? '0' : '') + minutes;
  ret += ':' + (seconds < 10 ? '0' : '') + seconds;
  return ret;
}
