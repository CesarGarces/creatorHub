import { createHash } from "crypto";
import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import {
  topKBySimilarity,
  type ResolvedEmbedder,
} from "@creator-hub/ai-engine";
import { formatMinutes } from "./planning-prompt";

/** Source type of the per-project digests in ContentKnowledgeChunk. */
export const PROJECT_SOURCE = "project";
/** Past productions kept in the index (most recent first). */
export const MAX_INDEXED_PROJECTS = 50;

const TYPE_LABELS: Record<string, string> = {
  IDEATION: "Ideation",
  SCRIPTING: "Scripting",
  RECORDING: "Recording",
  EDITING: "Editing",
  THUMBNAIL: "Thumbnail",
  PUBLISHING: "Publishing",
  LIVESTREAM: "Livestream",
  OTHER: "Other",
};

/** What the index knows about one past production. */
export interface ProjectDigest {
  projectId: string;
  title: string;
  totalMinutes: number;
  sessions: number;
  /**
   * What the video is about (title + notes): the text that gets embedded.
   * The production breakdown is left out on purpose — it reads alike for
   * every project and would make unrelated videos look similar.
   */
  topic: string;
  /** Full summary (topic + production breakdown), stored and shown to the model. */
  text: string;
}

interface ProjectRow {
  id: string;
  title: string;
  platform: string | null;
  notes: string | null;
  customPlatform: { name: string } | null;
  events: {
    type: string;
    status: string;
    startAt: Date;
    endAt: Date;
    customType: { name: string } | null;
  }[];
}

/** Summary of a production used for similarity search and as evidence. */
export function digestProject(project: ProjectRow): ProjectDigest | null {
  const sessions = project.events.filter((e) => e.status !== "CANCELLED");
  if (sessions.length === 0) return null;
  const parts = sessions.map((e) => {
    const minutes = Math.round(
      (e.endAt.getTime() - e.startAt.getTime()) / 60_000,
    );
    const label = e.customType?.name ?? TYPE_LABELS[e.type] ?? e.type;
    return `${label} ${formatMinutes(minutes)}${e.status === "DONE" ? " (done)" : ""}`;
  });
  const totalMinutes = sessions.reduce(
    (sum, e) =>
      sum + Math.round((e.endAt.getTime() - e.startAt.getTime()) / 60_000),
    0,
  );
  const platform = project.customPlatform?.name ?? project.platform;
  const notes = project.notes?.trim().slice(0, 300);
  const topic = notes ? `${project.title}. ${notes}` : project.title;
  const text = [
    `Video "${project.title}"${platform ? ` for ${platform}` : ""}.`,
    project.notes ? `Notes: ${project.notes.slice(0, 300)}` : "",
    `Production: ${parts.join(", ")}.`,
    `Total: ${formatMinutes(totalMinutes)} across ${sessions.length} sessions.`,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    projectId: project.id,
    title: project.title,
    totalMinutes,
    sessions: sessions.length,
    topic,
    text,
  };
}

export const hashText = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/**
 * The planner's vector store: one embedded digest per past production of
 * the user, kept in sync incrementally (a project is re-embedded only when
 * its topic changes) and searched by cosine similarity. Vectors are scoped
 * by user and by embedding model; switching models rebuilds the index.
 */
@Injectable()
export class KnowledgeIndexService {
  async syncProjectHistory(
    userId: string,
    embedder: ResolvedEmbedder,
  ): Promise<{ digests: Map<string, ProjectDigest>; embedded: number }> {
    const projects = await prisma.contentProject.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_INDEXED_PROJECTS,
      select: {
        id: true,
        title: true,
        platform: true,
        notes: true,
        customPlatform: { select: { name: true } },
        events: {
          select: {
            type: true,
            status: true,
            startAt: true,
            endAt: true,
            customType: { select: { name: true } },
          },
          orderBy: { startAt: "asc" },
        },
      },
    });
    const digests = new Map<string, ProjectDigest>();
    for (const project of projects) {
      const digest = digestProject(project);
      if (digest) digests.set(digest.projectId, digest);
    }

    const existing = await prisma.contentKnowledgeChunk.findMany({
      where: {
        userId,
        sourceType: PROJECT_SOURCE,
        embeddingModel: embedder.modelKey,
      },
      select: { id: true, sourceId: true, contentHash: true, content: true },
    });
    const stored = new Map(existing.map((c) => [c.sourceId, c]));

    const changed = [...digests.values()].filter(
      (d) => stored.get(d.projectId)?.contentHash !== hashText(d.topic),
    );
    if (changed.length > 0) {
      const vectors = await embedder.embed(changed.map((d) => d.topic));
      for (const [i, digest] of changed.entries()) {
        const data = {
          content: digest.text,
          contentHash: hashText(digest.topic),
          embedding: vectors[i]!,
        };
        await prisma.contentKnowledgeChunk.upsert({
          where: {
            chunkSource: {
              userId,
              sourceType: PROJECT_SOURCE,
              sourceId: digest.projectId,
              embeddingModel: embedder.modelKey,
            },
          },
          create: {
            userId,
            sourceType: PROJECT_SOURCE,
            sourceId: digest.projectId,
            embeddingModel: embedder.modelKey,
            ...data,
          },
          update: data,
        });
      }
    }

    // Same topic, new sessions: refresh the stored summary without paying
    // for a new embedding.
    const changedIds = new Set(changed.map((d) => d.projectId));
    for (const digest of digests.values()) {
      const row = stored.get(digest.projectId);
      if (
        row &&
        !changedIds.has(digest.projectId) &&
        row.content !== digest.text
      ) {
        await prisma.contentKnowledgeChunk.update({
          where: { id: row.id },
          data: { content: digest.text },
        });
      }
    }

    // Deleted (or emptied) productions leave the index, and so do vectors of
    // a previous embedding model (they can never be compared with new ones).
    const stale = existing
      .filter((c) => !digests.has(c.sourceId))
      .map((c) => c.id);
    await prisma.contentKnowledgeChunk.deleteMany({
      where: {
        userId,
        sourceType: PROJECT_SOURCE,
        OR: [
          ...(stale.length > 0 ? [{ id: { in: stale } }] : []),
          { embeddingModel: { not: embedder.modelKey } },
        ],
      },
    });
    return { digests, embedded: changed.length };
  }

  async findSimilarProjects(
    userId: string,
    embedder: ResolvedEmbedder,
    query: number[],
    k = 3,
    minScore = embedder.minSimilarity,
  ): Promise<{ projectId: string; score: number }[]> {
    const rows = await prisma.contentKnowledgeChunk.findMany({
      where: {
        userId,
        sourceType: PROJECT_SOURCE,
        embeddingModel: embedder.modelKey,
      },
      select: { sourceId: true, embedding: true },
    });
    return topKBySimilarity(query, rows, (r) => r.embedding, k, minScore).map(
      (s) => ({
        projectId: s.item.sourceId,
        score: s.score,
      }),
    );
  }
}
