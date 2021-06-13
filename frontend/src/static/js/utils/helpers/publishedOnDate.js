import { months } from '../constants';

export default function publishedOnDate(date, type) {
  if (date instanceof Date) {
    type = 0 + type;
    type = 0 < type ? type : 1;
    switch (type) {
      case 1:
        return months[date.getMonth()].substring(0, 3) + ' ' + date.getDate() + ', ' + date.getFullYear();
      case 2:
        return date.getDate() + ' ' + months[date.getMonth()].substring(0, 3) + ' ' + date.getFullYear();
      case 3:
        return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    }
  }
  return null;
}
