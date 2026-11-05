// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// When a hosted test may run, on made-up tags, its tool and how it signs, on
// made-up tools, and what its workflow must hold to: started only by hand, no
// key of the project's and no secret outside the job that deploys, and the same
// build pins as the workflows it follows.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { after, describe, it } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { refusal } from './hosted-test.js';

const MAIN = 'refs/heads/main';
const tags = (...names) => names.map((name, at) => `${String(at).repeat(40)}\trefs/tags/${name}`).join('\n');
const workflow = (name) => readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8');

/** A workflow's job, by its id, as text. */
function job(text, id) {
  const jobs = text.slice(text.indexOf('\njobs:\n'));
  const start = jobs.indexOf(`\n  ${id}:\n`);
  assert.notEqual(start, -1, id);
  const end = jobs.slice(start + 1).search(/\n {2}[a-z-]+:\n/u);
  return end === -1 ? jobs.slice(start) : jobs.slice(start, start + 1 + end);
}

const made = [];
after(() => made.forEach((folder) => rmSync(folder, { recursive: true, force: true })));

/** A temporary folder that goes when the tests end. */
function folder(name) {
  const path = mkdtempSync(join(tmpdir(), name));
  made.push(path);
  return path;
}

describe('when a hosted test may run', () => {
  it('runs from main or a release branch, before any release with a demo server', () => {
    const before = tags('v0.5.0', 'v0.6.0', 'v0.6.1', 'v0.6.2', 'app-v0.7.0', 'server-v0.7.0');
    assert.equal(refusal(MAIN, before), undefined);
    assert.equal(refusal('refs/heads/release/0.7', before), undefined);
    assert.equal(refusal(MAIN, ''), undefined);
  });

  it('refuses any other ref', () => {
    for (const ref of ['refs/heads/feat/made-up', 'refs/tags/v0.6.1', 'refs/pull/1/merge', 'refs/heads/mainly', '']) {
      assert.match(refusal(ref, '') ?? '', /neither main nor a release branch/u);
    }
  });

  it('refuses once a release with a demo server is tagged, beta or not', () => {
    for (const tag of ['v0.7.0-beta.0', 'v0.7.0-beta.1', 'v0.7.0', 'v0.7.1', 'v0.8.0', 'v1.0.0']) {
      assert.match(refusal(MAIN, tags('v0.6.1', tag)) ?? '', /teachers' apps use the demo server now/u);
    }
  });
});

describe('the hosted test’s tool', () => {
  const tool = fileURLToPath(new URL('hosted-test.js', import.meta.url));
  const version = JSON.parse(readFileSync(new URL('../../apps/server/package.json', import.meta.url), 'utf8')).version;

  function run(ref, listing) {
    const file = join(folder('tags-'), 'tags');
    writeFileSync(file, listing);
    return spawnSync(process.execPath, [tool, ref, file], { encoding: 'utf8' });
  }

  it('prints the server’s version when it may run', () => {
    const result = run(MAIN, tags('v0.6.1'));
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `version=${version}\n`);
  });

  it('says why not, and exits 1, when it may not', () => {
    const result = run(MAIN, tags('v0.7.0'));
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^::error title=Hosted test::v0\.7\.0 is tagged/u);
  });
});

