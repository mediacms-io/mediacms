# Video previews: sample the whole video, and stop shipping GIFs

## The preview today

One `EncodeProfile` (pk 1, `name: preview`, `extension: gif`, `resolution: null`,
`codec: null`) is encoded through a special case in `files/tasks.py:316`:

```
ffmpeg -y -ss 3 -i <source> -vf "scale=344:-1:flags=lanczos,fps=1" -t 25 -f gif
```

`post_encode_actions` copies the result onto `Media.preview_file_path`, and the listing
page swaps it for the thumbnail on hover (`ListItem.jsx`, via `item.preview_url`).

Four problems, in order of how much they cost a viewer:

1. **It only ever shows seconds 3 to 28.** On anything longer than half a minute the
   preview is the title card and someone sitting down. It says nothing about the video.
2. **`fps=1` is a slideshow**, not motion.
3. **GIF is the wrong container.** 256 colours, no palette pass, and very large. A real
   preview on this installation is 1.7 MB for 25 frames at 344px wide.
4. **`-ss 3` on a video shorter than 3 seconds produces nothing.** There is no guard.

## What replaces it

Six one-second clips taken at 8%, 23%, 38%, 53%, 68% and 83% of the duration,
concatenated into one muted MP4 at 12 fps, 320px wide.

Measured on a 27 second video from this installation:

| | bytes |
| --- | --- |
| today: GIF, 1 fps, seconds 3-28 only | 509,397 |
| proposed: muted MP4, 12 fps, six moments across the whole video | **59,302** |
| animated WebP, same content | 210,500 |

**8.6 times smaller, while showing six parts of the video instead of one, at twelve times
the frame rate.** On a listing of 24 items that is 1.4 MB instead of 12 MB.

WebP is the obvious alternative and is rejected here: it measured 3.5 times larger than
MP4, and `webp` is not in `ENCODE_EXTENSIONS`, so it would also cost a choices migration.
A muted looping `<video>` is what YouTube serves to desktop browsers anyway.

Two ffmpeg passes: each segment is cut with `-ss <t> -t 1` and re-encoded to a common
format, then the segments are joined with the concat demuxer. Videos too short to sample
six distinct moments fall back to a single segment from the start, which is what makes
problem 4 go away.

## Coexistence: old GIFs and new MP4s, both working

The requirement is that existing previews are never regenerated and never break. That is
achievable, and the work is entirely in **how a preview profile is recognised**.

### The rule

Six places in the codebase currently ask `profile.extension == "gif"` to mean "this is the
preview". That conflates the *role* with the *format*, which is exactly what breaks when
the format changes. Every one of them changes to ask about the **name** instead:

| file:line | today | becomes |
| --- | --- | --- |
| `tasks.py:316` | `profile.extension == "gif"` | `profile.name == "preview"` |
| `media.py:613` | chunkize: encode the preview whole | same, keyed on name |
| `media.py:626` | the counterpart test | same, keyed on name |
| `media.py:653` | sets `preview_file_path` | same, keyed on name |
| `media.py:739` | skips the preview in `encodings_info` | same, keyed on name |
| `media.py:905` | `preview_url` fallback lookup | `filter(profile__name="preview")` |

Both the old GIF profile and the new MP4 profile are named `preview`, so every one of
these tests is true for both, forever, with no list of formats to maintain.

Two rows sharing a name is safe here, and both halves were checked rather than assumed:
`EncodeProfile.name` carries no unique constraint, and no code anywhere looks a profile up
by name - every lookup is by id, or a filter on `active` and `extension` - so there is no
`MultipleObjectsReturned` waiting to happen.

### Why `media.py:739` is not optional

`encodings_info` pre-seeds its result with `ENCODE_RESOLUTIONS_KEYS` and then does
`ret[resolution][codec] = enc`. The preview profile has `resolution = null`. It is skipped
today *because its extension is gif*. Give the new profile `extension: mp4` without
re-keying that test and it stops being skipped: `ret[None]` raises `KeyError` inside a
property the media serializer reads, and the media detail API returns 500 for every video
that has a preview. This is the one change that fails loudly rather than quietly.

