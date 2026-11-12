import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { houseAgentSamples } from "../src/lib/design-examples.js";

const root = new URL("../../../", import.meta.url);

test("the gallery's house-agent samples are byte-identical to samples/ and their provenance matches provenance.json", () => {
  assert.deepEqual(houseAgentSamples.map((sample) => sample.id), ["maya-okafor-voltage", "crumb-and-co-atelier"]);
  for (const sample of houseAgentSamples) {
    const { provenance } = sample;
    const [, slug, file] = provenance.sample.split("/");
    const record = JSON.parse(readFileSync(new URL(`samples/${slug}/provenance.json`, root), "utf8"));
    const artifact = record.artifacts.find((item: { file: string }) => item.file === file);
    assert.ok(artifact, `${provenance.sample} is in provenance.json`);
    assert.equal(record.brief.fictional, true);
    assert.equal(record.brief.kind, "business-card");
    assert.equal(artifact.agent, sample.agent);
    assert.equal(artifact.model, provenance.model);
    assert.equal(artifact.judge.evaluator_version, `${provenance.evaluator}:${provenance.model}`);
    assert.equal(artifact.status, provenance.judgeStatus);
    assert.equal(artifact.judge.qualified, true);
    assert.equal(artifact.judge.checks.length, provenance.checksTotal);
    assert.equal(artifact.judge.checks.filter((check: { passed: boolean }) => check.passed).length, provenance.checksPassed);
    assert.equal(artifact.sha256, provenance.sha256);
    assert.equal(artifact.generated_at, provenance.generatedAt);

    const served = readFileSync(new URL(`apps/web/public/examples/${sample.file}.html`, root));
    assert.equal(createHash("sha256").update(served).digest("hex"), provenance.sha256);
    assert.deepEqual(served, readFileSync(new URL(provenance.sample, root)));
    for (const view of ["desktop", "phone"] as const) {
      const shot = readFileSync(new URL(`apps/web/public/examples/${sample.file}-${view}.jpg`, root));
      assert.deepEqual(shot, readFileSync(new URL(`samples/${slug}/${artifact.render[`${view}_screenshot`]}`, root)));
    }
  }
});
