-- ============================================================================
-- Sprint 5: Correct the 25 broken seed rules
-- ============================================================================
-- The Sprint 3 schema refactor migrated 25 rules from payer_rules_legacy_v1
-- into payer_rules_drug (14 rows) and payer_rules_procedure (11 rows) with
-- placeholder names, wrong HCPCS codes, and no structured JSONB data.
--
-- This migration corrects every row with researched data:
--   Drug rules: fix drug_name, hcpcs_code (J7500→J0517, J0135→J0139),
--     add structured step_therapy_details, lab_requirements,
--     documentation_requirements from the v1 JSON seed files
--   Procedure rules: fix procedure_name, add documentation_requirements
--   All rules: confidence_score → 0.7, last_verified_date → 2026-04-09
--
-- Uses a single DO block so set_config(... , true) stays transaction-scoped
-- and the rule_audit_capture trigger logs every UPDATE with the right context.
--
-- HCPCS code corrections (verified against CMS HCPCS):
--   Dupixent (dupilumab): J7500 → J0517
--   Humira (adalimumab):  J0135 → J0139
--   Enbrel (etanercept):  J1438 (already correct)

DO $$
DECLARE
  v_drug_unknown int;
  v_proc_unknown int;
  v_low_confidence int;
BEGIN
  -- Set audit context for all UPDATEs in this transaction
  PERFORM set_config('app.audit_source', 'seed', true);
  PERFORM set_config('app.change_reason', 'Sprint 5: correct broken seed rules with researched payer data', true);
  PERFORM set_config('app.current_user_id', '', true);

  -- ========================================================================
  -- DRUG RULES
  -- ========================================================================

  -- ===== UnitedHealthcare — Dupixent (J7500 → J0517) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0517',
    drug_name = 'Dupixent (dupilumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Recent office visit note with ICD-10 diagnosis"},
      {"item": "BSA (body surface area) assessment", "required": true, "description": "Documented percentage of body affected"},
      {"item": "Prior treatment history", "required": true, "description": "List of treatments tried and failed including topicals and phototherapy"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening results required before biologic initiation"},
      {"item": "Photographs of affected areas", "required": false, "description": "Clinical photos showing severity"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["topical corticosteroid", "methotrexate OR cyclosporine"],
      "duration_days": 90,
      "exceptions": ["Documented contraindication to systemic immunosuppressants"]
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'UnitedHealthcare' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J7500' AND deleted_at IS NULL;

  -- ===== UnitedHealthcare — Humira (J0135 → J0139) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0139',
    drug_name = 'Humira (adalimumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Office visit note confirming plaque psoriasis diagnosis"},
      {"item": "BSA assessment", "required": true, "description": "BSA must be documented as moderate-to-severe (typically >10%)"},
      {"item": "Prior treatment history", "required": true, "description": "Documentation of failed conventional therapies"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening required"},
      {"item": "Hepatitis B/C screening", "required": true, "description": "Hepatitis panel results"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["methotrexate"],
      "duration_days": 90,
      "exceptions": ["Psoriatic arthritis with rheumatology referral may waive step therapy"]
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": true, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'UnitedHealthcare' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J0135' AND deleted_at IS NULL;

  -- ===== UnitedHealthcare — Enbrel (J1438, correct) =====
  UPDATE payer_rules_drug SET
    drug_name = 'Enbrel (etanercept)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Office visit note with psoriasis/psoriatic arthritis diagnosis"},
      {"item": "BSA assessment", "required": true, "description": "Documented body surface area involvement"},
      {"item": "Prior treatment history", "required": true, "description": "Failed conventional therapies documentation"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["methotrexate"],
      "duration_days": 90,
      "exceptions": ["Step therapy may be waived for psoriatic arthritis with rheumatology referral"]
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'UnitedHealthcare' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J1438' AND deleted_at IS NULL;

  -- ===== Aetna — Dupixent (J7500 → J0517, no ICD) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0517',
    drug_name = 'Dupixent (dupilumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Office visit note with atopic dermatitis diagnosis (L20.x)"},
      {"item": "BSA assessment", "required": true, "description": "Documented BSA involvement showing moderate-to-severe disease"},
      {"item": "Prior treatment history", "required": true, "description": "Failed at least one topical prescription therapy"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening before biologic initiation"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["medium-to-high potency topical corticosteroid"],
      "duration_days": 90,
      "exceptions": ["Documented contraindication to topical corticosteroids"]
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Aetna' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J7500' AND icd10_codes = '{}'::text[] AND deleted_at IS NULL;

  -- ===== Aetna — Dupixent (J7500 → J0517, with L20.9) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0517',
    drug_name = 'Dupixent (dupilumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting atopic dermatitis", "required": true, "description": "Confirmed diagnosis of atopic dermatitis L20.9"},
      {"item": "BSA assessment", "required": true, "description": "BSA showing moderate-to-severe involvement"},
      {"item": "EASI or IGA score", "required": true, "description": "Validated severity scoring (EASI >= 16 or IGA >= 3)"},
      {"item": "Prior treatment history", "required": true, "description": "Failed topical corticosteroids"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["topical corticosteroid"],
      "duration_days": 90,
      "exceptions": ["Documented contraindication to topical corticosteroids", "EASI >= 16 or IGA >= 3 required"]
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Aetna' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J7500' AND icd10_codes = '{L20.9}'::text[] AND deleted_at IS NULL;

  -- ===== Aetna — Humira (J0135 → J0139) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0139',
    drug_name = 'Humira (adalimumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Office visit note confirming psoriasis diagnosis"},
      {"item": "BSA assessment", "required": true, "description": "BSA >= 10% or involvement of face/hands/feet/genitalia"},
      {"item": "Prior treatment history", "required": true, "description": "Failed phototherapy or systemic therapy"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["methotrexate OR cyclosporine OR acitretin", "phototherapy"],
      "duration_days": 90,
      "exceptions": []
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Aetna' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J0135' AND deleted_at IS NULL;

  -- ===== BCBS — Dupixent (J7500 → J0517) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0517',
    drug_name = 'Dupixent (dupilumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Office visit note with atopic dermatitis diagnosis"},
      {"item": "BSA assessment", "required": true, "description": "Documented body surface area involvement"},
      {"item": "Prior treatment history", "required": true, "description": "Failed topical therapy and/or systemic immunosuppressant"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening before biologic"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["topical corticosteroid"],
      "duration_days": 90,
      "exceptions": ["Varies by state BCBS plan; some plans also require trial of systemic immunosuppressant"],
      "legacy_text": "Varies by state BCBS plan. Generally requires failure of topical corticosteroids."
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'BCBS' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J7500' AND deleted_at IS NULL;

  -- ===== BCBS — Humira (J0135 → J0139) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0139',
    drug_name = 'Humira (adalimumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Psoriasis diagnosis with severity assessment"},
      {"item": "BSA assessment", "required": true, "description": "BSA documentation"},
      {"item": "Prior treatment history", "required": true, "description": "Failed conventional systemic therapy"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening"},
      {"item": "Lab results - CBC and LFTs", "required": false, "description": "Baseline labs may be required by some plans"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["methotrexate OR phototherapy"],
      "duration_days": 90,
      "exceptions": [],
      "legacy_text": "Most BCBS plans require trial of methotrexate or phototherapy before biologic approval for psoriasis."
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": true, "liver_function": true}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'BCBS' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J0135' AND deleted_at IS NULL;

  -- ===== Cigna — Dupixent (J7500 → J0517) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0517',
    drug_name = 'Dupixent (dupilumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Atopic dermatitis diagnosis with severity"},
      {"item": "BSA assessment", "required": true, "description": "Moderate-to-severe AD (BSA >= 10% or significant face/hand involvement)"},
      {"item": "Prior treatment history", "required": true, "description": "Failed topical prescription therapy for >= 3 months"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["topical corticosteroid"],
      "duration_days": 90,
      "exceptions": ["Documented contraindication to topical corticosteroids"]
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Cigna' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J7500' AND deleted_at IS NULL;

  -- ===== Cigna — Humira (J0135 → J0139) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0139',
    drug_name = 'Humira (adalimumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Plaque psoriasis diagnosis"},
      {"item": "BSA assessment", "required": true, "description": "Moderate-to-severe (BSA >= 10%)"},
      {"item": "Prior treatment history", "required": true, "description": "Failed or contraindication to phototherapy or conventional systemic"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["methotrexate OR phototherapy"],
      "duration_days": 90,
      "exceptions": ["Documented contraindication"]
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Cigna' AND plan_type = 'Commercial'
    AND hcpcs_code = 'J0135' AND deleted_at IS NULL;

  -- ===== Medicare — Dupixent (J7500 → J0517, Traditional) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0517',
    drug_name = 'Dupixent (dupilumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting medical necessity", "required": true, "description": "Standard Medicare documentation requirements for medical necessity"}
    ]'::jsonb,
    step_therapy_details = NULL,
    lab_requirements = NULL,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Medicare' AND plan_type = 'Medicare'
    AND hcpcs_code = 'J7500' AND deleted_at IS NULL;

  -- ===== Medicare — Humira (J0135 → J0139, Traditional) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0139',
    drug_name = 'Humira (adalimumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting medical necessity", "required": true, "description": "Documentation supporting medical necessity for the biologic"}
    ]'::jsonb,
    step_therapy_details = NULL,
    lab_requirements = NULL,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Medicare' AND plan_type = 'Medicare'
    AND hcpcs_code = 'J0135' AND deleted_at IS NULL;

  -- ===== Medicare — Dupixent (J7500 → J0517, Medicare Advantage) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0517',
    drug_name = 'Dupixent (dupilumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Office visit note with atopic dermatitis diagnosis"},
      {"item": "BSA assessment", "required": true, "description": "Body surface area documentation"},
      {"item": "Prior treatment history", "required": true, "description": "Failed topical and/or systemic therapy"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening before biologic"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["topical corticosteroid"],
      "duration_days": 90,
      "exceptions": ["Varies by MA plan carrier"],
      "legacy_text": "Medicare Advantage plans typically require step therapy similar to commercial plans."
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Medicare' AND plan_type = 'Medicare Advantage'
    AND hcpcs_code = 'J7500' AND deleted_at IS NULL;

  -- ===== Medicare — Humira (J0135 → J0139, Medicare Advantage) =====
  UPDATE payer_rules_drug SET
    hcpcs_code = 'J0139',
    drug_name = 'Humira (adalimumab)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Psoriasis diagnosis and severity"},
      {"item": "BSA assessment", "required": true, "description": "BSA documentation"},
      {"item": "Prior treatment history", "required": true, "description": "Failed conventional systemic therapy"},
      {"item": "Lab results - TB test", "required": true, "description": "TB screening"}
    ]'::jsonb,
    step_therapy_details = '{
      "required_drugs": ["methotrexate OR conventional systemic"],
      "duration_days": 90,
      "exceptions": ["Check specific MA carrier requirements"],
      "legacy_text": "MA plans generally follow CMS guidelines but add their own step therapy requirements."
    }'::jsonb,
    lab_requirements = '{"tb_test": true, "hepatitis_panel": false, "cbc": false, "liver_function": false}'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Medicare' AND plan_type = 'Medicare Advantage'
    AND hcpcs_code = 'J0135' AND deleted_at IS NULL;

  -- ========================================================================
  -- PROCEDURE RULES
  -- ========================================================================

  -- ===== UnitedHealthcare — Mohs surgery (17311) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Mohs micrographic surgery, first stage',
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'UnitedHealthcare' AND plan_type = 'Commercial'
    AND cpt_code = '17311' AND deleted_at IS NULL;

  -- ===== UnitedHealthcare — Phototherapy (96910) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Photochemotherapy (Goeckerman/PUVA)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Confirmed diagnosis requiring phototherapy"},
      {"item": "Prior treatment history", "required": true, "description": "Documentation of failed topical therapies"},
      {"item": "Treatment plan", "required": true, "description": "Planned number of sessions and frequency"}
    ]'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'UnitedHealthcare' AND plan_type = 'Commercial'
    AND cpt_code = '96910' AND deleted_at IS NULL;

  -- ===== UnitedHealthcare — Patch testing (95044) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Patch or application test(s)',
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'UnitedHealthcare' AND plan_type = 'Commercial'
    AND cpt_code = '95044' AND deleted_at IS NULL;

  -- ===== Aetna — Mohs surgery (17311) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Mohs micrographic surgery, first stage',
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Aetna' AND plan_type = 'Commercial'
    AND cpt_code = '17311' AND deleted_at IS NULL;

  -- ===== Aetna — Phototherapy (96910) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Photochemotherapy (Goeckerman/PUVA)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Diagnosis requiring phototherapy (psoriasis, vitiligo, eczema)"},
      {"item": "Prior treatment history", "required": true, "description": "Failed topical therapy"},
      {"item": "Treatment plan", "required": true, "description": "Frequency and duration of planned phototherapy course"}
    ]'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Aetna' AND plan_type = 'Commercial'
    AND cpt_code = '96910' AND deleted_at IS NULL;

  -- ===== BCBS — Mohs surgery (17311) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Mohs micrographic surgery, first stage',
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'BCBS' AND plan_type = 'Commercial'
    AND cpt_code = '17311' AND deleted_at IS NULL;

  -- ===== BCBS — Phototherapy (96910) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Photochemotherapy (Goeckerman/PUVA)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting diagnosis", "required": true, "description": "Diagnosis requiring phototherapy"},
      {"item": "Prior treatment history", "required": true, "description": "Failed topical therapy"},
      {"item": "Treatment plan", "required": true, "description": "Number of sessions and treatment frequency"}
    ]'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'BCBS' AND plan_type = 'Commercial'
    AND cpt_code = '96910' AND deleted_at IS NULL;

  -- ===== Cigna — Mohs surgery (17311) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Mohs micrographic surgery, first stage',
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Cigna' AND plan_type = 'Commercial'
    AND cpt_code = '17311' AND deleted_at IS NULL;

  -- ===== Cigna — Phototherapy (96910) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Photochemotherapy (Goeckerman/PUVA)',
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Cigna' AND plan_type = 'Commercial'
    AND cpt_code = '96910' AND deleted_at IS NULL;

  -- ===== Medicare — Mohs surgery (17311) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Mohs micrographic surgery, first stage',
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Medicare' AND plan_type = 'Medicare'
    AND cpt_code = '17311' AND deleted_at IS NULL;

  -- ===== Medicare — Phototherapy (96910) =====
  UPDATE payer_rules_procedure SET
    procedure_name = 'Photochemotherapy (Goeckerman/PUVA)',
    documentation_requirements = '[
      {"item": "Clinical notes documenting medical necessity", "required": true, "description": "Diagnosis and treatment plan documentation"}
    ]'::jsonb,
    confidence_score = 0.7,
    last_verified_date = '2026-04-09'
  WHERE payer_name = 'Medicare' AND plan_type = 'Medicare'
    AND cpt_code = '96910' AND deleted_at IS NULL;

  -- ========================================================================
  -- VERIFICATION
  -- ========================================================================
  -- Fail the migration if any rules still have placeholder names or old
  -- confidence scores. This guarantees all 25 rows were updated.

  SELECT count(*) INTO v_drug_unknown FROM payer_rules_drug
      WHERE drug_name LIKE 'UNKNOWN%' AND deleted_at IS NULL;
    SELECT count(*) INTO v_proc_unknown FROM payer_rules_procedure
      WHERE procedure_name LIKE 'UNKNOWN%' AND deleted_at IS NULL;
    SELECT count(*) INTO v_low_confidence FROM (
      SELECT 1 FROM payer_rules_drug WHERE confidence_score = 0.5 AND deleted_at IS NULL
      UNION ALL
      SELECT 1 FROM payer_rules_procedure WHERE confidence_score = 0.5 AND deleted_at IS NULL
    ) sub;

  IF v_drug_unknown > 0 OR v_proc_unknown > 0 THEN
    RAISE EXCEPTION 'Sprint 5 migration incomplete: % drug + % procedure rules still have UNKNOWN names',
      v_drug_unknown, v_proc_unknown;
  END IF;

  IF v_low_confidence > 0 THEN
    RAISE EXCEPTION 'Sprint 5 migration incomplete: % rules still have confidence_score = 0.5',
      v_low_confidence;
  END IF;

END $$;
