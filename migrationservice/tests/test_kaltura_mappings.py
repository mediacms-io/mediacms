from django.test import TestCase

from files.models import EncodeProfile
from migrationservice.providers.kaltura import (
    APPEAR_IN_LIST_MEMBERS_ONLY,
    APPEAR_IN_LIST_PARTNER,
    CATEGORY_OPEN,
    CATEGORY_PRIVATE,
    CATEGORY_PUBLIC,
    CATEGORY_RESTRICTED,
    CONTRIBUTION_ALL,
    CONTRIBUTION_MEMBERS,
    DISPLAY_IN_SEARCH_NONE,
    DISPLAY_IN_SEARCH_PARTNER_ONLY,
    DISPLAY_IN_SEARCH_RECYCLED,
    MODERATION_APPROVED,
    MODERATION_AUTO_APPROVED,
    PRIVACY_ALL,
    PRIVACY_AUTHENTICATED,
    PRIVACY_MEMBERS_ONLY,
    category_title_and_description,
    category_type,
    is_importable_category,
    match_flavors_to_profiles,
    media_state,
    mediacms_role,
    sanitize_username,
    unique_category_title,
)


class TestMediaState(TestCase):
    def test_no_categories_is_private(self):
        self.assertEqual(media_state([]), "private")

    def test_any_public_category_is_public(self):
        self.assertEqual(media_state([PRIVACY_MEMBERS_ONLY, PRIVACY_ALL]), "public")

    def test_only_restricted_categories_is_unlisted(self):
        self.assertEqual(media_state([PRIVACY_AUTHENTICATED, PRIVACY_MEMBERS_ONLY]), "unlisted")

    def test_display_in_search_none_downgrades_public_to_unlisted(self):
        self.assertEqual(media_state([PRIVACY_ALL], DISPLAY_IN_SEARCH_NONE), "unlisted")

    def test_display_in_search_none_never_promotes_private(self):
        self.assertEqual(media_state([], DISPLAY_IN_SEARCH_NONE), "private")

    def test_the_ordinary_display_in_search_value_does_not_downgrade(self):
        # PARTNER_ONLY is what every normal entry carries. Reading it as "hidden" turned
        # every public entry on a portal into an unlisted one.
        self.assertEqual(media_state([PRIVACY_ALL], DISPLAY_IN_SEARCH_PARTNER_ONLY), "public")

    def test_a_recycled_entry_is_downgraded(self):
        self.assertEqual(media_state([PRIVACY_ALL], DISPLAY_IN_SEARCH_RECYCLED), "unlisted")

    def test_a_public_category_dict_is_public(self):
        category = {"privacy": PRIVACY_ALL, "appearInList": APPEAR_IN_LIST_PARTNER, "contributionPolicy": CONTRIBUTION_ALL}
        self.assertEqual(media_state([category]), "public")

    def test_a_public_category_that_only_members_may_add_to_is_still_public(self):
        # KMS calls this "Public, Restricted": anyone including anonymous users may watch,
        # only members may contribute. contributionPolicy is a publishing right, so it must
        # not hide the content.
        category = {"privacy": PRIVACY_ALL, "appearInList": APPEAR_IN_LIST_PARTNER, "contributionPolicy": CONTRIBUTION_MEMBERS}
        self.assertEqual(media_state([category]), "public")

    def test_unapproved_media_is_private_wherever_it_sits(self):
        category = {"privacy": PRIVACY_ALL, "appearInList": APPEAR_IN_LIST_PARTNER, "contributionPolicy": CONTRIBUTION_ALL}
        self.assertEqual(media_state([category], None, 1), "private")

    def test_approved_media_keeps_its_category_state(self):
        category = {"privacy": PRIVACY_ALL, "appearInList": APPEAR_IN_LIST_PARTNER, "contributionPolicy": CONTRIBUTION_ALL}
        self.assertEqual(media_state([category], None, MODERATION_APPROVED), "public")
        self.assertEqual(media_state([category], None, MODERATION_AUTO_APPROVED), "public")


