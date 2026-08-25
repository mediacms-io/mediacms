# YouTube migration

MediaCMS can pull video in from YouTube: the file, the title, the description, the tags, and
an English subtitle if the video has one. Give it video urls, a playlist or a channel and it
fetches them.

Only superusers can see or use it. The entry point is **Migrations** in the top right menu.

This is not like the Kaltura migration and does not try to be. There is no account to sign in
to, no catalogue of users and categories to walk, and nothing to recreate. A YouTube migration
is a list of things to fetch and one MediaCMS user to give them to.

## What it needs installed

yt-dlp, which does all the work of resolving urls and fetching files:

```bash
pip install -r requirements.txt
```

It is pinned like everything else. **Expect to upgrade it.** YouTube changes how its pages
work every few weeks, and when it does, yt-dlp stops being able to read them until a new
release lands. A migration that suddenly fails with an extraction error is almost always that,
not a bug here:

```bash
pip install -U yt-dlp
```

ffmpeg is already required by MediaCMS for everything else it does, and yt-dlp uses the same
binary.

## Setting one up

1. Go to `/migrations`, press **New migration** and pick YouTube.
2. Paste what you want, one per line, into **Videos, playlists or channels**:

```
https://www.youtube.com/watch?v=aqz-KE-bpKQ
aqz-KE-bpKQ
https://www.youtube.com/playlist?list=PL6B3937A5D230E335
https://www.youtube.com/@BlenderOfficial/videos
```

A bare video id works. A playlist or a channel is expanded to the videos in it, in the order
it lists them, and a video named twice is fetched once.

3. Press **Test connection**. It resolves each line and reports how many videos it found,
   without downloading anything.
4. Set the owner and the options.
5. **Save and start migration**, or schedule it for later on the **Migration scheduling** tab.

## Private video

Public video needs no credentials at all, and the **Cookies file contents** field can stay
empty.

For members-only, unlisted or age-gated video, export a `cookies.txt` from a browser signed in
to an account that can watch it, and paste the contents in. It is encrypted at rest with a key
derived from `SECRET_KEY` and the API never returns it, the same as any other stored secret.

Cookies expire, and there is nothing here that can tell you they have. A migration that worked
last month and now cannot see your video usually needs a fresh export.

## Options

| Option | Default | Effect |
| --- | --- | --- |
| Owner | `admin` | Every imported video is given to this existing MediaCMS user. |
| Import captions | on | The English subtitle, if the video has one. |
| Preserve views | **off** | Copy the YouTube view count onto the imported video. |
| Attempt to skip transcoding | on | Fetch one rendition per encoding profile and file them as they are, instead of re-encoding. See [Renditions](#renditions). |

**Uploader names do not become accounts.** A channel is not a person on your portal, and
inventing one user per YouTube uploader would leave you with accounts nobody can sign in to. So
everything a migration brings in belongs to the one owner you pick.

**Captions are English only.** YouTube offers automatically generated captions in over 150
languages, and taking them would attach 150 subtitle rows to every video while saying nothing
the video does not already say. Only a subtitle the uploader actually provided is taken, and
only `en`.

**Nothing else is copied.** No thumbnail, because MediaCMS makes its own, along with the
sprites and the hover preview. No upload date, no licence, no category, no channel name.

## Where the file comes from

**YouTube never serves the uploader's original.** It serves its own transcodes and nothing
else, so a video imported from YouTube is a re-encode by definition. What lands in MediaCMS as
the original file is the best rendition YouTube would give us, not the master.

It also does not serve a file with video and audio in it. Every stream is one or the other, so
a playable file is always two joined together. yt-dlp does that with ffmpeg, which is a
container change rather than a re-encode, so it costs bandwidth and almost no processing.

## Renditions

With **Attempt to skip transcoding** on, one rendition is fetched for each encoding profile
your portal has. YouTube already holds an h264 stream at those sizes, so fetching one is
cheaper than encoding it, and nothing is transcoded at all. A portal with the usual six
profiles gets something like:

```
720 filed as h264-720     360 filed as h264-360     144 filed as h264-144
480 filed as h264-480     240 filed as h264-240
```

The lower renditions are small, so a whole ladder costs roughly a third more bandwidth than
the top one on its own.

Which streams get picked matters. YouTube offers its best quality in VP9 and AV1, which this
portal's profiles and its player are not built around, so the migration asks for **h264 in
mp4**. The cost is a ceiling: above roughly 1080p only the newer codecs are offered, so a 4K
source arrives at its best h264 size and no higher.

Turn the option off to fetch only the best stream and have MediaCMS encode its own ladder from
it. You get the same profiles, at the cost of the encoding time.

## How a rendition is labelled

Sizes are read as the **short side**, so `1280x720` and `720x1280` are both 720. A vertical
video ladders exactly as a landscape one does, and reading its height instead would file a 720
as a 1080 and then skip its best stream for being too tall.

Each fetched file is filed under the nearest profile **at or below** its size, never above. An
818p file is labelled 720p.

That is deliberate. A file is allowed to be better than its label and never worse, and the HLS
quality menu snaps the same way, so the download list and the player agree on one number. Odd
sizes like 818p come from sources that are not 16:9; an ordinary upload matches a profile
exactly and the question does not arise.

Two streams that round to the same profile produce one rendition, not two. If nothing is at or
below your smallest profile there is nothing to file it under, and MediaCMS encodes the video
instead, with a line in the migration log saying so.

## The hover preview

Skipping transcoding skips the step that would normally produce the small preview that plays
when you hover a video, because MediaCMS makes that as one of its encoding profiles. So it is
asked for on its own after an import, and an imported video gets a preview like any other.
Sprites and HLS were never affected.

## Adding encoding profiles later

Pairing happens when a video is imported, against whatever profiles exist at that moment. Add a
profile and then run a migration and it is used automatically. Add one afterwards and nothing
changes for video already imported, which is how MediaCMS behaves for ordinary uploads too.

## Re-running

A video already imported is skipped, recognised by its YouTube id. So a migration can be run
again to pick up whatever was added to a playlist or a channel since, without re-fetching
anything. That holds across migrations as well: all YouTube migrations share one source
identity, so two of them pointed at overlapping playlists will not import the same video twice.

## One thing to be aware of

Downloading from YouTube is at odds with their terms of service unless the video is yours or
its licence allows it. Moving your own channel onto your own portal is the case this was built
for. What you point it at is your call to make.