### The new profile row

`name: preview`, `extension: mp4`, `resolution: null`, `codec: null`, `active: true`, at
pk 24 or above (the shipped fixture occupies 1 to 23).

`resolution` and `codec` must stay null. `files/tasks.py:114` filters
`resolution__lte=media.video_height`, which excludes nulls in SQL, and `create_hls` filters
`profile__codec="h264"`; a preview with either field populated would be picked up as a real
rendition and offered as a download.

### The old profile row

pk 1 is set `active: false` and otherwise left exactly as it is. That stops new GIFs
without touching a single existing one:

- `Media.encode()` selects `EncodeProfile.objects.filter(active=True)`, so an inactive
  profile is never encoded again.
- Nothing anywhere deletes encodings by `profile.active`. Files are removed only by
  `Encoding`'s `post_delete` receiver, which fires when a row is deleted.
- `encode()` deletes only encodings *of the same profile*
  (`filter(media=media, profile=profile)`), so encoding a new preview cannot touch an old
  GIF row.
- `Media.preview_file_path` is a plain string that nothing rewrites.

pk 1 is **not** edited in place. Relabelling it `mp4` would tell every existing GIF
encoding that it is an MP4 while the file on disk is still a GIF, which is the `KeyError`
above plus a corrupt download list.

### Serving both

`preview_url` resolves for either format once the lookup is keyed on name. The frontend
branches on the file extension: `.gif` renders as today's `<img>`, anything else as
`<video autoplay muted loop playsinline>`. One test on the URL suffix in `ListItem.jsx`
supports a permanently mixed library, which is the expected end state since existing
previews are never regenerated.

## Rollout

**Fresh installs** get the new row from `fixtures/encoding_profiles.json`, which
`prestart.sh` loads when no user exists.

**Existing installs never re-run loaddata** - `prestart.sh` skips it once any user exists -
so the fixture alone would leave them making GIFs forever. They need a **data migration**
that does `get_or_create` on the new profile and sets pk 1 inactive. The migration is the
mechanism; the fixture keeps fresh installs consistent with it.

The data migration must be written so that a site which has already added its own profile
at that pk is not disturbed: match on `name` and `extension`, not on pk.

## The existing test suite

`tests/test_fixtures.py::test_encodeprofile_fixtures` asserts the shipped profile counts:

```python
self.assertEqual(profiles.count(), 23)                          # total
self.assertEqual(EncodeProfile.objects.filter(active=True).count(), 7)
```

The total becomes **24** and must be updated with the fixture. The active count stays at
**7**: pk 1 goes inactive and the new row comes in active, so they cancel out. A test that
still expects 7 active passing is therefore not evidence that the change landed - the
total is the one that proves it.

## Testing

- A preview profile is recognised by name for both `gif` and `mp4` rows: the six call
  sites, most importantly that `encodings_info` skips both and never raises.
- `preview_url` returns a URL for a media whose only preview is a legacy GIF encoding,
  and for one whose only preview is an MP4.
- A media with a legacy GIF preview keeps it after a new encode runs: the row still
  exists, the file still exists, `preview_file_path` is unchanged.
- Deactivating pk 1 removes it from `Media.encode()`'s profile set and deletes nothing.
- The preview is excluded from `encodings_info`, so it never appears as a download.
- Sampling: a long video produces six segments from across its duration; a video shorter
  than the sampling window produces one segment and no error; a video shorter than three
  seconds produces a preview rather than nothing.

## Not doing

- **Regenerating existing previews.** Explicitly out of scope. The mixed library is
  permanent and supported.
- **WebP.** Larger than MP4 here, and needs a choices migration.
- **Sharing the decode with sprites.** `produce_sprite_from_video` already walks the whole
  file, and the preview walks it again; one pass could feed both. Worth doing, but it
  couples two independent features and belongs in its own change.
