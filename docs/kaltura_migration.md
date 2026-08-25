# Kaltura migration

MediaCMS can copy a Kaltura portal into itself: the media files, the people who own them,
the galleries and channels they sit in, and the captions. You start it, watch it, pause it
when you want the machine back, and run it again later to pick up whatever was added since
or whatever failed.

Only superusers can see or use it. The entry point is **Migrations** in the top right menu.

## What comes over

* Video, audio and image entries, with the original file and optionally the transcoded
  versions Kaltura already made.
* Captions, converted to WebVTT.
* Owners. An account is created for whoever owns an entry, or an existing account is reused
  when one matches.
* Galleries and channels, as flat MediaCMS categories.
* Play counts, and whether the item is public, unlisted or private.
* Category members and their permission level, when RBAC is turned on. See
  [Permissions](#permissions).

Skipped: Kaltura's plain text transcripts, which have no MediaCMS equivalent, playlists, and
live entries or anything else with no downloadable file.

## Getting the API credentials

MediaCMS signs in with a Kaltura **app token**, so you never hand it the administrator
secret for the account. A token is a separate credential, it carries only the privileges you
gave it, and you can revoke it on its own.

Two of the four values in the form are easy to find:

* **Service URL**, the host the API lives on: `https://api.example.edu` for a self hosted or
  managed Kaltura, `https://www.kaltura.com` for SaaS. Leave off the `/api_v3` part.
* **Partner ID**, the number in the KMC under Settings, then Integration Settings.

The other two, **App token ID** and **App token value**, come from creating the token.

### Creating the app token

There is no screen for this in the KMC, so use the API console at
[developer.kaltura.com/console](https://developer.kaltura.com/console) or two curl calls.

Start a session with your administrator secret. It is needed only for the call that follows
and is never stored, so give it five minutes and let it die:

```bash
curl -X POST 'https://api.example.edu/api_v3/service/session/action/start?format=1' \
  -d 'secret=YOUR_ADMIN_SECRET' \
  -d 'partnerId=YOUR_PARTNER_ID' \
  -d 'type=2' \
  -d 'expiry=300'
```

Use the session string it returns to create the token:

```bash
curl -X POST 'https://api.example.edu/api_v3/service/appToken/action/add?format=1' \
  -d 'ks=THE_SESSION_STRING_FROM_ABOVE' \
  -d 'appToken:objectType=KalturaAppToken' \
  -d 'appToken:sessionType=2' \
  -d 'appToken:hashType=SHA256' \
  -d 'appToken:sessionDuration=86400' \
  -d 'appToken:expiry=2147483647' \
  -d 'appToken:description=MediaCMS migration'
```

Three values matter:

* **`sessionType=2`** gives the token **admin rights**, without which the migration sees only
  what one ordinary user can see.
* **`sessionDuration`** is how long each session made from the token lasts, in seconds. A day
  is plenty: MediaCMS starts a fresh session for every batch of media, and silently renews one
  that expires mid call.
* **`expiry`** is a date rather than a duration, and it is when the token itself stops
  working. Migrating a large portal can run for weeks, and this is the only one of these
  numbers that can end a run early, hence 2038 rather than something that merely sounds
  sensible. Some installations cap it or expire tokens by policy, so read the token back with
  `appToken.get` and check what Kaltura actually stored.

The response holds an `id` and a `token`: the **id** goes in App token ID, the **token** in
App token value. Keep the token safe, it is the half that acts as a password. MediaCMS
encrypts it before storing it and never sends it back to the browser. When the migration is
done, `appToken.delete` retires it and nothing else about the account changes.

A token created with a different `hashType` is fine. MediaCMS works out which algorithm it
uses on the first session, trying SHA256, then SHA1, SHA512 and MD5.

## Running a migration

1. Go to `/migrations`, press **New migration** and pick Kaltura.
2. Fill in the service URL, partner ID, app token ID and app token value.
3. Press **Test connection**. It reports how many entries, users and categories the account
   holds, and imports nothing.
4. Set the import options.
5. **Save draft**, or **Save and start** to begin. Nothing is imported until you start it.
6. Watch the migration page: progress, a live log, and the ID mapping table with links to both
   the Kaltura entry and the MediaCMS media.

Credentials are encrypted at rest with a key derived from `SECRET_KEY`, and the API never
returns a secret. The form shows a mask and keeps the stored value if you save without
retyping it. Test connection makes the server talk to whatever address is in the form, which
is one reason the feature is restricted to superusers.

## Import options

Every migration is different, so read these before starting rather than after.

| Option | Default | Effect |
| --- | --- | --- |
| Migrate all users | on | Every account in the portal gets a MediaCMS account, whether or not it owns anything. Off reveals the two options below. |
| Only create users that have media | on | Shown when the option above is off. Accounts are created as the media that belong to them arrive, so service accounts are left alone. |
| Fallback owner | `admin` | Shown when the option above is off. Owns everything the migration brings in. |
| Migrate all categories | on | Every gallery and channel becomes a category. Off means only the ones the imported media actually belong to. |
| Import captions | on | Caption assets become WebVTT subtitles. One that fails to convert is recorded as failed and the media keeps the rest. |
| Preserve views | on | Copy play counts. |
| Preserve publish state | on | Derive public, unlisted or private from the source. See [Permissions](#permissions). |
| Attempt to skip transcoding | on | Import existing Kaltura flavors as MediaCMS encodings instead of re-encoding. |
| Only migrate specific users | **off** | Fetch only the media owned by the listed Kaltura user ids. |
| Kaltura user ids | empty | Comma separated, shown only when the option above is on. |
| Categories | none selected | On the Categories tab. Fetch only the media in the chosen galleries and channels, and everything beneath them. Nothing selected means the whole portal. |

### How users are matched

Accounts are created lazily, as the media that belong to them arrive, and an existing account
is reused rather than duplicated:

1. **By email**, case insensitively. This is the normal link, and what lets a re-run attach
   new media to accounts an earlier run created.
2. **By username**, but only when the existing account has no email of its own. Otherwise it
   is a different, already identified person who happens to collide on the sanitised username,
   and linking would hand them someone else's media.
3. **Otherwise a new account**, with an unusable password, a numeric suffix if the username is
   taken, and no notification email to anyone.

With **Migrate all users** off, only people who own media get an account, so Kaltura service
accounts are left alone. The exception is the members of a private category, who are created
regardless: see [Permissions](#permissions). Roles are covered under
[Roles](#roles).

### Migrating only some categories

The **Categories** tab lists the galleries and channels on the portal, each with the number
of media it holds, and you tick the ones you want. Choosing a category brings **everything
beneath it** as well, so picking a gallery takes its subcategories with it. Tick nothing and
the whole portal is migrated, which means there is no way to switch on a restriction that
then filters on nothing.

Press **Load categories from the source** to fetch the list. Only the galleries and channels
themselves are offered: the KMS instance root, its `site` folder and the `galleries` and
`channels` folders are scaffolding rather than categories, and subcategories are left out
because their parent already covers them.

The count shown is for the whole subtree. Kaltura's own `entriesCount` counts direct members
only, which on a portal with nested galleries would understate what a choice actually pulls.

The selection also narrows the category sweep, so **Migrate all categories** with a selection
in place creates the chosen categories and their children rather than the entire tree.

Under the hood this is `categoryAncestorIdIn`, not a membership filter. That distinction is
the whole feature, and it is worth knowing that it was checked against a live portal rather
than taken from the documentation: on ours an instance root reported 53 entries while holding
none directly, which is both proof that descendants are included and proof that Kaltura is
honouring the filter at all. It answers a filter field it does not support by ignoring it and
returning everything, so a filter that silently did nothing would look like a filter that
matched the whole portal.

### Migrating only specific users

This narrows the whole run to the media owned by the ids you list, which is how to try a
migration on a small known set first.

The value has to be the user id **Kaltura stores on the entry**, which is not always an email
address. A portal can hold a mix of `jdoe@example.edu` and opaque ids like
`f777c82f755df2d4bc9688d340b69292`, whose account may have a completely different email, so
look the id up in the KMC rather than guessing.

Kaltura ignores a filter it cannot use, and answers an unknown user id with zero entries
rather than an error, so both would fail quietly. Against that: an empty list is refused when
saving and no filter is ever sent empty, **Test connection** reports the count per id so a
mistyped one shows as its own `0`, and a run where every listed id has no media ends as an
error rather than an empty success.

Everything else follows the media that pass the filter, and the discovered total is the
filtered count. Widen the list later, or switch the option off, and **Run again** picks up the
rest.

## What maps to what

Categories are flattened. `MediaSpace>site>galleries>Engineering>1. Term>Electronics` becomes
a category titled `Electronics` described as `Engineering: 1. Term: Electronics`, so its place
in the Kaltura tree stays searchable. Titles appear in URLs, so a collision appends the parent
name: `Electronics (Physics)`.

With **Migrate all categories** off, a category is created the first time a media belonging to
it is imported, so a gallery with nothing in it is never copied. To rebuild one, delete the
MediaCMS category and its row in Migration Records, then re-import.

<a name="roles"></a>

### Roles

The **Global role mapping** tab lists the roles your portal actually has, fetched live from
Kaltura, next to what each one should become in MediaCMS. Kaltura's own internal roles are
hidden, since nobody is assigned them on purpose. The defaults are:

| Kaltura role | MediaCMS |
| --- | --- |
| Content Moderator | Editor |
| Content Uploader, Player Designer | Manager |
| Manager, Publisher Administrator | Super user and staff |
| anything not listed | Plain user |

Rows are matched on the role id, which is exact within a partner, and fall back to the name.
Change any of them before you start; the mapping is saved with the migration, so two
migrations from two portals can map the same role name differently.

A role is applied **only to accounts the migration creates**. A reused account keeps whatever
permissions it already had, so a re-run never re-grants or resets a role on a real person.
Note that **Super user and staff** really does mean Django superuser: check the table before
starting rather than after.

<a name="permissions"></a>

### Permissions

Kaltura entries carry no public or private flag of their own. What decides visibility is the
categories an entry is published through, and MediaCMS derives its own state from those. The
category type is not a field either: it comes out of `privacy`, `appearInList` and
`contributionPolicy` read together, so a channel *named* Restricted may well be configured as
Public. The fields decide, not the name.

| KMS channel type | MediaCMS category | Media state |
| --- | --- | --- |
| Public, Open | plain | public |
| Public, Restricted | plain | public |
| Open | plain | unlisted |
| Restricted | plain | private |
| Private | RBAC category with a group | private, visible to the group |
| Shared Repository | RBAC category with a group | private, visible to the group |

An entry in more than one category takes the most permissive of them, which is how Kaltura
behaves too. An entry in no category at all is private. Two things override all of this:
`displayInSearch` set to none downgrades public to unlisted, and an entry that has not
cleared moderation is private wherever it sits, because it was not published on the source
either. An entry still awaiting approval inside a moderated category does not inherit that
category's state.

Two things about this mapping are worth knowing before you run it.

**Open becomes unlisted, which is a downgrade in one direction and not in the other.** Open
in Kaltura means any logged in user may watch. MediaCMS has no such state: it has public,
unlisted and private. Unlisted is the closest fit, and on a portal where
`GLOBAL_LOGIN_REQUIRED` is off it is reachable by anyone holding the link. If that matters
for your content, turn **Preserve publish state** off and set the states yourself, or set
`GLOBAL_LOGIN_REQUIRED = True`.

**Restricted drops its member list.** Restricted membership in Kaltura is about who may
publish into the category, not who may watch it, so there is nothing to gate viewing with.
The category comes over as a plain one and its media come over private, owned by whoever
owned them in Kaltura.

Private categories are the ones that get a group, and only when `USE_RBAC = True`. For each
one the migration creates an RBAC group, marks the MediaCMS category as an RBAC category and
attaches the group to it, then adds the members Kaltura reports:

| Kaltura permission level | MediaCMS role |
| --- | --- |
| Manager | manager |
| Moderator | contributor |
| Contributor | contributor |
| Member | member |

Kaltura's fifth level, `NONE`, is not a membership and is dropped. The category owner is
added as a manager whether or not Kaltura lists them as a member, and a membership request
that is still pending is not access, so it is not carried over. Members get accounts even
when **Migrate all users** is off, because a membership pointing at no account is worth
nothing.

**Users are attached to the group, not to the category.** MediaCMS has no user to category
link at all. The chain is `RBACMembership(user, group, role)`, then the group's `categories`,
then the category, and every access check joins across it. So a member reaches the media one
hop away, through the group. For the three category types that get no group, no user is
associated with anything: the only user on that media is its owner.

What each role then allows inside that category:

| MediaCMS role | What it allows |
| --- | --- |
| member | View every media in the category, whatever state the media itself is in. |
| contributor | The above, plus editing media and putting new media into the category. |
| manager | The above, plus owner level access to **every** media in the category, not only their own. |

This is why the media can stay `private` and still be watchable by the right people. The
state is not what opens it, the group is: a member passes `has_member_access_to_media` and a
stranger does not. An RBAC category is also hidden from the public category listing, so it
does not advertise itself to people outside the group.

The group is keyed on the source installation and the category id together, so a re-run, or a
second migration of the same portal, finds the group that already exists instead of building
a parallel one. Memberships are added, never changed or removed. If someone's Kaltura
permission level changes and you run the migration again, the MediaCMS membership stays as it
was, on purpose: access granted or adjusted inside MediaCMS is not the migration's to
overwrite on a later run. Change it in the admin, or delete the membership and re-import.

With `USE_RBAC = False` the private categories are still created and their media still land
private, so nothing is exposed. It is only the member lists that have nowhere to go, and the
migration log says so.

**Shared Repository needs no special handling.** It is a channel type like the others, and
its viewing rule is members only, so it arrives as a members-only category and lands on
private with a group, exactly like a Private channel. What does not come across is the thing
that makes it a repository: content in it may be published onward into other channels, and
that publishing entitlement has no MediaCMS equivalent. The content itself is unaffected. An
entry that was already published into other channels belongs to those categories too, and
takes the most permissive state among them, so a repository item published to a public
channel still arrives public.

**Note on the two Public variants.** `contributionPolicy` says who may add content, not who
may watch it, so it never makes a category less visible than its privacy allows. This matters
for the type KMS calls Public, Restricted: anyone including anonymous users may watch it while
only members may contribute. It maps to public, the same as Public, Open. Only in the
authenticated tier does the members-only setting narrow things, because there the difference
between a listed channel and a members-only one is a real access difference.

## Skipping transcoding

With this on, MediaCMS re-encodes nothing. The source flavor becomes the original file and
each transcoded flavor is attached as an `Encoding` on the closest **active** MediaCMS
profile. HLS is packaged once per media afterwards, as for a normal upload. If the account has
purged its source flavors, the tallest available one is used instead and this is logged.

**Kaltura flavors are the same idea as MediaCMS encoding profiles**, the set of transcoded
versions a video is offered in, and this option only goes as well as the two ladders line up.
So check `/admin/files/encodeprofile/` first:

* The profiles you want must be **active**. Inactive ones are never considered, so a portal
  with 1080p disabled gains no 1080p encodings, and a flavor with no active profile near its
  size is skipped with that resolution simply missing.
* Line the profiles up with the flavors your Kaltura produces. A flavor goes to the closest
  active profile by height, and only when the two are within a size ratio of each other, so a
  576 tall flavor lands on the 480 profile while nothing lands far from its real size.
* Kaltura ladders are often not the round numbers MediaCMS ships with. Real ones include
  480x272 and 1024x576.

**Adding a brand new encoding profile takes real work.** Creating it in the Django admin is
the easy half, the video player also has to know about the resolution, so budget for a code
change rather than a form entry.

Images have no flavors in Kaltura, so their file comes from the entry itself.

## Pausing, resuming and running again

Media are handled ten at a time, so a pause takes effect within a few items.

* **Pause** stops after the items in flight and keeps the resume position.
* **Resume** continues from there.
* **Abort** stops for good, keeping what was imported and the position, so it can still be
  restarted.
* **Run again**, on a finished migration, sweeps the source once more.

Media are walked in creation order rather than by page number, because Kaltura refuses to page
past ten thousand rows. The migration remembers the last creation time it reached and the ids
already handled at that exact time, and that position is the resume point, which is why pause
and resume land in the right place.

Nothing is imported twice. Every migrated object is written to the mapping table, and each
item checks it before anything is downloaded, both for this migration and for any other
pointing at the same source. Skipping costs one database lookup and no call to Kaltura. Failed
items are the exception and are retried, along with anything added at the source since.

## Monitoring

`/migrations/<id>` shows counts per object type, a live log refreshing every five seconds, and
the ID mapping table of source ID, MediaCMS ID, status and time. The same rows are in the
Django admin under Migration Records, where they can be searched and exported. Because the
mapping is stored rather than derived, a run can be watched live, verified afterwards and
rerun safely.

## Troubleshooting

**"Fallback user 'admin' does not exist".** Set an existing username as the fallback owner.

**Media imported but not visible.** Check the publish state option and the entry's Kaltura
categories. Entries in no category become private by design.

**Encodings missing.** The portal's active encoding profiles decide what can be attached.
Check `/admin/files/encodeprofile/`.

**Stuck in running.** Look at Last activity on the list page. If it has gone stale the usual
cause is a worker that died mid page, leaving the migration marked running with nothing
queued. Pause, then Resume: replaying a page is safe because every importer checks the mapping
table before writing.
