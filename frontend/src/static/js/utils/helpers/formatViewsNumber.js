export default function (views_number, fullNumber) {
  function formattedValue(val, lim, unit) {
    return Number(parseFloat(val / lim).toFixed(val < 10 * lim ? 1 : 0)) + unit;
  }

  function format(i, views, mult, compare, limit, units) {
    while (views >= compare) {
      limit *= mult;
      compare *= mult;
      i += 1;
    }
    return i < units.length
      ? formattedValue(views, limit, units[i])
      : formattedValue(views * (mult * (i - (units.length - 1))), limit, units[units.length - 1]);
  }

  return fullNumber ? views_number.toLocaleString() : format(0, views_number, 1000, 1000, 1, ['', 'K', 'M', 'B', 'T']);
}
