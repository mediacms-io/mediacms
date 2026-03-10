import { months } from '../constants';

export function publishedOnDate(date: Date, type: 1 | 2 | 3 = 1) {
    if (!(date instanceof Date)) {
        return null;
    }

    if (type === 2) {
        return date.getDate() + ' ' + months[date.getMonth()].substring(0, 3) + ' ' + date.getFullYear();
    }

    if (type === 3) {
        return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    }

    return months[date.getMonth()].substring(0, 3) + ' ' + date.getDate() + ', ' + date.getFullYear();
}
