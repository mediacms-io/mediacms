# Panopto migration

Brings recordings from a Panopto instance into MediaCMS: the file, the title, the
description, the date, its access and sharing, its folder as a category (or as an RBAC
category when the folder is restricted), and an account for its owner.
Superusers only, from **Migrations** in the top right menu.

## Credentials

Panopto's API client authenticates as a *user*, so you need both a client and an account.

**1. The API client** — `/Panopto/Pages/Admin/` → **System → API Clients → Create new API
Client**. Choose **User-Based Server Application**: the other client types only allow the
authorization code flow, which needs a browser redirect a background migration cannot do.
Note the client id and secret.

**2. A service account** — **Users → Create New User**, a *local* Panopto account with admin
rights. SSO-only accounts cannot be used, as the password grant cannot drive an SSO login.
The migration sees exactly what this account sees.

**3. In MediaCMS** — New migration → Panopto, then Service URL
(`https://yourorg.cloud.panopto.eu`), client id, client secret, service account and its
password. Both secrets are encrypted at rest and never returned by the API.

To check a client allows the right grant before using it:

```bash
curl -s -X POST "https://<site>/Panopto/oauth2/connect/token" \
  -u "<client-id>:<client-secret>" -d "grant_type=password" \
  -d "username=probe-does-not-exist" -d "password=x" -d "scope=api"
```

`invalid_grant` is the answer you want. `unauthorized_client` means the wrong client type,
`invalid_client` a wrong id or secret.

## Test connection

Reports the recordings and folders those credentials can reach, and **downloads**, which is
the row to read first: an instance with downloads switched off answers every metadata call
happily and then has nothing to hand over.

## Options

| Option | Default | Effect |
| --- | --- | --- |
| Folders | **required** | Loaded by Test connection. Only recordings in the chosen folders and everything beneath them are migrated. |
| Migrate all users | off | Every account on the instance, whether or not it owns a recording. Read over SOAP, since the REST API will not list users. |
| Only migrate below listed users | off | Only recordings owned by the listed users, given as Panopto user ids, usernames or emails. The others are recorded as skipped. |
| Only migrate users that own media | on | An owner is created as their recordings arrive. A recording whose owner cannot be resolved goes to `admin`. |
| Import captions | on | Only when Panopto offers a caption file for the recording. The caption keeps its language: a Danish caption arrives as Danish. |
| Preserve views | on | Panopto keeps no play count, so the number of people who watched the recording is carried over instead. |
| Migrate playlists | on | Playlists in the chosen folders, holding the recordings of theirs that this migration brought over. |
| LTI platform for LMS courses | none | Course folders of an LMS integration are wired to this platform, keyed on the LMS course id Panopto keeps on the course groups, so a course launch lands in the migrated category. Their `[assignments]` folders are not. Needs LTI and RBAC switched on. |
| Include My Folder recordings | on | Recordings in everyone's My Folder come along whatever folders are chosen. The `Users` and `Remote Recorders` folders are never offered as folders to choose. |

## What a run does

Users first when **Migrate all users** is on, then the folders, then the recordings. For
each recording: the owner (`/sessions/{id}` names the creator, `/users/{id}` gives the
username, email and system role, matched by email first), then the file, then its state,
folder and sharing, then the caption if there is one.

With **Migrate all users** off, only people who own a migrated recording, or who a migrated
folder or recording names, get an account. A new account takes Panopto's system role:
Administrator becomes a superuser, Videographer an editor, everyone else a plain user. The
newer Panopto roles are not exposed by its API, so they cannot be carried over.

### Folders

* **My Folder** trees, under `Users`, do not become categories. Their recordings go to their
  owner's media, shared with the people and groups the folder and the recording name.
* **Remote Recorders** does not become a category either; its recordings arrive uncategorised.
* **Every other folder** inside the chosen ones becomes a category, keyed on the Panopto folder
  guid, whether or not it holds recordings. A public folder becomes a plain category. Any other
  folder becomes an RBAC category with a group of the people and groups it names, an LMS course
  when the names include LMS groups such as `Course::Creator`. This needs RBAC switched on
  (`USE_RBAC`); without it, the folder arrives as a plain category and the log says so.

### Access

Panopto's access settings are read from its SOAP AccessManagement service, where "Your
Organisation" and "Public" are built in groups:

| Panopto | Recording | Folder |
| --- | --- | --- |
| Public | public | plain category |
| Your Organisation | private | RBAC category, its owner decides who else |
| Restricted, people named | private, shared with them (My Folder) | RBAC category with them as members |
| Restricted, owner only | private | RBAC category with the owner |

Panopto's API does not say whether something is unlisted: "Your Organisation (Unlisted)" reads
as Your Organisation and "Public (Unlisted)" as Restricted, owner only, so both arrive private.

| Panopto role | Shared recording | RBAC category |
| --- | --- | --- |
| Viewer | co-viewer | member |
| Creator, Content Organizer, Caption Requester | co-editor | contributor |
| Publisher, Analytics Manager | co-owner | manager |
| Viewer with Link | nothing | nothing |

Somebody named twice keeps the highest role. A recording's owner is always a contributor of
its folder's group.

## Listing users

`GET /api/v1/users` is a **create** route and answers 405 to a GET; `/users/search` needs a
search term, returns no total, ignores paging and leaves `Email` null. So the users phase
uses the older SOAP service instead:

```
POST /Panopto/PublicAPI/4.0/UserManagement.svc   SOAPAction ".../IUserManagement/ListUsers"
```

It authenticates with the service account's **password**, not a bearer token, which is
refused there. That is the same password the connection already stores for the token
exchange, so nothing extra is asked of you. It pages properly and reports a real
`TotalResultCount`.

## How the media comes out

The REST API describes a recording but will not serve its video. The file comes from the
viewer's own download URL, which needs a cookie rather than a token:

```
POST /Panopto/oauth2/connect/token      the service account
GET  /api/v1/auth/legacyLogin           trades the token for an .ASPXAUTH cookie
GET  /Panopto/Podcast/Download/<id>.mp4?mediaTargetType=videoPodcast
```

The cookie is shared between workers and refreshed on refusal, because Panopto rate limits
that login and a migration builds a provider per recording.

Panopto serves **one mp4** per recording, so there are no renditions to reuse and no
skip-transcoding option: MediaCMS encodes its own ladder from that file.

## Limits worth knowing

| | |
| --- | --- |
| Users | the REST API creates users but will not list them, so the users phase goes over SOAP. |
| Captions | no endpoint. Only a `CaptionDownloadUrl` on the recording, usually null; its `language` parameter gives the language. |
| Views | no play count, only the list of people who watched, which is what is carried over. |
| Dates | the REST API leaves `StartTime` empty, so the date comes from the SOAP SessionManagement service. |
| Tags | `/sessions/{id}/tags`. |
| Unlisted | not exposed by any API version, so unlisted folders and recordings arrive private. |
| Roles | only Administrator and Videographer are exposed as system roles. |
| Counts | no REST listing returns a total; the SOAP user list does. |

**Discovery is search-led.** `searchQuery` cannot be empty and matches word *prefixes*, so
the query is a bare `*`. Folder walking is a second source but cannot be relied on:
`/folders/{id}/children` returns nothing on some instances even for an administrator, while
`/folders/{id}/sessions` works. Low numbers usually mean the service account's rights, not an
empty instance.

Paging stops only on an empty page: `pageNumber` works, but `maxNumberResults`, `pageSize`,
`startDate` and `endDate` are accepted and ignored.
