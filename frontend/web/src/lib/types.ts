export type UserOut = {
  id: number;
  email: string;
  coins: number;
  wrong_streak: number;
  wrong_total: number;
  suspended_until: string | null;
  dismissed: boolean;
  locality_code: string | null;
};

export type PostOut = {
  id: number;
  reporter_id: number;
  reporter_email: string;
  text: string;
  image_path: string | null;
  lat: number;
  lon: number;
  locality_code: string;
  created_at: string;
  expires_at: string;
  upvotes_count: number;
  downvotes_count: number;
  hidden: boolean;
  moderation_status: string;
  negative_comments_count: number;

  validation_matches?: boolean | null;
  validation_confidence?: number | null;
  validation_reasoning?: string | null;
  validation_flags?: string[] | null;
};

export type CommentOut = {
  id: number;
  user_id: number;
  text: string;
  is_negative: boolean;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
};

export type ValidationResult = {
  matches: boolean;
  confidence: number;
  reasoning: string;
  flags: string[];
};

export type PostCreateResponse = {
  post_id?: number | null;
  validation?: ValidationResult | null;
};