class TestCategoryType(TestCase):
    """A KMS category type is not a field. It is the three permission fields read
    together, and the values below come from a live portal.
    """

    def test_public(self):
        self.assertEqual(category_type({"privacy": PRIVACY_ALL, "appearInList": APPEAR_IN_LIST_PARTNER, "contributionPolicy": CONTRIBUTION_ALL}), CATEGORY_PUBLIC)

    def test_open(self):
        self.assertEqual(category_type({"privacy": PRIVACY_AUTHENTICATED, "appearInList": APPEAR_IN_LIST_PARTNER, "contributionPolicy": CONTRIBUTION_ALL}), CATEGORY_OPEN)

    def test_restricted_by_contribution(self):
        self.assertEqual(category_type({"privacy": PRIVACY_AUTHENTICATED, "appearInList": APPEAR_IN_LIST_PARTNER, "contributionPolicy": CONTRIBUTION_MEMBERS}), CATEGORY_RESTRICTED)

    def test_public_restricted_is_public_not_restricted(self):
        # anyone can view it, so contributionPolicy must not pull it below public
        self.assertEqual(category_type({"privacy": PRIVACY_ALL, "appearInList": APPEAR_IN_LIST_PARTNER, "contributionPolicy": CONTRIBUTION_MEMBERS}), CATEGORY_PUBLIC)

    def test_shared_repository_lands_on_private(self):
        # a Shared Repository channel is members only for viewing, so it arrives as
        # MEMBERS_ONLY and is treated as a private channel
        self.assertEqual(category_type({"privacy": PRIVACY_MEMBERS_ONLY, "appearInList": APPEAR_IN_LIST_MEMBERS_ONLY, "contributionPolicy": CONTRIBUTION_MEMBERS}), CATEGORY_PRIVATE)

    def test_restricted_by_listing(self):
        self.assertEqual(category_type({"privacy": PRIVACY_AUTHENTICATED, "appearInList": APPEAR_IN_LIST_MEMBERS_ONLY, "contributionPolicy": CONTRIBUTION_ALL}), CATEGORY_RESTRICTED)

    def test_private(self):
        self.assertEqual(category_type({"privacy": PRIVACY_MEMBERS_ONLY, "appearInList": APPEAR_IN_LIST_MEMBERS_ONLY, "contributionPolicy": CONTRIBUTION_MEMBERS}), CATEGORY_PRIVATE)

    def test_an_unknown_combination_is_read_restrictively(self):
        self.assertEqual(category_type({}), CATEGORY_RESTRICTED)


class TestRoleMapping(TestCase):
    """The map is per migration data now, matched on the role id first and the name
    second, because ids are exact within a partner while names are whatever an
    administrator typed.
    """

    MAP = [
        {"id": "3", "name": "Content Moderator", "role": "editor"},
        {"id": "", "name": "Content Uploader", "role": "manager"},
        {"id": "2", "name": "Publisher Administrator", "role": "admin"},
    ]

    def test_the_id_is_matched_first(self):
        self.assertEqual(mediacms_role("2", "renamed at the source", self.MAP), "admin")

    def test_the_name_is_matched_when_the_row_has_no_id(self):
        self.assertEqual(mediacms_role("11", "Content Uploader", self.MAP), "manager")

    def test_the_name_match_is_case_insensitive(self):
        self.assertEqual(mediacms_role("", "content moderator", self.MAP), "editor")

    def test_an_unmapped_role_is_a_plain_user(self):
        self.assertEqual(mediacms_role("99", "Something Else", self.MAP), "")
        self.assertEqual(mediacms_role("", "", self.MAP), "")

    def test_an_id_that_matches_nothing_falls_back_to_the_name(self):
        self.assertEqual(mediacms_role("99", "Content Moderator", self.MAP), "editor")

    def test_the_shipped_default_map(self):
        self.assertEqual(mediacms_role("", "Content Moderator"), "editor")
        self.assertEqual(mediacms_role("", "Content Uploader"), "manager")
        self.assertEqual(mediacms_role("", "Player Designer"), "manager")
        self.assertEqual(mediacms_role("", "Manager"), "admin")
        self.assertEqual(mediacms_role("", "Publisher Administrator"), "admin")

    def test_an_empty_map_grants_nothing(self):
        self.assertEqual(mediacms_role("2", "Publisher Administrator", []), "")


class TestCategoryTitles(TestCase):
    def test_kms_scaffolding_is_dropped_and_path_becomes_description(self):
        title, description = category_title_and_description("MediaSpace>site>galleries>Engineering>1. Term>Electronics")
        self.assertEqual(title, "Electronics")
        self.assertEqual(description, "Engineering: 1. Term: Electronics")

    def test_channels_scaffolding_is_dropped_too(self):
        title, description = category_title_and_description("MediaSpace>site>channels>Physics")
        self.assertEqual(title, "Physics")
        self.assertEqual(description, "Physics")

    def test_missing_root_still_works(self):
        title, description = category_title_and_description("Engineering>Electronics")
        self.assertEqual(title, "Electronics")
        self.assertEqual(description, "Engineering: Electronics")

    def test_empty_input(self):
        self.assertEqual(category_title_and_description(""), ("", ""))

    def test_title_is_truncated_to_the_model_limit(self):
        title, _ = category_title_and_description("A>" + "x" * 200)
        self.assertEqual(len(title), 100)

    def test_a_real_category_named_channels_is_not_treated_as_scaffolding(self):
        title, description = category_title_and_description("Channels>Student Productions")
        self.assertEqual(title, "Student Productions")
        self.assertEqual(description, "Channels: Student Productions")


