CREATE TABLE IF NOT EXISTS detections (
  id TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  frp REAL,
  conf TEXT,
  sat TEXT NOT NULL,
  daynight TEXT,
  acq_ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS detections_acq_ts ON detections (acq_ts);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
