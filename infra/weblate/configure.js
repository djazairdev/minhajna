// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sets up Minhajna's project in a Weblate instance through its API, from
// project.json and component.json beside this file, so that every instance
// is set up the same way (README.md). Running it again updates the settings.
//
//   WEBLATE_URL=http://127.0.0.1:8080 WEBLATE_TOKEN=… \
//   REPOSITORY=https://github.com/djazairdev/minhajna.git \
//   PUSH=<where Weblate pushes> node infra/weblate/configure.js

import { readFile } from 'node:fs/promises';

/** The texts that are the same in every language, which no one translates: the brand and the language names. */
const READ_ONLY = ['name', 'latinName', 'language.ar', 'language.fr', 'language.en'];

const { WEBLATE_URL, WEBLATE_TOKEN, REPOSITORY, PUSH } = process.env;

/** Reads one of the settings files beside this script. */
async function settings(file) {
  return JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
}

/** Calls Weblate's API, and returns the parsed answer, or null when there is nothing at the address. */
async function api(method, path, body) {
  const response = await fetch(new URL(`/api/${path}`, WEBLATE_URL), {
    method,
    headers: { Authorization: `Token ${WEBLATE_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

/** Creates the project, or brings its settings up to date. */
async function project(values) {
  if (await api('GET', `projects/${values.slug}/`)) return api('PATCH', `projects/${values.slug}/`, values);
  return api('POST', 'projects/', values);
}

/** Creates the component, or brings its settings up to date, with the repository's addresses filled in. */
async function component(projectSlug, values, linkedTo) {
  const filled =
    linkedTo === undefined
      ? { ...values, repo: REPOSITORY, push: PUSH ?? REPOSITORY }
      : { ...values, repo: `weblate://${projectSlug}/${linkedTo}` };
  const path = `components/${projectSlug}/${values.slug}/`;
  if (await api('GET', path)) return api('PATCH', path, filled);
  return api('POST', `projects/${projectSlug}/components/`, filled);
}

/** The source language's texts, once Weblate has read the repository, which it does in the background. */
async function sourceUnits(projectSlug, componentSlug, language) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const page = await api('GET', `translations/${projectSlug}/${componentSlug}/${language}/units/?page_size=1000`);
    if (page?.results.length) return page.results;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Weblate has not read the repository after a minute: see its logs.');
}

/**
 * The flags a source text needs. The texts that stay the same in every
 * language are read-only, so that no one changes them by mistake. Counted
 * texts skip Weblate's placeholder check, which expects {{count}} in every
 * form and so flags each translation of Arabic's forms without a number;
 * the catalogue test checks their placeholders instead.
 */
function flags(unit) {
  if (READ_ONLY.includes(unit.context)) return 'read-only';
  if (unit.source.length > 1) return 'ignore-i18next-interpolation';
  return '';
}

/** Sets each source text's flags, after checking that every read-only text is there. */
async function flag(units, required = READ_ONLY) {
  const found = units.filter((unit) => required.includes(unit.context));
  if (found.length !== required.length) throw new Error(`Expected ${required.join(', ')} in the source.`);
  for (const unit of units) {
    if (unit.extra_flags !== flags(unit)) await api('PATCH', `units/${unit.id}/`, { extra_flags: flags(unit) });
  }
}

/** Checks the environment, then sets up the project and the component. */
async function main() {
  if (!WEBLATE_URL || !WEBLATE_TOKEN || !REPOSITORY) {
    throw new Error('Set WEBLATE_URL, WEBLATE_TOKEN and REPOSITORY, and PUSH if Weblate pushes elsewhere.');
  }
  const projectValues = await settings('./project.json');
  const componentValues = await settings('./component.json');
  const namespaces = await settings('./namespaces.json');
  await project(projectValues);
  const components = [componentValues, ...namespaces.map((namespace) => ({ ...componentValues, ...namespace }))];
  for (const [index, values] of components.entries()) {
    await component(projectValues.slug, values, index === 0 ? undefined : componentValues.slug);
    const units = await sourceUnits(projectValues.slug, values.slug, values.source_language);
    await flag(units, index === 0 ? READ_ONLY : []);
    console.log(`Set up ${WEBLATE_URL}/projects/${projectValues.slug}/${values.slug}/`);
  }
}

await main();