class TestUniqueCategoryTitle(TestCase):
    def test_free_title_is_returned_unchanged(self):
        self.assertEqual(unique_category_title("Electronics", "Engineering", set()), "Electronics")

    def test_collision_appends_the_parent(self):
        self.assertEqual(
            unique_category_title("Electronics", "Engineering", {"Electronics"}),
            "Electronics (Engineering)",
        )

    def test_second_collision_falls_back_to_a_counter(self):
        taken = {"Electronics", "Electronics (Engineering)"}
        self.assertEqual(unique_category_title("Electronics", "Engineering", taken), "Electronics (2)")

    def test_collision_without_a_parent_uses_a_counter(self):
        self.assertEqual(unique_category_title("Electronics", "", {"Electronics"}), "Electronics (2)")

    def test_a_long_title_collision_terminates_and_stays_within_the_limit(self):
        long_title = "x" * 100
        result = unique_category_title(long_title, "Engineering", {long_title})
        self.assertNotEqual(result, long_title)
        self.assertLessEqual(len(result), 100)

    def test_repeated_long_title_collisions_keep_producing_new_titles(self):
        long_title = "y" * 100
        taken = {long_title}
        for _ in range(5):
            result = unique_category_title(long_title, "Engineering", taken)
            self.assertNotIn(result, taken)
            self.assertLessEqual(len(result), 100)
            taken.add(result)


