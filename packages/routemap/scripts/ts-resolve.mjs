/**
 * Let scripts import `src/*.ts` the way the app does.
 *
 * `src/` is written for a bundler, so its relative imports have no extension
 * (`from "./icon"`). Node's ESM resolver requires one, which is why a script could
 * previously only import a LEAF module with no relative imports of its own.
 *
 * This hook retries an extensionless relative specifier as `.ts`, so a generator can pull
 * in the real `codeToIcon`/`iconToCode` rather than a copy. That matters more than
 * convenience: a generated artefact built against a reimplementation of the encoder would
 * be wrong in ways nothing would report.
 *
 * Registered from the script itself via `module.register`, so it needs no extra flags
 * beyond `--experimental-strip-types`.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // Not a .ts file — fall through to the default resolution and its own error.
    }
  }
  return next(specifier, context);
}
