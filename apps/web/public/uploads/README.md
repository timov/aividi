# uploads/

Photographs of specific businesses — ours, or supplied by the owner.

Reference them from the `photos` column of a hand-collected CSV, pipe-separated:

    photos
    via-pica-1.jpg|via-pica-2.jpg

There are two further single-slot columns, `logo` and `cover`:

    name,logo,cover
    Виа Пица,via-pica-logo.png,via-pica-cover.jpg

`logo` is the business's own mark — it shows beside the name in lists and on
the profile. The logo fetcher (`pnpm logos`) fills this automatically from a
business's own website, and writes into `../logos/`; a value set here or in
the admin wins over it.

`cover` is the wide image across the top of the profile. Aim for at least
1600px wide and roughly 16:4 — the header crops to that.

Both are singular. Setting either replaces whatever was there; clearing the
field in the admin removes it.

A value starting with `http` is used as-is; anything else is served from here.

**Never put stock photography in this folder.** A generic interior on a named
business's profile is a picture of somewhere else presented as their premises.
Category-level stock belongs in `../covers/` instead.
