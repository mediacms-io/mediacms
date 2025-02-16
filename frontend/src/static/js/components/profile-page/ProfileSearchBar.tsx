import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch, RootState } from '../../utils/stores/store';
import { updateSearchQuery } from '../../utils/stores/actions/profile';
import { CircleIconButton } from '../_shared';

interface ProfileSearchBarProps {
  onQueryChange?: (query: string) => void;
}
const FixedCircleIconButton = CircleIconButton as React.FC<{
  children: React.ReactNode;
  buttonShadow?: boolean;
  onClick?: () => void;
}>;
const ProfileSearchBar: React.FC<ProfileSearchBarProps> = ({ onQueryChange }) => {
  const dispatch = useDispatch<AppDispatch>();
  const authorQuery = useSelector((state: RootState) => state.profile.authorQuery) || '';
  const [visibleForm, setVisibleForm] = useState(false);

  const handleChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const queryVal = ev.target.value;
    dispatch(updateSearchQuery(queryVal));
    if (onQueryChange) {
      onQueryChange(queryVal);
    }
  };

  const handleFormSubmit = (ev: React.FormEvent<HTMLFormElement>) => {
    if (authorQuery.trim() === '') {
      ev.preventDefault();
    }
  };

  return !visibleForm ? (
    <div>
      <span>
        <FixedCircleIconButton buttonShadow={false} onClick={() => setVisibleForm(true)}>
          <i className="material-icons" aria-hidden="true">
            search
          </i>
        </FixedCircleIconButton>
      </span>
    </div>
  ) : (
    <form method="get" action="/search" onSubmit={handleFormSubmit}>
      <span>
        <FixedCircleIconButton buttonShadow={false}>
          <i className="material-icons" aria-hidden="true">
            search
          </i>
        </FixedCircleIconButton>
      </span>
      <span>
        <input
          autoFocus
          type="text"
          name="aq"
          placeholder="Search"
          aria-label="Search"
          value={authorQuery}
          onChange={handleChange}
        />
      </span>
    </form>
  );
};

export default ProfileSearchBar;
