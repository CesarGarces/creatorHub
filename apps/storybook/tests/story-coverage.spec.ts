import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { EXEMPT, PENDING_STORIES, STORY_ROOTS } from "../story-coverage.config";

/**
 * "Every component has a story" — fails when a component is added (or moved)
 * without its Storybook story, and keeps every story file well-formed:
 * a title, the component, a description for each documented prop and at
 * least one story.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const storybookDir = path.resolve(here, "..");
const repoRoot = path.resolve(storybookDir, "../..");
const storiesDir = path.join(storybookDir, "stories");

const toPosix = (p: string) => p.split(path.sep).join("/");

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "node_modules"
        ? []
        : walk(full);
    }
    return [full];
  });
}

/** Component files (repo-relative) and the story each one needs. */
const components = STORY_ROOTS.flatMap((root) =>
  walk(path.join(repoRoot, root.source))
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".stories.tsx"))
    .map((file) => {
      const fromRoot = path.relative(path.join(repoRoot, root.source), file);
      return {
        file: toPosix(path.relative(repoRoot, file)),
        story: toPosix(
          path.join(
            "stories",
            root.stories,
            fromRoot.replace(/\.tsx$/, ".stories.tsx"),
          ),
        ),
      };
    }),
);

const storyFiles = walk(storiesDir)
  .filter((file) => /\.stories\.tsx?$/.test(file))
  .map((file) => toPosix(path.relative(storybookDir, file)));

const hasStory = (story: string) =>
  fs.existsSync(path.join(storybookDir, story));

/** Fails listing every offending entry (arrays get truncated in diffs). */
function expectNone(list: string[], message: string): void {
  expect(list.length === 0, `${message}:\n  - ${list.join("\n  - ")}`).toBe(
    true,
  );
}

describe("story coverage", () => {
  it("finds the component roots", () => {
    expect(components.length).toBeGreaterThan(50);
  });

  it("every component has a story", () => {
    const missing = components
      .filter(
        (c) =>
          !hasStory(c.story) &&
          !(c.file in EXEMPT) &&
          !PENDING_STORIES.includes(c.file),
      )
      .map((c) => `${c.file}  →  create apps/storybook/${c.story}`);
    expectNone(
      missing,
      "New components need a Storybook story (see apps/storybook/stories/Introduction.mdx)",
    );
  });

  it("the pending list only holds existing components without stories", () => {
    const known = new Set(components.map((c) => c.file));
    const stale = PENDING_STORIES.filter((file) => {
      const component = components.find((c) => c.file === file);
      return !known.has(file) || (component && hasStory(component.story));
    });
    expectNone(
      stale,
      "Remove these from PENDING_STORIES in story-coverage.config.ts (story written or file gone)",
    );
  });

  it("exempt entries exist and are not also pending", () => {
    const known = new Set(components.map((c) => c.file));
    for (const [file, reason] of Object.entries(EXEMPT)) {
      expect(known.has(file), `${file} does not exist`).toBe(true);
      expect(reason.length, `${file} needs a reason`).toBeGreaterThan(10);
      expect(PENDING_STORIES).not.toContain(file);
    }
  });

  it("every story file belongs to a component", () => {
    const expected = new Set(components.map((c) => c.story));
    const orphans = storyFiles.filter((story) => !expected.has(story));
    expectNone(orphans, "Stories must mirror a component file path");
  });
});

// ─── Story file contents ─────────────────────────────────────────────────

interface StoryFileInfo {
  title?: string;
  hasComponent: boolean;
  undocumentedArgs: string[];
  storyExports: string[];
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isSatisfiesExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(name: ts.PropertyName): string {
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : name.getText();
}

function getProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | undefined {
  for (const prop of object.properties) {
    if (ts.isPropertyAssignment(prop) && propertyName(prop.name) === name) {
      return unwrap(prop.initializer);
    }
    if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === name) {
      return prop.name;
    }
  }
  return undefined;
}

function inspectStoryFile(file: string): StoryFileInfo {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const variables = new Map<string, ts.Expression>();
  const info: StoryFileInfo = {
    hasComponent: false,
    undocumentedArgs: [],
    storyExports: [],
  };
  let metaExpression: ts.Expression | undefined;

  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      const exported = statement.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        variables.set(decl.name.text, unwrap(decl.initializer));
        if (exported) info.storyExports.push(decl.name.text);
      }
    }
    if (ts.isExportAssignment(statement)) {
      const expr = unwrap(statement.expression);
      metaExpression = ts.isIdentifier(expr) ? variables.get(expr.text) : expr;
    }
  }

  if (metaExpression && ts.isObjectLiteralExpression(metaExpression)) {
    const title = getProperty(metaExpression, "title");
    if (title && ts.isStringLiteralLike(title)) info.title = title.text;
    info.hasComponent = getProperty(metaExpression, "component") !== undefined;

    const argTypes = getProperty(metaExpression, "argTypes");
    if (argTypes && ts.isObjectLiteralExpression(argTypes)) {
      for (const prop of argTypes.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const value = unwrap(prop.initializer);
        const documented =
          ts.isObjectLiteralExpression(value) &&
          getProperty(value, "description") !== undefined;
        if (!documented) info.undocumentedArgs.push(propertyName(prop.name));
      }
    }
  }
  return info;
}

describe("story files", () => {
  const inspected = storyFiles.map((story) => ({
    story,
    info: inspectStoryFile(path.join(storybookDir, story)),
  }));

  it.each(inspected.map((i) => [i.story, i.info] as const))(
    "%s has a title, its component, documented props and stories",
    (story, info) => {
      expect(info.title, `${story}: meta.title`).toBeTruthy();
      expect(info.hasComponent, `${story}: meta.component`).toBe(true);
      expectNone(
        info.undocumentedArgs,
        `${story}: argTypes without a description`,
      );
      expect(
        info.storyExports.length,
        `${story}: at least one exported story`,
      ).toBeGreaterThan(0);
    },
  );

  it("story titles are unique", () => {
    const titles = inspected.map((i) => i.info.title);
    const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
    expectNone(duplicates as string[], "Duplicate story titles");
  });
});
