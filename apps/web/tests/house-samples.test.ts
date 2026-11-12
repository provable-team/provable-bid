import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { houseAgentSamples } from "../src/lib/design-examples.js";

const root = new URL("../../../", import.meta.url);

/** The exact bytes teammates print-reviewed and accepted; the gallery must serve these and nothing else. */
const printAccepted: Record<string, string> = {
  "maya-okafor-atelier": "50bc60a1bb8ae75c53ecf94ced945cf4334b20cd5f0dece9b2c7f12bea648123",
  "crumb-and-co-atelier": "3cd0de177b9dd2ebff283f47897b79395def76d53e8b4994ec1774a7cd8f8b35",
  "spoke-and-chain-meadow": "a16777dc24f12f9df60fb8c93b8531655dce703ea027b06d47226fa5b0f6db68",
};

test("the gallery's house-agent samples are byte-identical to samples/ and their provenance matches provenance.json", () => {
  assert.deepEqual(houseAgentSamples.map((sample) => sample.id), Object.keys(printAccepted));
  for (const sample of houseAgentSamples) {
    const { provenance } = sample;
    assert.equal(provenance.sha256, printAccepted[sample.id]);
    const match = /^samples\/([^/]+)\/(v\d+)\/([^/]+\.html)$/.exec(provenance.sample);
    assert.ok(match, `${provenance.sample} is samples/<slug>/<run>/<file>`);
    const [, slug, run, file] = match;
    const dir = `samples/${slug}/${run}/`;
    const record = JSON.parse(readFileSync(new URL(`${dir}provenance.json`, root), "utf8"));
    assert.equal(record.run, run);
    const artifact = record.artifacts.find((item: { file: string }) => item.file === file);
    assert.ok(artifact, `${provenance.sample} is in provenance.json`);
    assert.equal(record.brief.fictional, true);
    assert.equal(record.brief.kind, sample.category === "Posters" ? "poster" : "business-card");
    assert.equal(artifact.agent, sample.agent);
    assert.equal(artifact.model, provenance.model);
    assert.equal(artifact.judge.evaluator_version, `${provenance.evaluator}:${provenance.model}`);
    assert.equal(artifact.status, provenance.judgeStatus);
    assert.equal(artifact.judge.qualified, true);
    assert.equal(artifact.judge.checks.length, provenance.checksTotal);
    assert.equal(artifact.judge.checks.filter((check: { passed: boolean }) => check.passed).length, provenance.checksPassed);
    assert.equal(artifact.attempts_used, provenance.attemptsUsed);
    assert.equal(artifact.sha256, provenance.sha256);
    assert.equal(artifact.generated_at, provenance.generatedAt);

    const original = readFileSync(new URL(provenance.sample, root));
    assert.equal(createHash("sha256").update(original).digest("hex"), provenance.sha256);
    const served = readFileSync(new URL(`apps/web/public/examples/${sample.file}.html`, root));
    assert.equal(createHash("sha256").update(served).digest("hex"), provenance.sha256);
    assert.deepEqual(served, original);
    for (const view of ["desktop", "phone"] as const) {
      const shot = readFileSync(new URL(`apps/web/public/examples/${sample.file}-${view}.jpg`, root));
      assert.deepEqual(shot, readFileSync(new URL(`${dir}${artifact.render[`${view}_screenshot`]}`, root)));
    }
  }
});

test("public/examples/house serves only the featured house-agent samples", () => {
  const expected = houseAgentSamples
    .flatMap((sample) => {
      const name = sample.file.split("/").pop();
      return [`${name}.html`, `${name}-desktop.jpg`, `${name}-phone.jpg`];
    })
    .sort();
  const served = readdirSync(new URL("apps/web/public/examples/house/", root)).sort();
  assert.deepEqual(served, expected);
});
