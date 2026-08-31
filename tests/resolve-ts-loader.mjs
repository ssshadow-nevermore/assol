import { extname } from "node:path";

export async function resolve(specifier, context, defaultResolve) {
  if ((specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/")) && !extname(specifier)) {
    try {
      return await defaultResolve(`${specifier}.ts`, context, defaultResolve);
    } catch {
      // Let Node report the original resolution error for non-TypeScript imports.
    }
  }
  return defaultResolve(specifier, context, defaultResolve);
}
