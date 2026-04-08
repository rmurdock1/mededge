-- PA activity log
-- Audit trail for all actions taken on prior authorizations.
-- Required for compliance and debugging.

CREATE TABLE pa_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prior_auth_id uuid NOT NULL REFERENCES prior_auths (id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  user_id uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for viewing activity on a specific PA
CREATE INDEX idx_pa_activity_log_prior_auth ON pa_activity_log (prior_auth_id);
CREATE INDEX idx_pa_activity_log_user ON pa_activity_log (user_id);
