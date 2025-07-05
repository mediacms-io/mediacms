# Transcoding in MediaCMS

MediaCMS uses FFmpeg for transcoding media files. Most of the transcoding settings and configurations are defined in `files/helpers.py`.

## Configuration Options

Several transcoding parameters can be customized in `cms/settings.py`:

### FFmpeg Preset

The default FFmpeg preset is set to "medium". This setting controls the encoding speed and compression efficiency trade-off.

```python
# ffmpeg options
FFMPEG_DEFAULT_PRESET = "medium" # see https://trac.ffmpeg.org/wiki/Encode/H.264
```

Available presets include:
- ultrafast
- superfast
- veryfast
- faster
- fast
- medium (default)
- slow
- slower
- veryslow

Faster presets result in larger file sizes for the same quality, while slower presets provide better compression but take longer to encode.

### Other Transcoding Settings

Additional transcoding settings in `settings.py` include:

- `FFMPEG_COMMAND`: Path to the FFmpeg executable
- `FFPROBE_COMMAND`: Path to the FFprobe executable
- `DO_NOT_TRANSCODE_VIDEO`: If set to True, only the original video is shown without transcoding
- `CHUNKIZE_VIDEO_DURATION`: For videos longer than this duration (in seconds), they get split into chunks and encoded independently
- `VIDEO_CHUNKS_DURATION`: Duration of each chunk (must be smaller than CHUNKIZE_VIDEO_DURATION)
- `MINIMUM_RESOLUTIONS_TO_ENCODE`: Always encode these resolutions, even if upscaling is required

## Advanced Configuration

For more advanced transcoding settings, you may need to modify the following in `files/helpers.py`:

- Video bitrates for different codecs and resolutions
- Audio encoders and bitrates
- CRF (Constant Rate Factor) values
- Keyframe settings
- Encoding parameters for different codecs (H.264, H.265, VP9)