class TestFlavorMatching(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        self.profiles = list(EncodeProfile.objects.filter(active=True))

    def test_each_flavor_lands_on_its_own_profile(self):
        flavors = [
            {"id": "f720", "height": 720, "fileExt": "mp4"},
            {"id": "f360", "height": 360, "fileExt": "mp4"},
        ]
        pairs = match_flavors_to_profiles(flavors, self.profiles)
        matched = {flavor["id"]: profile.resolution for flavor, profile in pairs}
        self.assertEqual(matched, {"f720": 720, "f360": 360})

    def test_a_flavor_with_no_exact_profile_gets_the_nearest_one(self):
        pairs = match_flavors_to_profiles([{"id": "f540", "height": 540, "fileExt": "mp4"}], self.profiles)
        self.assertEqual(pairs[0][1].resolution, 480)

    def test_two_flavors_never_share_a_profile(self):
        flavors = [
            {"id": "f716", "height": 716, "fileExt": "mp4"},
            {"id": "f720", "height": 720, "fileExt": "mp4"},
        ]
        pairs = match_flavors_to_profiles(flavors, self.profiles)
        resolutions = [profile.resolution for _flavor, profile in pairs]
        self.assertEqual(len(resolutions), len(set(resolutions)))
        exact = [flavor["id"] for flavor, profile in pairs if profile.resolution == 720]
        self.assertEqual(exact, ["f720"])

    def test_unsupported_extensions_are_dropped(self):
        pairs = match_flavors_to_profiles([{"id": "fmov", "height": 720, "fileExt": "mov"}], self.profiles)
        self.assertEqual(pairs, [])

    def test_gif_profiles_are_never_matched(self):
        flavors = [{"id": "f720", "height": 720, "fileExt": "mp4"}]
        pairs = match_flavors_to_profiles(flavors, self.profiles)
        self.assertTrue(all(profile.extension != "gif" for _flavor, profile in pairs))

    def test_no_flavors_gives_no_pairs(self):
        self.assertEqual(match_flavors_to_profiles([], self.profiles), [])

    def test_a_flavor_whose_best_profile_is_taken_falls_back_instead_of_vanishing(self):
        flavors = [
            {"id": "f716", "height": 716, "fileExt": "mp4"},
            {"id": "f720", "height": 720, "fileExt": "mp4"},
        ]
        pairs = match_flavors_to_profiles(flavors, self.profiles)
        matched_ids = sorted(flavor["id"] for flavor, _profile in pairs)
        self.assertEqual(matched_ids, ["f716", "f720"])
        exact = [flavor["id"] for flavor, profile in pairs if profile.resolution == 720]
        self.assertEqual(exact, ["f720"])

    def test_inactive_profiles_are_never_matched(self):
        from files.models import EncodeProfile

        all_profiles = list(EncodeProfile.objects.all())
        pairs = match_flavors_to_profiles([{"id": "f720", "height": 720, "fileExt": "mp4"}], all_profiles)
        self.assertTrue(all(profile.active for _flavor, profile in pairs))


class TestSanitizeUsername(TestCase):
    def test_valid_characters_survive(self):
        self.assertEqual(sanitize_username("j.doe@example.edu"), "j.doe@example.edu")

    def test_invalid_characters_become_dashes(self):
        self.assertEqual(sanitize_username("cn=John Doe,ou=staff"), "cn-John-Doe-ou-staff")

    def test_empty_input_gets_a_placeholder(self):
        self.assertEqual(sanitize_username(""), "migrated-user")

    def test_length_is_capped(self):
        self.assertEqual(len(sanitize_username("x" * 300)), 150)

    def test_truncation_never_leaves_a_trailing_dash(self):
        self.assertFalse(sanitize_username("a" * 149 + "-" + "b" * 100).endswith("-"))


class TestImportableCategory(TestCase):
    """Categories now arrive only via the media that belong to them, so the scope
    check is root agnostic: no KMS root has to be configured.
    """

    def test_galleries_and_channels_are_importable(self):
        self.assertTrue(is_importable_category("MediaSpace>site>galleries>Engineering>Electronics"))
        self.assertTrue(is_importable_category("MediaSpace>site>channels>Physics"))
        self.assertTrue(is_importable_category("moodle_jPsFc>site>galleries>Course A"))
        self.assertTrue(is_importable_category("ltigeneric_8yrU6>site>channels>Course B"))

    def test_kms_housekeeping_is_not_importable(self):
        for name in [
            "MediaSpace>private",
            "MediaSpace>unlisted",
            "MediaSpace>archive",
            "MediaSpace>playlists",
            "moodle_jPsFc>unlisted",
        ]:
            self.assertFalse(is_importable_category(name), name)

    def test_kms_containers_are_not_importable(self):
        for name in ["MediaSpace>site", "MediaSpace>site>galleries", "MediaSpace>site>channels"]:
            self.assertFalse(is_importable_category(name), name)

    def test_nested_filters_is_not_importable(self):
        self.assertFalse(is_importable_category("moodle_jPsFc>site>nestedFilters>Anything"))

    def test_a_portal_not_using_kms_keeps_its_categories(self):
        self.assertTrue(is_importable_category("Lectures>2024>Autumn"))
        self.assertTrue(is_importable_category("Engineering"))

    def test_a_category_with_no_full_name_is_kept(self):
        # the source did not say where it sits; dropping it would lose a real one
        self.assertTrue(is_importable_category(""))
        self.assertTrue(is_importable_category(None))


class TestFlavorMatchingAgainstRealKalturaData(TestCase):
    """Flavors as actually returned by a live Kaltura for a 4K entry.

    The source carries two flavors at 360p. MediaCMS has one profile per
    resolution, so without a bound on how far a flavor may be filed from its real
    height the loser cascaded down to 144p — a 360p file offered to viewers as a
    low bandwidth rendition.
    """

    fixtures = ["fixtures/encoding_profiles.json"]

    REAL_FLAVORS = [
        {"id": "0_bc3x0tth", "height": 272, "fileExt": "mp4"},
        {"id": "0_lbjtepjd", "height": 360, "fileExt": "mp4"},
        {"id": "0_1pe3qcic", "height": 360, "fileExt": "mp4"},
        {"id": "0_jiwr1rzu", "height": 576, "fileExt": "mp4"},
        {"id": "0_3ns4wrgj", "height": 720, "fileExt": "mp4"},
        {"id": "0_txgbq8ao", "height": 1080, "fileExt": "mp4"},
    ]

    def setUp(self):
        self.profiles = list(EncodeProfile.objects.filter(active=True))

    def matched(self):
        return {flavor["id"]: profile.resolution for flavor, profile in match_flavors_to_profiles(self.REAL_FLAVORS, self.profiles)}

    def test_every_flavor_lands_near_its_real_height(self):
        for flavor in self.REAL_FLAVORS:
            resolution = self.matched().get(flavor["id"])
            if resolution is None:
                continue
            ratio = resolution / flavor["height"]
            self.assertGreater(ratio, 0.5, f"{flavor['id']} at {flavor['height']}p filed as {resolution}p")
            self.assertLess(ratio, 1.5, f"{flavor['id']} at {flavor['height']}p filed as {resolution}p")

    def test_the_duplicate_resolution_is_skipped_not_misfiled(self):
        matched = self.matched()
        at_360 = [fid for fid, res in matched.items() if res == 360]
        self.assertEqual(len(at_360), 1, "both 360p flavors were assigned somewhere")
        self.assertNotIn(144, matched.values(), "a flavor was filed as 144p with no 144p source")

    def test_no_profile_takes_two_flavors(self):
        resolutions = list(self.matched().values())
        self.assertEqual(len(resolutions), len(set(resolutions)))

    def test_a_flavor_with_no_height_is_skipped(self):
        pairs = match_flavors_to_profiles([{"id": "broken", "height": 0, "fileExt": "mp4"}], self.profiles)
        self.assertEqual(pairs, [])
