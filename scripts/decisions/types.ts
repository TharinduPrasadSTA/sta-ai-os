export type DecisionSource = 'manual' | 'ai-recommendation' | 'telegram-capture';
export type DecisionStatus = 'logged' | 'pending' | 'accepted' | 'rejected' | 'expired';
export type RejectionCategory =
  | 'disagree'
  | 'no-time'
  | 'redundant'
  | 'wrong-context'
  | 'later';

export interface DecisionRow {
  id: string;
  question: string;
  context: string | null;
  options: string[];
  chosen: string | null;
  rationale: string | null;
  expected_outcome: string | null;
  actual_outcome: string | null;
  outcome_assessed_at: string | null;
  tags: string[];
  company: string | null;
  confidence_score: number | null;
  pattern_id: string | null;
  embedding: number[] | null;
  source: DecisionSource;
  status: DecisionStatus;
  module: string | null;
  reason_category: RejectionCategory | null;
  rejection_note: string | null;
  re_surface_at: string | null;
  issue_signature: string | null;
  short_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SimilarDecision {
  id: string;
  short_id: string | null;
  question: string;
  chosen: string | null;
  rationale: string | null;
  status: DecisionStatus;
  source: DecisionSource;
  reason_category: RejectionCategory | null;
  actual_outcome: string | null;
  company: string | null;
  similarity: number;
  created_at: string;
}

export interface PendingRec {
  id: string;
  short_id: string | null;
  question: string;
  rationale: string | null;
  created_at: string;
  module: string | null;
}

export interface ReviewRow {
  id: string;
  short_id: string | null;
  question: string;
  chosen: string | null;
  expected_outcome: string | null;
  outcome_assessed_at: string;
}

export interface RevisitRow {
  id: string;
  short_id: string | null;
  question: string;
  chosen: string | null;
  re_surface_at: string;
}
