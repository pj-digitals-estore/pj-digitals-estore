import test from "node:test";
import assert from "node:assert/strict";
import { cleanLocationName, locationKey, locationNameProblem, matchLocations } from "../utils/locationNames.js";

test("names are tidied and compared without caring about capitals or spacing", () => {
  assert.equal(cleanLocationName("  New   Town "), "New Town");
  assert.equal(locationKey("  MUTTOM "), "muttom");
  assert.equal(cleanLocationName(null), "");
});

test("bad names are explained", () => {
  assert.match(locationNameProblem("A"), /at least 2/);
  assert.match(locationNameProblem("x".repeat(41)), /at most 40/);
  assert.match(locationNameProblem("Town, Kerala"), /commas/);
  assert.match(locationNameProblem('Bad"Name'), /commas, quotes/);
  assert.equal(locationNameProblem("Kaduthuruthy"), "");
  assert.equal(locationNameProblem("Muttom 2nd Ward"), "");
});

test("a list from a client is matched to real names, in order, without duplicates or unknowns", () => {
  const known = ["Thodupuzha", "Muttom", "Kaduthuruthy"];
  assert.deepEqual(matchLocations(["muttom", "THODUPUZHA", "Muttom", "Atlantis", "", null as any], known), ["Muttom", "Thodupuzha"]);
  assert.deepEqual(matchLocations([], known), []);
  assert.deepEqual(matchLocations(["x"], []), []);
});
