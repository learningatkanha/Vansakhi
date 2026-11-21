import { test } from "node:test";
import assert from "node:assert/strict";
import { toSpeciesMatch } from "../src/lib/gbif.ts";
import { toPlaceMatches } from "../src/lib/places.ts";

test("GBIF result becomes a species match with English and Hindi names", () => {
  const m = toSpeciesMatch({
    key: 123,
    nubKey: 2440974,
    canonicalName: "Panthera tigris",
    scientificName: "Panthera tigris (Linnaeus, 1758)",
    kingdom: "Animalia",
    class: "Mammalia",
    vernacularNames: [
      { vernacularName: "Tigre", language: "fra" },
      { vernacularName: "Tiger", language: "eng" },
      { vernacularName: "बाघ", language: "hin" },
    ],
  });
  assert.deepEqual(m, {
    gbifKey: 2440974,
    scientificName: "Panthera tigris",
    commonName: "Tiger",
    hindiName: "बाघ",
    group: "Mammalia",
  });
});

test("GBIF result without names falls back cleanly", () => {
  assert.deepEqual(toSpeciesMatch({ key: 5, scientificName: "Shorea robusta", kingdom: "Plantae" }), {
    gbifKey: 5,
    scientificName: "Shorea robusta",
    commonName: null,
    hindiName: null,
    group: "Plantae",
  });
  assert.equal(toSpeciesMatch({ canonicalName: "No key" }), null);
});

test("Google Geocoding response becomes place matches", () => {
  const places = toPlaceMatches({
    status: "OK",
    results: [{ formatted_address: "Mocha, Madhya Pradesh 481111, India", geometry: { location: { lat: 22.28, lng: 80.53 } } }],
  });
  assert.deepEqual(places, [{ name: "Mocha, Madhya Pradesh 481111, India", lat: 22.28, lng: 80.53 }]);
  assert.deepEqual(toPlaceMatches({ status: "ZERO_RESULTS" }), []);
  assert.throws(() => toPlaceMatches({ status: "REQUEST_DENIED", error_message: "API key invalid" }), /API key invalid/);
});

test("iNaturalist photo is taken only from the exactly matching species", async () => {
  const { pickInatPhoto } = await import("../src/lib/species-photos.ts");
  const body = {
    results: [
      { name: "Panthera tigris tigris", default_photo: { medium_url: "https://example.org/sub.jpg" } },
      { name: "Panthera tigris", default_photo: { square_url: "https://example.org/sq.jpg", medium_url: "https://example.org/med.jpg" } },
    ],
  };
  assert.equal(pickInatPhoto(body, "Panthera tigris"), "https://example.org/med.jpg");
  assert.equal(pickInatPhoto(body, "Rucervus duvaucelii"), null);
  assert.equal(pickInatPhoto({ results: [{ name: "X y", default_photo: { medium_url: "http://insecure.jpg" } }] }, "X y"), null);
});

test("Wikipedia thumbnail is skipped for disambiguation pages", async () => {
  const { pickWikiPhoto } = await import("../src/lib/species-photos.ts");
  assert.equal(pickWikiPhoto({ type: "standard", thumbnail: { source: "https://upload.wikimedia.org/a.jpg" } }), "https://upload.wikimedia.org/a.jpg");
  assert.equal(pickWikiPhoto({ type: "disambiguation", thumbnail: { source: "https://upload.wikimedia.org/a.jpg" } }), null);
  assert.equal(pickWikiPhoto({ type: "standard" }), null);
});
