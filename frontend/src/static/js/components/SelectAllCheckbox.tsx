import React from 'react';
import './SelectAllCheckbox.scss';
import { translateString } from '../utils/helpers/';

interface SelectAllCheckboxProps {
  totalCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const SelectAllCheckbox: React.FC<SelectAllCheckboxProps> = ({
  totalCount,
  selectedCount,
  onSelectAll,
  onDeselectAll,
}) => {
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;

  const handleChange = () => {
    if (allSelected || someSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  const isDisabled = totalCount === 0;

  return (
    <div className="select-all-checkbox">
      <label className={'select-all-label' + (isDisabled ? ' disabled' : '')}>
        <input
          type="checkbox"
          checked={allSelected}
          ref={(input) => {
            if (input) {
              input.indeterminate = someSelected;
            }
          }}
          onChange={handleChange}
          disabled={isDisabled}
          aria-label={translateString('Select all media')}
        />
        <span className="checkbox-label-text">{translateString('All')}</span>
      </label>
    </div>
  );
};
