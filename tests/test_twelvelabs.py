from django.test import TestCase

from integrations.twelvelabs.twelve_labs_utils import parse_analysis


class TestParseAnalysis(TestCase):
    """No-network unit tests for the TwelveLabs response parser."""

    def test_plain_json(self):
        raw = '{"description": "A cat plays piano.", "tags": ["cat", "music"], "transcript": "WEBVTT\\n\\nhello"}'
        description, tags, transcript = parse_analysis(raw)
        self.assertEqual(description, "A cat plays piano.")
        self.assertEqual(tags, ["cat", "music"])
        self.assertTrue(transcript.startswith("WEBVTT"))

    def test_strips_markdown_code_fence(self):
        raw = '```json\n{"description": "x", "tags": ["a"], "transcript": ""}\n```'
        description, tags, transcript = parse_analysis(raw)
        self.assertEqual(description, "x")
        self.assertEqual(tags, ["a"])
        self.assertEqual(transcript, "")

    def test_drops_empty_and_whitespace_tags(self):
        raw = '{"description": "", "tags": ["a", "", "  ", " b "], "transcript": ""}'
        _, tags, _ = parse_analysis(raw)
        self.assertEqual(tags, ["a", "b"])

    def test_invalid_json_returns_empty_defaults(self):
        self.assertEqual(parse_analysis("not json"), ("", [], ""))
        self.assertEqual(parse_analysis(""), ("", [], ""))
        self.assertEqual(parse_analysis(None), ("", [], ""))

    def test_missing_keys_default_safely(self):
        description, tags, transcript = parse_analysis('{"description": "only desc"}')
        self.assertEqual(description, "only desc")
        self.assertEqual(tags, [])
        self.assertEqual(transcript, "")
