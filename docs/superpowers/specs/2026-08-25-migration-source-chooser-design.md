# New migration: a source chooser, one page per source

## Problem

"New migration" opens the settings form with `provider: 'kaltura'` already selected and a
three-button switcher at the top of the form. Kaltura is a default rather than a choice, and
the source a migration will use is not addressable: every source shares `/migrations/new`.

## Design

### URLs

| URL | View | Note |
| --- | --- | --- |
| `/migrations` | `migrations_list` | unchanged |
| `/migrations/new` | `migration_new` | **new** - pick a source |
| `/migrations/new/<source>` | `migration_edit` | **new** - one URL per source |
| `/migrations/<id>/edit` | `migration_edit` | unchanged |
| `/migrations/<id>` | `migration_detail` | unchanged |

`<source>` is validated against the provider registry rather than a hardcoded list, so a
provider added later needs no URL change. An unknown source redirects to the chooser instead
of rendering a form for a provider that does not exist.

`/migrations/<id>` uses the int path converter, so `new` cannot be read as an id.

### Pages

The chooser is the only new bundle: a `migration-new` entry in `mediacms.config.pages.js`,
a `MigrationNewPage` component and a `migration_new.html` template.

The three source pages reuse the existing `migration-edit` bundle and template. A source that
is not implemented yet is therefore a real page at its own URL for free: the edit page already
renders an explanatory placeholder, and no connection form, options or save button, for a
provider whose `available` flag is false.

The chooser does not link to a source that is not implemented yet. Its tile is rendered as
plain markup rather than an anchor, so there is nothing to click and nothing for a keyboard or
a screen reader to land on. The page itself stays reachable by address, for anyone following an
existing link or typing one.

### Form page

- The provider comes from the URL, not from a default.
- The in-form source switcher is removed. With a URL per source it can only put the page out
  of step with its own address.
- A "Choose a different source" link returns to the chooser. It appears only while creating.
- Editing a saved migration keeps `/migrations/<id>/edit`, and its source is now fixed:
  changing it would invalidate the stored connection and the mapping rows already written
  against that source.

### Tests

`migrationservice/tests/test_pages.py` covers the pages already. Added: the chooser renders
for a superuser and redirects anyone else, each source URL renders, an unknown source
redirects to the chooser, and `/migrations/new` no longer implies Kaltura.

## Deliberately not done

The chooser's list of sources stays in the frontend while the backend validates against the
registry. Serving a three-item list from an API endpoint would remove the duplication and add
a round trip for it; the backend still refuses anything the registry does not know.
