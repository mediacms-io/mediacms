import React from 'react';
import { format } from 'timeago.js';
import { formatViewsNumber, imageExtension } from '../../../../utils/helpers/';
// import { VideoPlayerByPageLink } from '../../../video-player/VideoPlayerByPageLink';
import { translateString } from '../../../../utils/helpers/';

export function ItemDescription(props) {
    return '' === props.description ? null : (
        <div className="item-description">
            <div>{props.description}</div>
        </div>
    );
}

export function ItemMain(props) {
    return <div className="item-main">{props.children}</div>;
}

export function ItemMainInLink(props) {
    return (
        <ItemMain>
            <a className="item-content-link" href={props.link} title={props.title}>
                {props.children}
            </a>
        </ItemMain>
    );
}

export function ItemTitle(props) {
    return '' === props.title ? null : (
        <h3>
            <span aria-label={props.ariaLabel}>{props.title}</span>
        </h3>
    );
}

export function ItemTitleLink(props) {
    return '' === props.title ? null : (
        <h3>
            <a href={props.link} title={props.title}>
                <span aria-label={props.ariaLabel}>{props.title}</span>
            </a>
        </h3>
    );
}

export function UserItemMemberSince(props) {
    return <time key="member-since">Member for {format(new Date(props.date)).replace(' ago', '')}</time>;
}

export function TaxonomyItemMediaCount(props) {
    // Check if listing numbers should be included based on settings
    if (!window.MediaCMS.features.listings.includeNumbers) {
        return null;
    }

    return (
        <span key="item-media-count" className="item-media-count">
            {' ' + props.count} media
        </span>
    );
}

export function PlaylistItemMetaDate(props) {
    return (
        <span className="item-meta">
            <span className="playlist-date">
                <time dateTime={props.dateTime}>{props.text}</time>
            </span>
        </span>
    );
}

export function MediaItemEditLink(props) {
    let link = props.link;

    if (link && window.MediaCMS.site.devEnv) {
        link = '/edit-media.html';
    }

  return !link ? null : (
    <a href={link} title={translateString("Edit media")} className="item-edit-icon">
      <i className="material-icons">edit</i>
    </a>
  );
}

export function MediaItemViewLink(props) {
  return !props.link ? null : (
    <a href={props.link} title={translateString("Publish media")} className="item-view-icon">
      <i className="material-icons">publish</i>
    </a>
  );
}

export function MediaItemThumbnailLink(props) {
    const attr = {
        key: 'item-thumb',
        href: props.link,
        title: props.title,
        tabIndex: '-1',
        'aria-hidden': true,
        className: 'item-thumb' + (!props.src ? ' no-thumb' : ''),
        style: !props.src ? null : { backgroundImage: "url('" + props.src + "')" },
    };

    return (
        <a {...attr}>
            {!props.src ? null : (
                <div key="item-type-icon" className="item-type-icon">
                    <div></div>
                </div>
            )}
        </a>
    );
}

export function UserItemThumbnailLink(props) {
    const attr = {
        key: 'item-thumb',
        href: props.link,
        title: props.title,
        tabIndex: '-1',
        'aria-hidden': true,
        className: 'item-thumb' + (!props.src ? ' no-thumb' : ''),
        style: !props.src ? null : { backgroundImage: "url('" + props.src + "')" },
    };

    return <a {...attr}></a>;
}

export function MediaItemAuthor(props) {
    return '' === props.name ? null : (
        <span className="item-author">
            <span>{props.name}</span>
        </span>
    );
}

export function MediaItemAuthorLink(props) {
    return '' === props.name ? null : (
        <span className="item-author">
            <a href={props.link} title={props.name}>
                <span>{props.name}</span>
            </a>
        </span>
    );
}

export function MediaItemMetaViews(props) {
    return (
        <span className="item-views">
            {formatViewsNumber(props.views) +
                ' ' +
                (1 >= props.views ? translateString('view') : translateString('views'))}
        </span>
    );
}

export function MediaItemMetaDate(props) {
    return (
        <span className="item-date">
            <time dateTime={props.dateTime} content={props.time}>
                {props.text}
            </time>
        </span>
    );
}

export function MediaItemDuration(props) {
    return (
        <span className="item-duration">
            <span aria-label={props.ariaLabel} content={props.time}>
                {props.text}
            </span>
        </span>
    );
}

export function MediaItemVideoPreviewer(props) {
    if ('' === props.url) {
        return null;
    }

    const src = props.url.split('.').slice(0, -1).join('.');
    const ext = imageExtension(props.url);

    return <span className="item-img-preview" data-src={src} data-ext={ext}></span>;
}

export function MediaItemVideoPlayer(props) {
    return (
        <div className="item-player-wrapper">
            <div className="item-player-wrapper-inner">
                stop component tou VideoPlayerByPageLink
                {/*  <VideoPlayerByPageLink pageLink={props.mediaPageLink} /> */}
            </div>
        </div>
    );
}

export function MediaItemPlaylistIndex(props) {
    return (
        <div className="item-order-number">
            <div>
                <div data-order={props.index} data-id={props.media_id}>
                    {props.inPlayback && props.index === props.activeIndex ? (
                        <i className="material-icons">play_arrow</i>
                    ) : (
                        props.index
                    )}
                </div>
            </div>
        </div>
    );
}
