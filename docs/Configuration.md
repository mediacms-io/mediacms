## Configuration

A number of options are available on `cms/settings.py`. 

It is advisable to override any of them by adding it to `cms/local_settings.py` . 

Any change needs restart of MediaCMS in order to take effect. So edit `cms/local_settings.py`, make a change and restart MediaCMS 

```
#systectl restart mediacms
```


### change portal logo

Set a new svg file for the white theme (`static/images/logo_dark.svg`) or the dark theme (`static/images/logo_light.svg`)

### set global portal title

set `PORTAL_NAME`, eg

```
PORTAL_NAME = 'my awesome portal'
```

### who can add media

By default `CAN_ADD_MEDIA = "all"` means that all registered users can add media. Other valid options are:

- **email_verified**, a user not only has to register an account but also verify the email (by clicking the link sent upon registration). Apparently email configuration need to work, otherise users won't receive emails. 

- **advancedUser**, only users that are marked as advanced users can add media. Admins or MediaCMS managers can make users advanced users by editing their profile and selecting advancedUser.

### what is the portal workflow

The `PORTAL_WORKFLOW` variable specifies what happens to newly uploaded media, whether they appear on listings (as the index page, or search)

- **public** is the default option and means that a media can appear on listings. If media type is video, it will appear once at least a task that produces an encoded version of the file has finished succesfully. For other type of files, as image/audio they appear instantly

- **private** means that newly uploaded content is private - only users can see it or MediaCMS editors, managers and admins. Those can also set the status to public or unlisted

- **unlisted** means that items are unlisted. However if a user visits the url of an unlisted media, it will be shown (as opposed to private)


### show/hide the Sign in button

to show button:
```
LOGIN_ALLOWED = True
```

to hide button:

```
LOGIN_ALLOWED = False
```

### show/hide the Register button

to show button:
```
REGISTER_ALLOWED = True
```

to hide button:

```
REGISTER_ALLOWED = False
```


### show/hide the upload media button

To show:

```
UPLOAD_MEDIA_ALLOWED = True
```

To hide:

```
UPLOAD_MEDIA_ALLOWED = False
```

### show/hide the actions buttons (like/dislike/report)

Make changes (True/False) to any of the following:

```
- CAN_LIKE_MEDIA = True  # whether the like media appears
- CAN_DISLIKE_MEDIA = True  # whether the dislike media appears
- CAN_REPORT_MEDIA = True  # whether the report media appears
- CAN_SHARE_MEDIA = True  # whether the share media appears
```

### automatically hide media upon being reported

set a low number for variable `REPORTED_TIMES_THRESHOLD`
eg 

```
REPORTED_TIMES_THRESHOLD = 2
```

once the limit is reached, media goes to private state and an email is sent to admins

### set a custom message on the media upload page

this message will appear below the media drag and drop form

```
PRE_UPLOAD_MEDIA_MESSAGE = 'custom message'
```

### set email settings

Set correct settings per provider

```
DEFAULT_FROM_EMAIL = 'info@mediacms.io'
EMAIL_HOST_PASSWORD = 'xyz'
EMAIL_HOST_USER = 'info@mediacms.io'
EMAIL_USE_TLS = True
SERVER_EMAIL = DEFAULT_FROM_EMAIL
EMAIL_HOST = 'mediacms.io'
EMAIL_PORT = 587
ADMIN_EMAIL_LIST = ['info@mediacms.io']
```

### disallow user registrations from specific domains

set domains that are not valid for registration via this variable:

```
RESTRICTED_DOMAINS_FOR_USER_REGISTRATION = [
    'xxx.com', 'emaildomainwhatever.com']
```

### require a review by MediaCMS editors/managers/admins

set value

```
MEDIA_IS_REVIEWED = False
```

any uploaded media now needs to be reviewed before it can appear to the listings. 
MediaCMS editors/managers/admins can visit the media page and edit it, where they can see the option to mark media as reviewed. By default this is set to True, so all media don't require to be reviewed

### specify maximum number of media for a playlist

set a different threshold on variable `MAX_MEDIA_PER_PLAYLIST`

eg

```
MAX_MEDIA_PER_PLAYLIST = 14
```

### specify maximum size of a media that can be uploaded

change `UPLOAD_MAX_SIZE`. 

default is 4GB

```
UPLOAD_MAX_SIZE = 800 * 1024 * 1000 * 5
```

### specify maximum size of comments

change `MAX_CHARS_FOR_COMMENT`

default:

```
MAX_CHARS_FOR_COMMENT = 10000
```

### how many files to upload in parallel

set a different threshold for `UPLOAD_MAX_FILES_NUMBER`
default:

```
UPLOAD_MAX_FILES_NUMBER = 100
```

### force users confirm their email upon registrations

default option for email confirmation is optional. Set this to mandatory in order to force users confirm their email before they can login

```
ACCOUNT_EMAIL_VERIFICATION = 'optional'
```

### rate limit account login attempts

after this number is reached

```
ACCOUNT_LOGIN_ATTEMPTS_LIMIT = 20
```

sets a timeout (in seconds)

```
ACCOUNT_LOGIN_ATTEMPTS_TIMEOUT = 5
```

### disallow user registration

set the following variable to False

```
USERS_CAN_SELF_REGISTER = True
```

### configure notifications

Global notifications that are implemented are controlled by the following options:

```
USERS_NOTIFICATIONS = {
    'MEDIA_ADDED': True,    
}
```

If you want to disable notification for new media, set to False

Admins also receive notifications on different events, set any of the following to False to disable

```
ADMINS_NOTIFICATIONS = {
    'NEW_USER': True,
    'MEDIA_ADDED': True,
    'MEDIA_REPORTED': True,
}
```

- NEW_USER: a new user is added
- MEDIA_ADDED: a media is added
- MEDIA_REPORTED: the report for a media was hit
