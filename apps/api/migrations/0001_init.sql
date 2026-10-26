-- Accounts, devices and sessions are schema only until real auth lands (see README).
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  account_id uuid NOT NULL REFERENCES accounts (id),
  id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts (id),
  device_id text NOT NULL,
  -- Only a hash of the refresh token is ever stored.
  token_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY (account_id, device_id) REFERENCES devices (account_id, id)
);

-- Current state per entity. data is the client payload (bigints as {"$bigint": "..."}), opaque here.
CREATE TABLE entities (
  account_id uuid NOT NULL REFERENCES accounts (id),
  type text NOT NULL CHECK (type IN ('person', 'group', 'expense', 'repayment', 'preference')),
  id text NOT NULL,
  data jsonb NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, type, id)
);

-- One row per applied op; pull cursors are positions in seq.
CREATE TABLE change_log (
  seq bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts (id),
  type text NOT NULL,
  id text NOT NULL,
  revision bigint NOT NULL,
  op_id text NOT NULL
);
CREATE INDEX change_log_account_seq ON change_log (account_id, seq);

-- Canonical ack per op, so a retried op gets the same answer and is never applied twice.
CREATE TABLE op_receipts (
  account_id uuid NOT NULL REFERENCES accounts (id),
  op_id text NOT NULL,
  ack jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, op_id)
);
