import React, { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

function setValue(value, min, max) {
  if (void 0 !== value) {
    let ret = null;
    ret = void 0 !== min && min > value ? min : value;
    ret = void 0 !== max && max < ret ? max : ret;
    return ret;
  }

  if (void 0 !== min) {
    return min;
  }

  if (void 0 !== max) {
    return max;
  }
}

function setUnit(value, units) {
  if (!units || !units.length) {
    return null;
  }

  let i = 0;
  while (i < units.length) {
    if (void 0 !== units[i].key && value === units[i].key) {
      return units[i].key;
    }

    i += 1;
  }

  return units[0].key;
}

export function NumericInputWithUnit(props) {
  const valueInputRef = useRef(null);
  const valueUnitRef = useRef(null);

  const [currentValue, setCurrentValue] = useState(null);
  const [currentUnit, setCurrentUnit] = useState(null);

  function onChangeValue() {
    setCurrentValue(valueInputRef.current.value);

    if (void 0 !== props.valueCallback) {
      props.valueCallback(valueInputRef.current.value);
    }
  }

  function onChangeUnit() {
    setCurrentUnit(valueUnitRef.current.value);

    if (void 0 !== props.unitCallback) {
      props.unitCallback(valueUnitRef.current.value);
    }
  }

  function unitOptions() {
    if (!props.units.length) {
      return null;
    }

    const ret = [];

    let i = 0;
    while (i < props.units.length) {
      if (void 0 !== props.units[i].key) {
        ret.push(
          <option key={props.units[i].key} value={props.units[i].key}>
            {void 0 !== props.units[i].label ? props.units[i].label : props.units[i].key}
          </option>
        );
      }

      i += 1;
    }

    return ret;
  }

  useEffect(() => {
    setCurrentValue(setValue(0 + props.defaultValue, props.minValue, props.maxValue));
    setCurrentUnit(setUnit(props.defaultUnit, props.units));
  });

  return (
    <div className="num-value-unit">
      {void 0 !== props.label ? <span className="label">{props.label}</span> : null}
      <input
        ref={valueInputRef}
        className="value-input"
        type="number"
        value={null !== currentValue ? currentValue : ''}
        min={void 0 !== props.minValue ? props.minValue : null}
        max={void 0 !== props.maxValue ? props.maxValue : null}
        onChange={onChangeValue}
      />
      <select
        ref={valueUnitRef}
        className="value-unit"
        onChange={onChangeUnit}
        value={null !== currentUnit ? currentUnit : ''}
      >
        {unitOptions()}
      </select>
    </div>
  );
}

NumericInputWithUnit.propTypes = {
  label: PropTypes.string,
  units: PropTypes.array.isRequired,
  defaultUnit: PropTypes.string,
  defaultValue: PropTypes.number,
  minValue: PropTypes.number,
  maxValue: PropTypes.number,
  valueCallback: PropTypes.func,
  unitCallback: PropTypes.func,
};
