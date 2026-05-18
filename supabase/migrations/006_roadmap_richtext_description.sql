-- =====================================================================
-- Migration 006 — roadmap_items.description: text → jsonb (TipTap doc)
--
-- The roadmap description was originally a plain text column for short
-- one-or-two-sentence summaries, paired with a <textarea> in the admin
-- form. In practice admins want to paste longer formatted content
-- (bullets, headings, bold) — same treatment patch notes already gets.
--
-- This migration converts the column to jsonb so it holds a TipTap doc,
-- preserving any existing text rows as a single paragraph TipTap node.
--
-- Run in the Supabase SQL editor AFTER migration 005.
-- =====================================================================

alter table roadmap_items
  alter column description type jsonb
  using case
    when description is null then null
    when description = '' then null
    else jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', description)
          )
        )
      )
    )
  end;
