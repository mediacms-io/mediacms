import React, { useEffect, useRef, useState, forwardRef, useContext } from 'react';
import { useSelector } from 'react-redux';
import { CircleIconButton } from '../_shared';
import ItemsInlineSlider from '../item-list/includes/itemLists/ItemsInlineSlider';
import { translateString } from '../../utils/helpers';
import ProfileSearchBar from './ProfileSearchBar';
import { LinksContext, MemberContext } from '../../utils/contexts';

interface InlineTabProps {
  id: string;
  label: string;
  link: string;
  isActive: boolean;
}

const InlineTab: React.FC<InlineTabProps> = ({ id, label, link, isActive }) => (
  <li className={isActive ? 'active' : ''}>
    <a href={link} title={label}>
      {label}
    </a>
  </li>
);

interface NavMenuInlineTabsProps {
  type: string;
  onQueryChange?: (query: string) => void;
}

const FixedCircleIconButton = CircleIconButton as React.FC<{
  children: React.ReactNode;
  buttonShadow?: boolean;
  onClick?: () => void;
}>;

const NavMenuInlineTabs = forwardRef<HTMLDivElement, NavMenuInlineTabsProps>(({ type, onQueryChange }, ref) => {
  const memberContext = useContext(MemberContext);
  const linksContext = useContext(LinksContext);
  const [displayNext, setDisplayNext] = useState(false);
  const [displayPrev, setDisplayPrev] = useState(false);
  const inlineSlider = useRef<ItemsInlineSlider | null>(null);

  useEffect(() => {
    const updateSlider = () => {
      if (!inlineSlider.current && ref && typeof ref !== 'function' && ref.current) {
        inlineSlider.current = new ItemsInlineSlider(ref.current, '.profile-nav ul li');
      }
      if (inlineSlider.current) {
        inlineSlider.current.updateDataState(document.querySelectorAll('.profile-nav ul li').length, true, true);
        setDisplayPrev(inlineSlider.current.hasPreviousSlide());
        setDisplayNext(inlineSlider.current.hasNextSlide());
      }
    };

    updateSlider();
    window.addEventListener('resize', updateSlider);
    return () => {
      window.removeEventListener('resize', updateSlider);
    };
  }, [ref]);

  return (
    <nav ref={ref} className="profile-nav items-list-outer list-inline list-slider">
      <div className="profile-nav-inner items-list-outer">
        {displayPrev && (
          <span className="previous-slide">
            <FixedCircleIconButton buttonShadow={false} onClick={() => inlineSlider.current?.previousSlide()}>
              <i className="material-icons">keyboard_arrow_left</i>
            </FixedCircleIconButton>
          </span>
        )}

        <ul className="items-list-wrap">
          <InlineTab
            id="about"
            isActive={type === 'about'}
            label={translateString('About')}
            link={linksContext.profile.about}
          />
          <InlineTab
            id="media"
            isActive={type === 'media'}
            label={translateString('Media')}
            link={linksContext.profile.media}
          />

          {memberContext.can.saveMedia && (
            <InlineTab
              id="playlists"
              isActive={type === 'playlists'}
              label={translateString('Playlists')}
              link={linksContext.profile.playlists}
            />
          )}

          <li className="media-search">
            <ProfileSearchBar onQueryChange={onQueryChange} />
          </li>
        </ul>

        {displayNext && (
          <span className="next-slide">
            <FixedCircleIconButton buttonShadow={false} onClick={() => inlineSlider.current?.nextSlide()}>
              <i className="material-icons">keyboard_arrow_right</i>
            </FixedCircleIconButton>
          </span>
        )}
      </div>
    </nav>
  );
});

export default NavMenuInlineTabs;
