# covers/places/

Town photos — `{place-slug}.jpg`, landscape, ~1600×600.

    covers/places/strumica.jpg

These must actually be that town — real photographs, not stock, the same
rule a business profile follows. Add the credit (if the source requires
one) to `PLACE_COVERS` in `apps/web/src/lib/place-covers.ts`; nothing else
needs to change, the card picks it up automatically.

Missing covers fall back to the same patterned panel category cards use, so
the page looks finished either way and you can add them one at a time.
