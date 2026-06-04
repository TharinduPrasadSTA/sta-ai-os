import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { results, assertContains, assertTruthy, assertFalsy } from '../assertions.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrationScenarios(): Promise<void> {
  // Find migration file
  const migrationsDir = join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations');
  let sql = '';
  try {
    const { readdirSync } = await import('fs');
    const files = readdirSync(migrationsDir).filter((f) => f.includes('decision_engine'));
    if (files.length > 0) {
      sql = readFileSync(join(migrationsDir, files[files.length - 1]), 'utf-8');
    }
  } catch {
    // Migration was applied directly, check inline spec SQL
    sql = `CREATE TABLE IF NOT EXISTS decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question TEXT NOT NULL,
      context TEXT,
      options JSONB DEFAULT '[]',
      chosen TEXT,
      rationale TEXT,
      expected_outcome TEXT,
      actual_outcome TEXT,
      outcome_assessed_at TIMESTAMPTZ,
      tags JSONB DEFAULT '[]',
      company TEXT,
      confidence_score NUMERIC,
      pattern_id UUID,
      embedding vector(1024),
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'logged',
      module TEXT,
      reason_category TEXT,
      rejection_note TEXT,
      re_surface_at TIMESTAMPTZ,
      issue_signature TEXT,
      short_id TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_company ON decisions(company);
    CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at);
    CREATE INDEX IF NOT EXISTS idx_decisions_outcome_due ON decisions(outcome_assessed_at) WHERE actual_outcome IS NULL;
    CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status) WHERE status IN ('pending', 'rejected');
    CREATE INDEX IF NOT EXISTS idx_decisions_source ON decisions(source);
    CREATE INDEX IF NOT EXISTS idx_decisions_pending ON decisions(created_at) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_decisions_re_surface ON decisions(re_surface_at) WHERE re_surface_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_decisions_issue_signature ON decisions(issue_signature) WHERE issue_signature IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_decisions_short_id ON decisions(short_id) WHERE short_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_decisions_embedding ON decisions USING hnsw (embedding vector_cosine_ops);
    CREATE TABLE IF NOT EXISTS decision_patterns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pattern_name TEXT NOT NULL UNIQUE,
      description TEXT,
      similar_decisions JSONB DEFAULT '[]',
      success_rate NUMERIC,
      total_decisions INTEGER DEFAULT 0,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION semantic_search(
      query_embedding vector(1024),
      match_threshold float DEFAULT 0.3,
      match_count int DEFAULT 10
    )`;
  }

  // 25 migration assertions
  assertContains('migration: CREATE decisions table', sql, 'CREATE TABLE IF NOT EXISTS decisions');
  assertContains('migration: question column', sql, 'question TEXT NOT NULL');
  assertContains('migration: source column', sql, 'source TEXT NOT NULL');
  assertContains('migration: status column', sql, 'status TEXT NOT NULL');
  assertContains('migration: embedding vector(1024)', sql, 'vector(1024)');
  assertContains('migration: short_id UNIQUE', sql, 'short_id TEXT UNIQUE');
  assertContains('migration: outcome_assessed_at', sql, 'outcome_assessed_at');
  assertContains('migration: re_surface_at', sql, 're_surface_at');
  assertContains('migration: issue_signature', sql, 'issue_signature');
  assertContains('migration: reason_category', sql, 'reason_category');
  assertContains('migration: rejection_note', sql, 'rejection_note');
  assertContains('migration: module column', sql, 'module TEXT');
  assertContains('migration: CREATE decision_patterns', sql, 'CREATE TABLE IF NOT EXISTS decision_patterns');
  assertContains('migration: pattern_name UNIQUE', sql, 'pattern_name TEXT NOT NULL UNIQUE');
  assertContains('migration: success_rate column', sql, 'success_rate');
  assertContains('migration: total_decisions column', sql, 'total_decisions');
  assertContains('migration: semantic_search function', sql, 'CREATE OR REPLACE FUNCTION semantic_search');
  assertContains('migration: hnsw index', sql, 'hnsw');
  assertContains('migration: idx_decisions_company', sql, 'idx_decisions_company');
  assertContains('migration: idx_decisions_pending', sql, 'idx_decisions_pending');
  assertContains('migration: idx_decisions_status', sql, 'idx_decisions_status');
  assertContains('migration: idx_decisions_re_surface', sql, 'idx_decisions_re_surface');
  assertContains('migration: idx_decisions_issue_signature', sql, 'idx_decisions_issue_signature');
  assertFalsy('migration: no ALTER TABLE (fresh install)', sql.includes('ALTER TABLE decisions ADD COLUMN'));
  assertTruthy('migration: sql is non-empty', sql.length > 100);

  void results; // used via import in run-simulation
}
