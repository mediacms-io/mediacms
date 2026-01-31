import React from 'react';
import PropTypes from 'prop-types';
import UrlParse from 'url-parse';
import { ApiUrlContext, MemberContext, SiteContext } from '../utils/contexts/';
import { formatInnerLink, csrfToken, postRequest, inEmbeddedApp } from '../utils/helpers/';
import { PageActions } from '../utils/actions/';
import { PageStore, ProfilePageStore } from '../utils/stores/';
import ProfilePagesHeader from '../components/profile-page/ProfilePagesHeader';
import ProfilePagesContent from '../components/profile-page/ProfilePagesContent';
import { MediaListRow } from '../components/MediaListRow';
import { ProfileMediaPage } from './ProfileMediaPage';

class ChannelContactForm extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      subject: '',
      body: '',
      isSending: false,
    };

    this.onUpdateSubject = this.onUpdateSubject.bind(this);
    this.onUpdateBody = this.onUpdateBody.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onSubmitSuccess = this.onSubmitSuccess.bind(this);
    this.onSubmitFail = this.onSubmitFail.bind(this);
  }

  onUpdateSubject() {
    this.setState({
      subject: this.refs.msgSubject.value.trim(),
    });
  }

  onUpdateBody() {
    this.setState({
      body: this.refs.msgBody.value.trim(),
    });
  }

  onSubmitSuccess(response) {
    this.setState(
      {
        subject: '',
        body: '',
        isSending: false,
      },
      function () {
        setTimeout(
          function () {
            // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
            PageActions.addNotification(
              'Your message was successfully submitted to ' + this.props.author.name,
              'messageSubmitSucceed'
            );
          }.bind(this),
          100
        );
      }
    );
  }

  onSubmitFail(response) {
    this.setState(
      {
        isSending: false,
      },
      function () {
        console.log(response);

        setTimeout(
          function () {
            // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
            PageActions.addNotification('Your message failed to submit. Please try again', 'messageSubmitFailed');
          }.bind(this),
          100
        );
      }
    );
  }

  onSubmit(ev) {
    if (this.state.isSending || '' === this.state.subject || '' === this.state.body) {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();

    this.setState(
      {
        isSending: true,
      },
      function () {
        const url = ApiUrlContext._currentValue.users + '/' + this.props.author.username + '/contact';

        postRequest(
          url,
          {
            subject: this.state.subject,
            body: this.state.body,
          },
          {
            headers: {
              'X-CSRFToken': csrfToken(),
            },
          },
          false,
          this.onSubmitSuccess,
          this.onSubmitFail
        );
      }
    );
  }

  render() {
    return (
      <div className="media-list-row profile-contact">
        <div className="media-list-header">
          <h2>Contact</h2>
        </div>
        <form method="post" className={'user-contact-form' + (this.state.isSending ? ' pending-response' : '')}>
          <span>
            <label>Subject</label>
            <input
              ref="msgSubject"
              type="text"
              required={true}
              onChange={this.onUpdateSubject}
              value={this.state.subject}
            />
          </span>
          <span>
            <label>Message</label>
            <textarea
              ref="msgBody"
              required={true}
              cols="40"
              rows="10"
              onChange={this.onUpdateBody}
              value={this.state.body}
            ></textarea>
          </span>
          <button onClick={this.onSubmit}>SUBMIT</button>
        </form>
      </div>
    );
  }
}

export class ProfileAboutPage extends ProfileMediaPage {
  constructor(props) {
    super(props, 'author-about');

    this.userIsAuthor = null;
    this.enabledContactForm = false;
  }

  pageContent() {
    let description = null;
    let details = [];
    let socialMedia = [];

    if (this.state.author) {
      if (null === this.userIsAuthor) {
        if (MemberContext._currentValue.is.anonymous) {
          this.userIsAuthor = false;
          this.enabledContactForm = false;
        } else {
          this.userIsAuthor = ProfilePageStore.get('author-data').username === MemberContext._currentValue.username;
          this.enabledContactForm = !this.userIsAuthor && MemberContext._currentValue.can.contactUser;
        }
      }

      let i;

      if (
        void 0 !== this.state.author.description &&
        !!this.state.author.description &&
        '' !== this.state.author.description
      ) {
        description = this.state.author.description;
      }

      if (void 0 !== this.state.author.location_info && this.state.author.location_info.length) {
        let locations = [];
        i = 0;
        while (i < this.state.author.location_info.length) {
          if (
            void 0 !== this.state.author.location_info[i].title &&
            void 0 !== this.state.author.location_info[i].url
          ) {
            locations.push(
              <a
                key={i}
                href={formatInnerLink(this.state.author.location_info[i].url, SiteContext._currentValue.url)}
                title={this.state.author.location_info[i].title}
              >
                {this.state.author.location_info[i].title}
              </a>
            );
          }
          i += 1;
        }
        details.push(
          <li key={'location'}>
            <span>Location:</span>
            <span>{locations}</span>
          </li>
        );
      } else if (
        void 0 !== this.state.author.location &&
        !!this.state.author.location &&
        '' !== this.state.author.location
      ) {
        // TODO: Remove it, doesn't really need. Remains for backward compatibility.
        details.push(
          <li key={'location'}>
            <span>Location:</span>
            <span>{this.state.author.location}</span>
          </li>
        );
      }

      let lnk;

      if (
        void 0 !== this.state.author.home_page &&
        !!this.state.author.home_page &&
        '' !== this.state.author.home_page
      ) {
        lnk = UrlParse(this.state.author.home_page.trim()).toString();
        if ('' !== lnk) {
          details.push(
            <li key={'website'}>
              <span>Website:</span>
              <span>{lnk}</span>
            </li>
          );
        }
      }

      if (
        void 0 !== this.state.author.social_media_links &&
        !!this.state.author.social_media_links &&
        '' !== this.state.author.social_media_links
      ) {
        let socialMediaLinks = this.state.author.social_media_links.split(',');
        if (socialMediaLinks.length) {
          i = 0;
          while (i < socialMediaLinks.length) {
            lnk = socialMediaLinks[i].trim();
            if ('' !== lnk) {
              socialMedia.push(<span key={i}>{lnk}</span>);
            }
            i += 1;
          }
          details.push(
            <li key={'social_media'}>
              <span>Social media:</span>
              <span className="author-social-media">{socialMedia}</span>
            </li>
          );
        }
      }
    }

    return [
      this.state.author ? (
        <ProfilePagesHeader key="ProfilePagesHeader" author={this.state.author} type="about" hideChannelBanner={inEmbeddedApp()} />
      ) : null,
      this.state.author ? (
        <ProfilePagesContent key="ProfilePagesContent" enabledContactForm={this.enabledContactForm}>
          <div className="media-list-wrapper items-list-ver  profile-about-content ">
            {null === description && 0 < details.length ? null : PageStore.get('config-options').pages.profile
                .htmlInDescription ? (
              <MediaListRow title={this.props.title}>
                <span dangerouslySetInnerHTML={{ __html: description || null }}></span>
              </MediaListRow>
            ) : (
              <MediaListRow title={this.props.title}>{description}</MediaListRow>
            )}

            {!details.length ? null : (
              <MediaListRow title={'Details'}>
                <ul className="profile-details">{details}</ul>
              </MediaListRow>
            )}

            {this.enabledContactForm ? <ChannelContactForm author={this.state.author} /> : null}
          </div>
        </ProfilePagesContent>
      ) : null,
    ];
  }
}

ProfileAboutPage.propTypes = {
  title: PropTypes.string.isRequired,
};

ProfileAboutPage.defaultProps = {
  title: 'Biography',
};
