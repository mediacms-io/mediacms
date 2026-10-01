# Panopto migration

Brings recordings from a Panopto instance into MediaCMS: the file, the title, the
description, the date, the folder it lived in as a category, and an account for its owner.
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
| Only migrate users that own media | on | An owner is created as their recordings arrive. Off sends everything to the fallback owner. |
| Fallback owner | `admin` | For a recording whose owner cannot be resolved. |
| Import captions | on | Only when Panopto offers a caption file for the recording. |

## What a run does

Users first when **Migrate all users** is on, then media. For each recording: the owner
(`/sessions/{id}` names the creator, `/users/{id}` gives the username and email, matched by
email first), then the file, then the folder as a category keyed on the Panopto folder guid,
then the caption if there is one.

With **Migrate all users** off, only people who own a migrated recording get an account.

**Play counts and publish state do not come across** — Panopto's API offers neither, so an
imported recording takes the portal's default state. Titles arrive exactly as Panopto reports
them, which for an upload is a hash and the original filename.

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
| Captions | no endpoint. Only a `CaptionDownloadUrl` on the recording, usually null. |
| Views | nothing at all, so play counts cannot be migrated. |
| Folder permissions | `/folders/{id}/permissions` reads them, but the migration does not import them, so nothing becomes an RBAC group. |
| Counts | no REST listing returns a total; the SOAP user list does. |

**Discovery is search-led.** `searchQuery` cannot be empty and matches word *prefixes*, so
the query is a bare `*`. Folder walking is a second source but cannot be relied on:
`/folders/{id}/children` returns nothing on some instances even for an administrator, while
`/folders/{id}/sessions` works. Low numbers usually mean the service account's rights, not an
empty instance.

Paging stops only on an empty page: `pageNumber` works, but `maxNumberResults`, `pageSize`,
`startDate` and `endDate` are accepted and ignored.
