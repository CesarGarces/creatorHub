import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

export function renderTemplate<T extends Record<string, unknown>>(
  name: string,
  data: T,
): string {
  let template = templateCache.get(name);

  if (!template) {
    const templatePath = join(__dirname, `${name}.hbs`);
    const source = readFileSync(templatePath, "utf-8");
    template = Handlebars.compile(source);
    templateCache.set(name, template);
  }

  return template(data);
}
