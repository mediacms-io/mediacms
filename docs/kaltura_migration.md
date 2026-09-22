# Kaltura migration

MediaCMS can copy a Kaltura portal into itself: the media files, the people who own them,
the galleries, channels and course spaces they sit in, and the captions. You start it, watch
it, pause it when you want the machine back, and run it again later to pick up whatever was
added since or whatever failed.

Only superusers can see or use it. The entry point is **Migrations** in the top right menu.

## What comes over

* Video, audio and image entries, with the original file and optionally the transcoded
  versions Kaltura already made.
* Captions, converted to WebVTT.
* Owners. An account is created for whoever owns an entry, or an existing account is reused
  when one matches.
* Galleries and channels, as flat MediaCMS categories, each keeping its Kaltura id. Course
  channels from an LMS integration come over the same way, titled by their course name rather
  than by the LMS course id. See [Sites and learning platforms](#sites-and-learning-platforms).
* Play counts, and whether the item is public, unlisted or private.
* Category members and their permission level, when RBAC is turned on. See
  [Permissions](#permissions).
* Playlists, in order, when **Migrate playlists** is on. See [Playlists](#playlists).

Skipped: Kaltura's plain text transcripts, which have no MediaCMS equivalent, dynamic
playlists, and live entries or anything else with no downloadable file.

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
   holds, loads the top level categories to choose from, and imports nothing.
4. Tick the categories to migrate, on the same tab. Test connection has just loaded them,
   and at least one is required.
5. Set the import options.
6. **Save draft**, or **Save and start** to begin. Nothing is imported until you start it.
7. Watch the migration page: progress, a live log, and the ID mapping table with links to both
   the Kaltura entry and the MediaCMS media.

Credentials are encrypted at rest with a key derived from `SECRET_KEY`, and the API never
returns a secret. The form shows a mask and keeps the stored value if you save without
retyping it. Test connection makes the server talk to whatever address is in the form, which
is one reason the feature is restricted to superusers.

## Import options

Every migration is different, so read these before starting rather than after.

| Option | Default | Effect |
| --- | --- | --- |
| Migrate all users | **chosen** | Every real account in the portal gets a MediaCMS account, whether or not it owns anything. |
| Only migrate below listed users | | Fetch only the media owned by the Kaltura user ids typed in the same box, and create those owners. |
| Only migrate users that own media | | Accounts are created as the media that belongs to them arrives. |
| Do not run between | off | On the Migration scheduling tab. Holds the run inside a window of hours and resumes it by itself. See [Quiet hours](#quiet-hours). |
| Run unpaused during weekends | off | On the Migration scheduling tab. The window above is ignored on Saturday and Sunday, portal timezone. |
| LTI platform for LMS courses | none | Links migrated LMS courses to a platform set up under **MediaCMS Admin → LTI 1.3 Integration → LTI Platforms**, so they stay in step with the LMS. Needs `USE_LTI`. See [Sites and learning platforms](#sites-and-learning-platforms). |
| Add entries in sub-categories to parent categories | on | A KMS category shows the content of its sub-categories; MediaCMS categories are flat, so this adds it. See [Flat categories](#flat-categories). |
| Migrate playlists | off | Static playlists become MediaCMS playlists, in order, fetching any media they name and creating its owners, whatever the user options say. Dynamic playlists are skipped. See [Playlists](#playlists). |
| Migrate groups | off | Kaltura groups become MediaCMS RBAC groups, and their members are created whatever the user options say. Their media is not fetched: that follows the user options. Needs `USE_RBAC`. See [Groups](#groups). |
| Import captions | on | Caption assets become WebVTT subtitles. One that fails to convert is recorded as failed and the media keeps the rest. Plain text transcripts have no equivalent and are only logged. |
| Import statistics (Plays/Views) | on | Copy play counts onto the migrated media. |
| Maintain publish state of media | on | Derive public, unlisted or private from the source. Unmoderated media stays private. See [Permissions](#permissions). |
| Migrate media flavors / encodings | on | Import existing Kaltura flavors as MediaCMS encodings instead of re-encoding. Off imports the original file only and MediaCMS encodes it. |
| Categories | **required** | On the Connection tab, loaded by Test connection. Fetch only the media in the chosen top level categories, and everything beneath them. At least one is required. |

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

The three user options are one question with three answers — sweep the whole directory, name
the users to fetch, or create an owner as their media arrives — so choosing one clears the
others and one is always chosen.

**There is no fallback owner to set.** A media whose owner cannot be resolved, because the
Kaltura account is gone or importing it failed, still needs somewhere to go: it goes to
whoever set the migration up, and to an administrator if that account no longer exists.
`fallback_username` is not a Kaltura option at all any more; a migration saved while it was
one has the value dropped on its next save.

With **Migrate all users** off, only people who own media get an account. The exception is the members of a private category, who are created
regardless: see [Permissions](#permissions). Roles are covered under
[Roles](#roles).

### Migrating only some categories

Every migration is scoped to what you choose. There is no "migrate everything" switch,
because there is no sensible case for pointing a migration at an entire Kaltura account and
hoping, and a migration nobody has scoped would sweep the lot by accident.

**The categories you pick do not decide which media comes over.** That follows the owners,
under [Import options](#import-options): every user's media by default, or only the listed
users' media when you name them. Every entry has exactly one owner, so that is the axis that
actually partitions a library, while a great many entries belong to no category at all and no
category filter can reach them.

What the picker decides is **which categories exist**, and which of them a media may be filed
under. An entry that also sits in a tree you did not pick keeps its media and loses only that
filing.

The picker lives on the **Connection** tab, because what you can choose depends on the
connection working first. Press **Test connection**: when it succeeds it loads the list, and
you tick what you want. **Reload categories** fetches it again if the source has changed since.

Only **top level** categories are offered. A top level category is a whole site, and ticking
one brings every category and every media beneath it, so listing the levels below would ask
the same question again in more places and would be unusable on a portal with thousands of
channels.

**At least one has to be ticked.** Save draft and Save and start are both refused until then,
in the form and again on the server.

An entry that belongs to no category arrives **private**, since the source published it
nowhere. On the portal this was built against that is 17 of 74 entries, so expect a number of
them.

**Test connection** reports what the run would bring: users, media, categories, channels and
groups. Captions are not counted there. Kaltura refuses to list caption assets without an
entry id, so a caption total means fetching every entry id first and batching through them,
which is a hundred extra calls before a large run has started. They are counted as the run
discovers them instead, which is why the progress page shows captions without a denominator. Existing migrations saved before this carry a retired
`migrate_all_categories` option, which is dropped the next time they are saved.

The count shown is for the whole subtree. Kaltura's own `entriesCount` on a root counts direct
members only, and a root has none, so it would report zero for a site holding thousands.

The roots themselves do not become MediaCMS categories. A root with a `>site>` child is the
handle for a KMS site or an LMS integration, often named something like `ltigeneric_8yrU6`,
and turning it into a category would just wrap everything in a box named after the plumbing.
A top level category on an ordinary portal has no `>site>` child and is kept, because there it
is real content.

<a name="playlists"></a>

### Playlists

A Kaltura playlist carries its members as an ordered list of entry ids, which is exactly the
shape MediaCMS wants, so the order survives the trip. Playlists are imported **after** media,
since one can only point at media the run has already brought over.

Two kinds are left out. A **dynamic** playlist is a saved query rather than a list, and has no
MediaCMS equivalent: snapshotting one would leave a playlist called "Most recent videos"
frozen on whatever today happened to be. And KMS keeps a playlist per channel under an
internal account, which is plumbing nobody would recognise. On the portal this was built
against, that leaves 4 of 10 playlists worth migrating.

**A playlist can name media the run never fetched**, because the user options narrowed it or
because the playlist crosses into someone else's content. Those are fetched on the playlist's
account and their owners created: asking for playlists is asking for whole playlists, and a
list with holes in it is worse than an import that reached a little wider than asked.

Be aware of what that means. Switching playlists on fetches media owned by people outside
**Only migrate below listed users**, and creates those people as users, or gives their media
to the fallback owner if that is how the run is configured. It is the one option that
deliberately reaches past the others.

Media pulled in this way is treated exactly like any other: the same state rules, and the same
rule that it may only be filed under categories inside the chosen roots. An item whose
categories all sit outside them gets none, and media in no category arrives **private**. So a
playlist can legitimately contain items only their owner can see.

Finally, playlists outlive their contents. A Kaltura playlist may name entries the source no
longer holds at all, and nothing can rescue those: they are skipped and listed in the
migration log, leaving a shorter playlist. The log says which of the two reasons applied.

<a name="groups"></a>

### Groups and service accounts

A Kaltura "user" is not always a person. Two kinds are filtered out of the user sweep.

**Groups.** A group is a user with `type` GROUP, and without the filter it arrives as an
account named after the group that nobody can log into. The sweep now asks for `typeIn=0`,
so only people come through. Checked against a live portal, since Kaltura ignores a filter
field it does not support: 28 users unfiltered, 27 with `typeIn=0`, 1 with `typeIn=1`.

Switch **Migrate groups** on and those groups become MediaCMS RBAC groups instead, keeping
who is in them. Kaltura's group roles map straight across, MANAGER to manager and MEMBER to
member. It needs `USE_RBAC`; with RBAC off each group is recorded as skipped with the reason,
rather than disappearing quietly.

Worth knowing before switching it on: **a group grants nothing on its own.** An RBAC group
gives access to the categories attached to it, and a Kaltura group carries no categories, so
what arrives is a membership list waiting to be pointed at something. That is still worth
having, since rebuilding one by hand is the tedious work a migration is for, but it is not
access control until somebody attaches it to a category.

Where a group *is* a member of a category, the migration expands it into the people it stands
for, each taking the permission level the group was given. Importing it as a person would
otherwise create an account named after the group.

**Service accounts.** Kaltura and KMS create accounts for their own plumbing:
`__kms_logo_upload_user__`, `__kmsInternalChannelPlaylistUser__`, `__kms_config_upload_user__`,
`kmsAdminServiceUser`, `kmsSaaSAdmin_*`, `Guest`, and a user literally called `0`. Sweeping
every user turns each one into a MediaCMS account. They are matched on the id, by the double
underscore wrapping Kaltura uses for its own accounts plus a short list of fixed KMS names,
and left out of the sweep.

**They are only left out of the sweep.** A service account that owns media still gets an
account when that media arrives, so nothing is orphaned. On the portal this was checked
against, `__kms_logo_upload_user__` owns one entry and keeps it.

<a name="sites-and-learning-platforms"></a>

### Sites and learning platforms

A portal usually holds more than one tree: the MediaSpace site, and one per LMS integration
that has been wired up. They behave differently and the migration works out which is which on
its own, from `privacyContexts`.

That field is Kaltura's own switch for this. Privacy and entitlement settings only take effect
inside a privacy context. KMS stamps one on its site, the LTI integrations create their
categories without one, and the field is inherited, so it reads the same on a course channel
as on the root it hangs from.

| | KMS site | LMS tree |
| --- | --- | --- |
| `privacyContexts` | set, e.g. `MediaSpace` | empty |
| Category permissions | honoured, see [Permissions](#permissions) | none to honour |
| Media state | from the category type | public |

The consequence worth understanding: **the permission fields on an LMS category do nothing at
the source.** Kaltura serves that content to anyone regardless of what `privacy` says, because
there is no privacy context for it to enforce. So the migration reads those categories as
public rather than importing a restriction that was never in force, which would hide media the
source was showing and hand out RBAC groups gating something nobody gated. A payload with no
`privacyContexts` field at all is read as KMS, the cautious direction.

An LMS integration also does not put a course's media in the course channel. It creates a
child named **InContext** and parks the media there, leaving the course itself empty. That
child is plumbing nobody browses, so no category is made for it and its media is rolled up to
the course, which is the category a person recognises. Only in an LMS tree: a KMS gallery that
somebody named InContext is a real category and is kept.

**Course names.** An LTI integration names the course channel after the LMS course id, so
the category is called `14` and nothing on the category says otherwise. The readable name is
in the custom metadata Kaltura keeps beside it, under a `CourseName` key, and that is what
the migrated category is titled. Without the metadata plugin, or without that key, the id
stays as the title and the import carries on.

Read per category, for LMS trees only. A course already imported under its id keeps that
title; rename it on the category edit page rather than importing it twice.

### Category identity

A migrated category takes the **Kaltura category id as its `uid`**, so the id in a MediaCMS
category URL is the one you can paste back into Kaltura. That id is also how a category is
recognised on a later run: one already carrying it is this same category and is reused rather
than duplicated, even if the migration's own mapping row has been deleted.

The `uid` column is unique across the portal, and two Kaltura installations number their
categories from the same pool, so an id already held by a category with a different title is
taken to be something else, a second portal or a category made by hand. That one keeps its
`uid` and the import takes a suffixed one rather than failing.

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

Every category beneath a chosen one is created, including galleries holding nothing. To
rebuild one, delete the MediaCMS category and its row in Migration Records, then re-import.

<a name="roles"></a>

### Roles

The **Global role mapping** tab lists the roles your portal actually has, fetched live from
Kaltura, next to what each one should become in MediaCMS. Kaltura's own internal roles are
hidden: a role tagged `kmc` or `kms` is always offered, an untagged one is judged by its
system name. The defaults are:

| Kaltura role | MediaCMS |
| --- | --- |
| Content Moderator (KMC) | Editor |
| Content Uploader (KMC), Player Designer (KMC) | Manager |
| Manager (KMC), Publisher Administrator (KMC) | Super user and staff |
| `adminRole` | Advanced user |
| `unmoderatedAdminRole` | Editor |
| `viewerRole`, `privateOnlyRole`, `unconfirmedViewerRole` | Plain user |
| anything not listed | Plain user |

The `(KMC)` label marks the rows that are roles defined in the Kaltura Management Console.
It is only a label: a portal reports the bare name, and the match ignores anything in
trailing brackets, so `Manager (KMC)` still matches a role the portal calls `Manager`.

**Where the role is read from.** A console role first: `user.get` returns `roleIds`, and the
first is looked up in `userRole.list` for its `systemName`, or its `name`. A user with no
console role gets their MediaSpace role instead, read from the KMS user schema metadata:

```
metadata_metadata.list  filter:metadataObjectTypeEqual=3  filter:objectIdEqual=<user id>
→ <metadata><role>adminRole</role></metadata>
```

Only the object type is pinned. Adding `metadataProfileIdEqual` returns nothing, and the
profile differs per KMS instance anyway.

**The five lowercase rows** are MediaSpace's own roles, the ones its admin offers on every
instance. They are a fixed list rather than something a portal defines, so they are listed
rather than fetched and **Load roles from the source** leaves them on the table.

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

Two of those fields restrict a category, and they restrict different things. `privacy`
("Content Privacy") says who may view the content. `appearInList` ("Category Listing") says
who may see the category at all, which KMS describes as *visible only to users with specific
permissions to access this category content*. Either one being set to anything other than
"No Restriction" means Kaltura has named the people who belong there, so the category becomes
an RBAC category and those people become its group. The media state is a separate question,
answered by `privacy` alone.

| Content Privacy | Category Listing | MediaCMS category | Media state |
| --- | --- | --- | --- |
| No Restriction | No Restriction | plain | public |
| No Restriction | Private | RBAC category with a group | public |
| Requires Authentication | No Restriction | RBAC category with a group | unlisted |
| Requires Authentication | Private | RBAC category with a group | private |
| Private | either | RBAC category with a group | private, visible to the group |
| Shared Repository | either | RBAC category with a group | private, visible to the group |

`contributionPolicy` ("Who can add content") is a publishing right, not a visibility one, so
it never makes a category less visible than its privacy says: KMS's "Public, Restricted"
means anyone may watch while only members may contribute, and that arrives public.

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
for your content, turn **Maintain publish state of media** off and set the states yourself, or set
`GLOBAL_LOGIN_REQUIRED = True`.

**Requires Authentication becomes a group holding the people Kaltura named**, the owner
among them, rather than a plain category. MediaCMS has no "any logged in user may view"
setting for a category, so the alternatives were to drop the restriction or to hand it to
somebody. It is handed to the owner, who can widen it from the group in the admin; a plain
category would have been the same decision made silently, and made wrong.

A category gets a group only when `USE_RBAC = True`. For each one the migration creates an
RBAC group, marks the MediaCMS category as an RBAC category and attaches the group to it,
then adds the members Kaltura reports:

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

The small preview that plays when you hover a video is made by MediaCMS as one of its encoding
profiles, so skipping transcoding would skip it too. It is asked for on its own after each
import instead, and an imported video gets a preview like any other. Sprites were never
affected.

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

### Multi-stream recordings

Kaltura Capture records the screen and the camera as **two entries** joined by
`parentEntryId`. A listing never returns the child, so without asking for it by name the
second stream is simply lost. Each entry is asked, one `baseEntry.list` call apiece.

When a child is found, the two are drawn as one video: the bigger picture is the base, the
other is inset over its bottom right corner at a quarter of the width. MediaCMS plays one
file per media, so one picture is what it has to be.

**Combining always re-encodes.** There is no stream copy that merges two pictures, so the
work has to happen somewhere, and **Skip transcoding** decides where:

| Skip transcoding | What happens | Ladder |
| --- | --- | --- |
| on | Every rung of the screen's ladder is drawn and attached as an encoding. MediaCMS transcodes nothing. | whatever Kaltura had |
| off | Only the originals are drawn, and MediaCMS builds its own ladder from that. | the portal's full ladder |

The camera is fetched **once** whatever the setting: it is drawn a quarter of the width, so
one modest flavor serves every rung.

Two limits worth knowing. Only two streams are combined; a third is logged and left behind,
because three pictures in one frame is not a recording anybody wants. And the audio is taken
from one stream only, the base's where it has any: both carry the same microphone, so mixing
them would play everything twice.

### Quiet hours

**Do not run between** holds the migration inside a window of your choosing and lets it carry
on by itself afterwards. Give it a start and an end in the portal's timezone, the same clock
the scheduled start uses. An end earlier than the start runs over midnight, so `22:00` to
`06:00` is a night window.

Nothing is paused. The migration stays running and simply does no work while it is inside the
window, looking again every five minutes, so it picks up on its own within five minutes of the
window closing. That matters: it needs no timer held anywhere, which is what a schedule
spanning weeks cannot rely on.

**Run unpaused during weekends** exempts Saturday and Sunday from that window, for a portal
whose quiet hours only mean anything on a working day.

Two things worth knowing. A page already in flight is finished rather than abandoned, so the
window takes effect at the next page and a large download in progress will run past the
boundary. And a window that says nothing lets the migration run: switched off, either end
unreadable, or both ends the same. A typo that quietly halts a month long run would be far
worse than one that fails to hold it back, so the form refuses a bad window outright rather
than storing one that does nothing.

### A scheduled start on a finished migration

Scheduling a migration that has already completed arms a **re-run** at that time, the same
sweep the **Run again** button does: what is imported is skipped, failures are retried and
anything new at the source is picked up. The status stays **Completed** until it fires, and
the row on the migrations list says when it is due.

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
