"""Helpers for the optional TwelveLabs (Pegasus) video analysis integration.

TwelveLabs Pegasus understands an entire video in a single pass, so one request
gives us a transcript, a description and a list of tags. This module keeps the
SDK call and the response parsing isolated from the Celery task so the parsing
can be unit tested without hitting the network.

See https://twelvelabs.io - there is a generous free tier.
"""
import json

# A strict prompt: we ask Pegasus to return only JSON so the response is easy to
# parse and store. WEBVTT is requested directly so the transcript can be saved
# as a subtitle file with no extra conversion step.
ANALYZE_PROMPT = (
    "Analyse this video and respond with ONLY a JSON object (no markdown, no code "
    "fences) with exactly these keys: "
    '"description" (a 2-3 sentence summary of the video), '
    '"tags" (an array of 5-10 short topic keywords), and '
    '"transcript" (the spoken content as a valid WEBVTT subtitle string, or an '
    "empty string if there is no speech)."
)


def analyze_media_file(api_key, model_name, file_path):
    """Upload ``file_path`` to TwelveLabs and run a Pegasus analysis on it.

    Returns the raw text the model produced. The SDK import is local so the
    dependency is only required when the integration is actually enabled.
    """
    from twelvelabs import TwelveLabs
    from twelvelabs.types.video_context import VideoContext_AssetId

    client = TwelveLabs(api_key=api_key)

    with open(file_path, "rb") as f:
        asset = client.assets.create(method="direct", file=f)

    response = client.analyze(
        model_name=model_name,
        video=VideoContext_AssetId(asset_id=asset.id),
        prompt=ANALYZE_PROMPT,
        max_tokens=2048,
    )
    return response.data


def parse_analysis(raw_text):
    """Parse the model's JSON answer into ``(description, tags, transcript)``.

    Pegasus is asked for raw JSON but can wrap it in a markdown code fence, so we
    strip that defensively. Returns sane empty defaults if parsing fails.
    """
    if not raw_text:
        return "", [], ""

    text = raw_text.strip()
    if text.startswith("```"):
        # drop the first fence line and any trailing fence
        text = text.split("\n", 1)[-1]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[: -len("```")]

    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        return "", [], ""

    description = (data.get("description") or "").strip()
    transcript = (data.get("transcript") or "").strip()
    tags = data.get("tags") or []
    # keep only non-empty string tags, trimmed
    tags = [str(t).strip() for t in tags if str(t).strip()]
    return description, tags, transcript