describe('the check of the bucket’s keys', () => {
  const script = fileURLToPath(new URL('check-demo-keys.sh', import.meta.url));
  const keys = {
    DEMO_R2_ACCESS_KEY_ID: 'made-up',
    DEMO_R2_SECRET_ACCESS_KEY: 'made-up',
    DEMO_ARCHIVE_KEY: 'ab'.repeat(32),
  };
  const run = (changed) =>
    spawnSync('bash', [script], { env: { PATH: process.env.PATH, ...keys, ...changed }, encoding: 'utf8' });

  it('passes all three', () => {
    assert.equal(run({}).status, 0);
  });

  it('names a key that is missing, and shows no value', () => {
    const result = run({ DEMO_R2_SECRET_ACCESS_KEY: '' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /demo-host has no DEMO_R2_SECRET_ACCESS_KEY/u);
    assert.doesNotMatch(result.stdout, /made-up/u);
  });

  it('refuses a sealing key that is not 32 bytes in hex, and shows no value', () => {
    const result = run({ DEMO_ARCHIVE_KEY: 'too-short' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /DEMO_ARCHIVE_KEY is not 32 bytes/u);
    assert.doesNotMatch(result.stdout, /too-short/u);
  });
});

describe('the check of a deployed server', () => {
  const script = fileURLToPath(new URL('check-demo-server.sh', import.meta.url));

  /** Runs it with made-up tools, where the host check passes on the try `passes` names. */
  function checked(passes) {
    const bin = folder('demo-check-');
    const tool = (name, body) => {
      writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`);
      chmodSync(join(bin, name), 0o755);
    };
    tool('sudo', 'echo flushed');
    tool('sleep', 'exit 0');
    tool('node', `echo "$*" >> "${bin}/asked"; [[ $(wc -l < "${bin}/asked") -eq ${passes} ]]`);
    const env = { PATH: `${bin}:${process.env.PATH}` };
    const result = spawnSync('bash', [script, 'https://made-up.example', '9.1.0'], { env, encoding: 'utf8' });
    return { result, asked: readFileSync(join(bin, 'asked'), 'utf8').trim().split('\n') };
  }

  it('tries again, emptying the DNS cache, until the check passes', () => {
    const { result, asked } = checked(3);
    assert.equal(result.status, 0);
    assert.equal(asked.length, 3);
    assert.equal(asked[0], 'apps/server/host/check.ts https://made-up.example 9.1.0');
    assert.equal(result.stdout.match(/flushed/gu)?.length, 3);
  });

  it('fails after about 20 minutes of tries', () => {
    const { result, asked } = checked(0);
    assert.equal(result.status, 1);
    assert.equal(asked.length, 40);
  });
});

describe('how the test APKs are signed', () => {
  const script = fileURLToPath(new URL('sign-test-apks.sh', import.meta.url));
  const CERTIFICATE = 'ab'.repeat(32);

  /** Runs the script in a made-up checkout, with made-up tools that say what `said` says. */
  function signed(said) {
    const root = folder('test-apks-');
    const tools = join(root, 'sdk/build-tools/9.9.9');
    const bin = join(root, 'bin');
    mkdirSync(tools, { recursive: true });
    mkdirSync(bin);
    const tool = (path, body) => {
      writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
      chmodSync(path, 0o755);
    };
    tool(join(bin, 'keytool'), 'exit 0');
    tool(
      join(tools, 'aapt2'),
      `echo "package: name='${said.app}' versionCode='1'"; sleep 0.2; echo "and a long list of more"`,
    );
    tool(
      join(tools, 'apksigner'),
      `if [[ $1 == sign ]]; then for ((i = 1; i <= $#; i++)); do
         if [[ \${!i} == --out ]]; then next=$((i + 1)); touch "\${!next}"; fi
       done; else echo "Signer: certificate SHA-256 digest: ${said.certificate}"; fi`,
    );
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ANDROID_HOME: join(root, 'sdk'),
      BUILD_TOOLS: '9.9.9',
      CERTIFICATE,
      TEST_APP: 'made.up.hostedtest',
      GITHUB_SHA: '0123456789abcdef',
      RUNNER_TEMP: root,
    };
    const result = spawnSync('bash', [script], { cwd: root, env, encoding: 'utf8' });
    return { result, root };
  }

  it('writes each APK under this run’s name, and leaves no key behind', () => {
    const { result, root } = signed({ app: 'made.up.hostedtest', certificate: 'cd'.repeat(32) });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readdirSync(join(root, 'test-apks')).sort(), [
      'minhajna-hosted-test-01234567-arm64-v8a.apk',
      'minhajna-hosted-test-01234567-armeabi-v7a.apk',
      'minhajna-hosted-test-01234567-universal.apk',
    ]);
    assert.equal(readdirSync(root).includes('throwaway.p12'), false);
  });

  it('fails an APK that is not the test app', () => {
    const { result } = signed({ app: 'made.up', certificate: 'cd'.repeat(32) });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /::error title=Test APK::.* is not made\.up\.hostedtest/u);
  });

  it('fails an APK that carries the project’s certificate', () => {
    const { result } = signed({ app: 'made.up.hostedtest', certificate: CERTIFICATE });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /carries the project's certificate/u);
  });
});

describe('the hosted test’s workflow', () => {
  const text = workflow('hosted-test');

  it('starts only by hand', () => {
    assert.match(text, /\non:\n {2}workflow_dispatch:\n\npermissions: \{\}\n/u);
  });

  it('never names a key of the release’s', () => {
    assert.doesNotMatch(text, /RELEASE_|release-signing/u);
  });

  it('names secrets only in the job the environment guards', () => {
    assert.match(job(text, 'deploy'), /\n {4}environment: demo-host\n/u);
    const outside = text.replace(job(text, 'deploy'), '');
    assert.doesNotMatch(outside, /secrets\.|environment:/u);
  });

  it('gives each job read access alone, and asks again before deploying', () => {
    assert.match(text, /\npermissions: \{\}\n/u);
    const blocks = [...text.matchAll(/^ {4}permissions:\n((?: {6}.*\n)+)/gmu)].map((match) => match[1]);
    assert.equal(blocks.length, 4 + 1);
    for (const block of blocks) assert.equal(block, '      contents: read\n');
    assert.equal(text.match(/\bpermissions:/gu)?.length, blocks.length + 1);
    const deploy = job(text, 'deploy');
    const asked = deploy.indexOf('tools/release/hosted-test.js');
    assert.notEqual(asked, -1);
    assert.ok(asked < deploy.indexOf('CLOUDFLARE_API_TOKEN'));
    const keys = deploy.indexOf('tools/release/check-demo-keys.sh');
    assert.notEqual(keys, -1);
    assert.ok(keys < deploy.indexOf('CLOUDFLARE_API_TOKEN'));
  });

  it('puts no expression in a `run:`', () => {
    const lines = text.split('\n');
    lines.forEach((line, at) => {
      const opened = /^( *)(?:- )?run: (.*)$/u.exec(line);
      if (opened === null) return;
      assert.doesNotMatch(opened[2] ?? '', /\$\{\{/u, `line ${at + 1}`);
      const depth = (opened[1] ?? '').length;
      for (let next = at + 1; next < lines.length; next++) {
        const inner = lines[next] ?? '';
        if (inner.trim() !== '' && inner.search(/\S/u) <= depth) break;
        assert.doesNotMatch(inner, /\$\{\{/u, `line ${next + 1}`);
      }
    });
  });

  it('pins actions by commit, to the commits of the workflows it follows', () => {
    const elsewhere = `${workflow('android')}${workflow('release')}`;
    const actions = [...text.matchAll(/uses: (\S+)/gu)].map((match) => match[1] ?? '');
    assert.ok(actions.length > 0);
    for (const action of actions) {
      assert.match(action, /@[0-9a-f]{40}$/u);
      assert.ok(elsewhere.includes(`uses: ${action}`), action);
    }
  });

  it('builds with the Android workflow’s tools and the release’s certificate', () => {
    const android = workflow('android');
    for (const name of ['BUILD_TOOLS', 'NDK', 'CMAKE', 'GRADLE_WRAPPER_SHA256']) {
      const pin = new RegExp(`\\n {2}${name}: (\\S+)\\n`, 'u');
      assert.ok(pin.exec(text)?.[1], name);
      assert.equal(pin.exec(text)?.[1], pin.exec(android)?.[1], name);
    }
    const certificate = /\n {2}CERTIFICATE: (\S+)\n/u;
    assert.ok(certificate.exec(text)?.[1]);
    assert.equal(certificate.exec(text)?.[1], certificate.exec(workflow('release'))?.[1]);
  });
});

describe('what a release does to the hosted test', () => {
  it('takes down the test web app by a name and an environment that both name it, never the teachers’', () => {
    const deploy = job(workflow('release'), 'deploy-server');
    assert.match(deploy, /wrangler delete minhajna-web-test --env test --force/u);
    assert.equal(deploy.match(/wrangler delete/gu)?.length, 1);
    const host = readFileSync(new URL('../../apps/web/host/wrangler.jsonc', import.meta.url), 'utf8');
    assert.match(host, /"test": \{\s+"name": "minhajna-web-test"/u);
    assert.match(host, /\n {2}"name": "minhajna-web",\n/u);
  });
});
