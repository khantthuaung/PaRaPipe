import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const lectures = sqliteTable("lectures", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  title: text("title").notNull(),
  transcript: text("transcript").notNull(),
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull(),
  duration: integer("duration").notNull().default(0),
  audioKey: text("audio_key"),
});

export const subjects = sqliteTable("subjects", {
  name: text("name").primaryKey(),
  createdAt: text("created_at").notNull(),
});
