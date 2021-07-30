import React, { useState, useEffect } from 'react';

export function useManagementTableHeader(props) {
  const [sort, setSort] = useState(props.sort);
  const [order, setOrder] = useState(props.order);
  const [isSelected, setIsSelected] = useState(props.selected);

  function sortByColumn(ev) {
    const colId = ev.currentTarget.getAttribute('id');

    const newSort = colId;
    const newOrder = sort === colId ? ('desc' === order ? 'asc' : 'desc') : 'desc';

    setSort(newSort);
    setOrder(newOrder);

    if (void 0 !== props.onClickColumnSort) {
      props.onClickColumnSort(newSort, newOrder);
    }
  }

  function checkAll() {
    const newSelected = !isSelected;

    setIsSelected(!newSelected);

    if (void 0 !== props.onCheckAllRows) {
      props.onCheckAllRows(newSelected, props.type);
    }
  }

  useEffect(() => {
    setSort(props.sort);
  }, [props.sort]);

  useEffect(() => {
    setOrder(props.order);
  }, [props.order]);

  useEffect(() => {
    setIsSelected(props.selected);
  }, [props.selected]);

  return [sort, order, isSelected, sortByColumn, checkAll];
}
