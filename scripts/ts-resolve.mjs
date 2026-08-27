// Lets node run the app's .ts sources directly with bundler-style
// extensionless imports, so tests and scripts exercise exactly what ships.
import { register } from "node:module"
import { pathToFileURL } from "node:url"
register("./ts-resolve-hooks.mjs", pathToFileURL("./scripts/"))
