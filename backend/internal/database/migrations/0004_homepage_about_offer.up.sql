-- =====================================================
-- 0004 — homepage About Us and What We Offer sections
--
-- The homepage redesign adds two structured sections beyond the existing
-- hero: "About Us" (a kicker/title/two body paragraphs plus three stat
-- facts) and "What We Offer" (a kicker/title/subtitle plus four pillars,
-- each with a short description and three bullet points).
--
-- The single-row hero fields (homepage_content) get the new kicker/about/
-- offer text columns alongside them — same admin-editable-singleton pattern
-- as hero_title etc. The repeatable pieces (facts, pillars) get their own
-- tables, following homepage_images' precedent for "a short list attached
-- to the one homepage". Pillar bullet points are JSONB, matching how the
-- rest of the schema stores small text lists (see form_fields.options).
-- =====================================================

ALTER TABLE homepage_content ADD COLUMN IF NOT EXISTS hero_kicker TEXT DEFAULT 'SKILL ASSESSMENT & LIVE LEARNING';
ALTER TABLE homepage_content ADD COLUMN IF NOT EXISTS about_kicker TEXT DEFAULT 'About Us';
ALTER TABLE homepage_content ADD COLUMN IF NOT EXISTS about_title TEXT DEFAULT 'Built by students who were tired of guessing.';
ALTER TABLE homepage_content ADD COLUMN IF NOT EXISTS about_body1 TEXT DEFAULT 'Skillture began in a university lab where nobody could answer a simple question: which skills does a graduate actually have on the day they walk into industry? Transcripts said one thing, hiring interviews said another, and the gap between them was where good people got lost.';
ALTER TABLE homepage_content ADD COLUMN IF NOT EXISTS about_body2 TEXT DEFAULT 'So we built the measurement layer we wanted for ourselves — a form builder for honest self-assessment in any language, and a live quiz engine that makes progress visible in the room. Today the same tooling runs cohort workshops, university programmes, and industry onboarding.';
ALTER TABLE homepage_content ADD COLUMN IF NOT EXISTS offer_kicker TEXT DEFAULT 'What We Offer';
ALTER TABLE homepage_content ADD COLUMN IF NOT EXISTS offer_title TEXT DEFAULT 'Four tracks, one journey.';
ALTER TABLE homepage_content ADD COLUMN IF NOT EXISTS offer_subtitle TEXT DEFAULT 'Every track uses the same two tools — forms to measure, live quizzes to practise — pointed at a different part of the leap from study to work.';

-- The hero copy on row 1 was always the 0001 baseline's placeholder text
-- ("Build Smarter Assessments" / "Get Started" / "Learn More"), never a real
-- admin edit. Bring it in line with the redesigned hero — but only while it
-- still matches that exact placeholder, so a deployment where an admin
-- already customised it is left alone.
UPDATE homepage_content
SET hero_title = 'From university to industry — one measured step at a time.',
    hero_subtitle = 'Skillture is the assessment platform behind student-led workshops: multilingual forms to capture what a cohort knows, and live PIN-joined quizzes to prove what they learned.',
    cta_primary_text = 'Start Your Journey',
    cta_secondary_text = 'See a Live Session'
WHERE id = 1
  AND hero_title = 'Build Smarter Assessments'
  AND cta_primary_text = 'Get Started'
  AND cta_secondary_text = 'Learn More';

-- =====================================================
-- Table: homepage_about_facts
-- The three stat tiles next to the About Us copy (e.g. "2,400+ Students
-- assessed"). display_order controls render order; ties break on id.
-- =====================================================
CREATE TABLE IF NOT EXISTS homepage_about_facts (
  id UUID PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO homepage_about_facts (id, value, label, display_order)
SELECT * FROM (VALUES
  (gen_random_uuid(), '2,400+', 'Students assessed across cohort programmes', 0),
  (gen_random_uuid(), '18', 'Partner universities and industry teams', 1),
  (gen_random_uuid(), '9', 'Languages supported in form and quiz labels', 2)
) AS seed(id, value, label, display_order)
WHERE NOT EXISTS (SELECT 1 FROM homepage_about_facts);

-- =====================================================
-- Table: homepage_offer_pillars
-- The four "What We Offer" cards (Technical / Career / Industry /
-- Business). points is a JSON array of short bullet strings, e.g.
-- ["Skill-gap diagnostics per stack", "Live code-concept quizzes", ...].
-- =====================================================
CREATE TABLE IF NOT EXISTS homepage_offer_pillars (
  id UUID PRIMARY KEY,
  num TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points JSONB NOT NULL DEFAULT '[]',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO homepage_offer_pillars (id, num, title, description, points, display_order)
SELECT * FROM (VALUES
  (gen_random_uuid(), '01', 'Technical', 'Close the distance between coursework and the codebase a team actually ships.',
    '["Skill-gap diagnostics per stack", "Live code-concept quizzes", "Progress tracked across a cohort"]'::jsonb, 0),
  (gen_random_uuid(), '02', 'Career', 'Turn a transcript into a story a hiring manager can read in a minute.',
    '["Strengths mapping from responses", "Interview drill sessions", "AI-summarised progress reports"]'::jsonb, 1),
  (gen_random_uuid(), '03', 'Industry', 'Meet the people who do the work, and find out what they wish you knew.',
    '["Practitioner-led workshops", "Real-brief case sessions", "Company onboarding assessments"]'::jsonb, 2),
  (gen_random_uuid(), '04', 'Business', 'Understand the commercial side that surrounds every technical decision.',
    '["Product and pricing fundamentals", "Stakeholder communication labs", "Team simulation quizzes"]'::jsonb, 3)
) AS seed(id, num, title, description, points, display_order)
WHERE NOT EXISTS (SELECT 1 FROM homepage_offer_pillars);
