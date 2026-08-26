# Design brief for mock builders

Paste the block below into v0, Lovable, Bolt, Figma Make, Claude, ChatGPT — whatever
you want to try. It is written to be tool-agnostic.

Two things about how to use it:

- **Run it 3–4 times, and in more than one tool.** The point is variety. Most of these
  tools have a house style, so one output tells you about the tool, not about the design.
- **When you send me the ones you like, say what specifically you liked** — "the way the
  price sits next to the name", "that header", "the colour". That is far more useful to me
  than "build this one", because I can then take the one good idea out of an otherwise
  mediocre mock.

There is an evaluation checklist at the bottom to help you judge the outputs.

---

## The prompt

```
Design a local business directory for Strumica, a town of 35,000 in North Macedonia.
The site is called aividi.mk. All interface text and content is in MACEDONIAN CYRILLIC —
do not translate it to English, and do not use Latin transliteration.

WHAT IT IS
A directory of every business in one town, built to be the most trustworthy source of
opening hours, phone numbers and prices in the country. Its differentiator is the AIVIDI
SCORE: a 0–100 number computed for each business from how complete its profile is, how
recently a human verified it by phone, whether it publishes prices, and its reviews. The
score decides the ranking. Businesses can raise it for free by giving us better data.
Think of it the way Trustpilot's TrustScore works — one number that has to be
recognisable on its own.

WHO USES IT
Everyone in the town, aged roughly 15 to 75, mostly on inexpensive Android phones with
patchy signal. A teenager looking for pizza delivery at 21:00 and a 70-year-old looking
for a plumber use the same page. The single most common action is CALLING the business —
not booking, not messaging, not saving.

SCREENS TO DESIGN
1. Category listing — "Пицерии во Струмица". A list of businesses with their score,
   whether they are open right now, price range, and a way to call.
2. Ranked list — "Најдобри пицерии во Струмица". The same businesses, but presented as a
   published ranking with positions, the way an awards list or an annual guide is
   presented rather than a search result.
3. Business profile — one business: hours for the week, services with prices, contact
   details, what it offers.

USE THIS REAL CONTENT (do not invent placeholder businesses, do not use lorem ipsum;
phone numbers below are dummies)

  Гостилница Центар — Плоштад Гоце Делчев 1 — 070 000 021 — Score 30
    Тавче гравче 200–260 ден. · Скара 380–520 ден. · Мезе 220–300 ден.
    Паркинг, Тераса, Работи недела, Прима картички, Пристап за инвалиди
    Пон–Нед 10:00–23:00        ← SPONSORED, must be visibly labelled
  Гостилница Езерце — Младинска 18 — 070 000 025 — Score 23
    Тавче гравче 200–250 ден. · Скара 360–480 ден.
    Паркинг, Тераса, Работи викенд, Погодно за деца · Пон–Нед 10:00–23:00
  Кај Дедо Ристо — Гоце Делчев 52 — 070 000 023 — Score 23
    Скара 350–450 ден. · Мезе 180–250 ден. · Паркинг, Тераса, Работи викенд
  Гостилница Стара Куќа — Цветан Димов 12 — 070 000 022 — Score 23
    Тавче гравче 190–240 ден. · Мезе 200–280 ден. · Тераса, Прима картички
  Механа Белазора — Никола Карев 9 — 070 000 024 — Score 19
    Скара 400–550 ден. · Прослави 800–1400 ден. · Работи викенд, Прима картички
  Ѓирос Кај Ацо — Ленинова 44 — 070 000 002 — Score 19
    Ѓирос 130–170 ден. · Помфрит 60–80 ден. · Достава, Работи недела

  Useful phrases: „Отворено сега · до 23:00“ / „Затворено · отвора во 10:00“ /
  „Спонзорирано“ / „Проверено на 12.03.2026“ / „Јави се“ / „Цени“ / „Работно време“

NON-NEGOTIABLE
- NO PHOTOGRAPHY. We have none and will not for months. The design must look finished
  and intentional with zero images. Do not use stock photos, image placeholders, grey
  boxes or gradients standing in for pictures. Solve it with typography and layout.
- The AIVIDI Score must be a distinctive, repeatable visual device — something a business
  would be willing to print and put in their shop window.
- Sponsored entries must be clearly labelled and must never look like they earned their
  position in the ranking.
- Body text no smaller than 18px. Tap targets at least 52px. Text/background contrast at
  least 4.5:1 everywhere. No information conveyed by colour alone. No hover-only
  interactions. No icon-only buttons — icons always have a text label.
- "Open now" is the most important status on the page and must read at a glance.
- Light and dark mode.

DO NOT PRODUCE (this is what every templated directory looks like, and what we are
trying to get away from)
- Uniform rounded cards with drop shadows in a repeating grid
- Pill-shaped badges scattered across every card
- Emoji used as category icons
- A centred hero with a big search bar and a gradient behind it
- Star-rating rows
- Inter, Poppins or a default system font stack
- Generic blue or generic "trust green"
- A chat bubble in the bottom-right corner

DIRECTION
It should look like a small design studio built it for this specific town, not like a
directory template with the colours changed. Reference points for the FEELING, not to be
copied: theworlds50best.com (editorial confidence, a ranking presented as something
published and authoritative) and trustpilot.com (one number as an instrument of trust,
recognisable out of context).

Commit to one clear point of view rather than hedging. Take a real position on typography
and colour — pick faces with proper Cyrillic support and use them with intent.

OUTPUT
A single responsive HTML page with inline CSS showing all three screens stacked one after
another, so they can be compared. No external images, no icon libraries, no CSS
frameworks. Mobile-first, but show the desktop layout too. Include a short note at the
top listing the typefaces and the hex values you chose and why.
```

---

## Short version

For tools with a small prompt box, or a quick second opinion:

```
Design a business directory for Strumica, North Macedonia. All text in Macedonian
Cyrillic. Audience is the whole town, 15 to 75, on cheap Android phones; the primary
action is phoning the business. Each business has an AIVIDI SCORE (0–100) that decides
its ranking and must become a distinctive, printable badge — like Trustpilot's
TrustScore. Show three screens: a category list ("Пицерии во Струмица"), a ranked list
("Најдобри пицерии во Струмица") presented like a published awards list, and one business
profile with hours and prices. Constraints: NO photography at all — none exists, and the
design must look finished without it; 18px minimum body text; 52px tap targets; 4.5:1
contrast; light and dark. Avoid: rounded cards with shadows in a grid, pill badges, emoji
icons, centred gradient hero, star ratings, Inter/Poppins, generic blue. It should look
like a design studio built it for this town, not a directory template. Editorial
confidence of theworlds50best.com; trust-instrument clarity of trustpilot.com. Output one
responsive HTML page, inline CSS, no external assets.
```

---

## How to judge what comes back

Score each output on these. Anything that fails the first three is not worth sending on,
however pretty it looks.

| | Question |
| --- | --- |
| 1 | Is it still in Macedonian Cyrillic, or did the tool quietly translate it? |
| 2 | Does it look finished **without photos**, or is it secretly waiting for images? |
| 3 | Can you read it at arm's length, and is every tap target thumb-sized? |
| 4 | Is the score a device you would print and put in a window? |
| 5 | Is the sponsored entry obviously paid, without looking like it won? |
| 6 | Could you tell this apart from any other directory with the logo covered? |
| 7 | Is "отворено сега" the first thing your eye lands on in a row? |
| 8 | Does the ranked list feel *published*, or does it feel like search results? |

A useful trick: open the output next to <https://www.najdi24.mk/>. If the family
resemblance is obvious, the mock has failed regardless of its colours.
