import React from "react";
import Swal from "sweetalert2";
import { ensureRulesArray } from "../../../functions/stageRules";

export const MAX_STAGE_RULES = 6;
export const MAX_STAGE_RULE_LEN = 150;
export const STAGE_HEADING_MAX_LEN = 50;
export const STAGE_SUBHEADING_MAX_LEN = 200;

export function normalizeRulesFromTheme(raw) {
  const list = ensureRulesArray(raw);
  if (!list.length) return [""];
  return list.map((rule) => String(rule ?? "").slice(0, MAX_STAGE_RULE_LEN));
}

export function trimRulesForSave(rules) {
  return rules.map((r) => String(r ?? "").trim()).filter(Boolean);
}

export function validateStageHeadingSubheading(heading, subheading, stageLabel) {
  const h = String(heading ?? "").trim();
  const s = String(subheading ?? "").trim();
  if (!h) {
    return { ok: false, message: `${stageLabel} heading cannot be empty.` };
  }
  if (h.length > STAGE_HEADING_MAX_LEN) {
    return {
      ok: false,
      message: `${stageLabel} heading must be ${STAGE_HEADING_MAX_LEN} characters or fewer.`,
    };
  }
  if (!s) {
    return { ok: false, message: `${stageLabel} sub heading cannot be empty.` };
  }
  if (s.length > STAGE_SUBHEADING_MAX_LEN) {
    return {
      ok: false,
      message: `${stageLabel} sub heading must be ${STAGE_SUBHEADING_MAX_LEN} characters or fewer.`,
    };
  }
  return { ok: true, heading: h, subheading: s };
}

export function validateStageRules(rules, stageLabel) {
  if (!Array.isArray(rules) || !rules.length) {
    return { ok: false, message: `Please add at least one ${stageLabel} rule.` };
  }
  const trimmed = trimRulesForSave(rules);
  if (!trimmed.length) {
    return { ok: false, message: `Please add at least one ${stageLabel} rule.` };
  }
  if (rules.some((r) => !String(r ?? "").trim())) {
    return {
      ok: false,
      message: `Please fill in all ${stageLabel} rules or remove empty rows.`,
    };
  }
  const tooLong = rules.find((r) => String(r ?? "").trim().length > MAX_STAGE_RULE_LEN);
  if (tooLong) {
    return {
      ok: false,
      message: `Each ${stageLabel} rule must be ${MAX_STAGE_RULE_LEN} characters or fewer.`,
    };
  }
  return { ok: true, rules: trimmed };
}

export function validateStageHeadingSubheadingAndRules(
  heading,
  subheading,
  rules,
  stageLabel
) {
  const meta = validateStageHeadingSubheading(heading, subheading, stageLabel);
  if (!meta.ok) return meta;
  const rulesCheck = validateStageRules(rules, stageLabel);
  if (!rulesCheck.ok) return rulesCheck;
  return {
    ok: true,
    heading: meta.heading,
    subheading: meta.subheading,
    rules: rulesCheck.rules,
  };
}

export default function StageRulesEditor({
  stageLabel,
  rules,
  setRules,
  onSave,
  isSaving = false,
  saveLabel = "Save rules",
}) {
  const handleRuleChange = (idx, val) => {
    if (val.length > MAX_STAGE_RULE_LEN) {
      Swal.fire("Limit", `Each rule can be at most ${MAX_STAGE_RULE_LEN} characters.`, "warning");
      val = val.slice(0, MAX_STAGE_RULE_LEN);
    }
    const next = [...rules];
    next[idx] = val;
    setRules(next);
  };

  const handleAddRule = () => {
    if (rules.length >= MAX_STAGE_RULES) {
      Swal.fire("Limit", `Up to ${MAX_STAGE_RULES} rules per stage.`, "warning");
      return;
    }
    setRules([...rules, ""]);
  };

  const handleRemoveRule = (idx) => {
    if (rules.length <= 1) {
      Swal.fire("Required", "At least one rule field is required (can be left empty until you add text).", "warning");
      return;
    }
    setRules(rules.filter((_, i) => i !== idx));
  };

  return (
    <div className="themeupdate-panel-wide stage-rules-editor">
      <div className="themeupdate-card">
        <div className="themeupdate-card-body">
          <h4 className="themeupdate-label">{stageLabel} — How to play rules</h4>
          <p className="themeupdate-muted" style={{ marginTop: 0 }}>
            Shown when players tap the help (?) button on this stage.
          </p>
          <div className="themeupdate-rules-repeater">
            {rules.map((rule, i) => (
              <div key={i} className="themeupdate-rule-row rules-php-repeater-row">
                <textarea
                  className="themeupdate-input rules-php-textarea rules-php-repeater-textarea"
                  placeholder={`Rule ${i + 1}`}
                  maxLength={MAX_STAGE_RULE_LEN}
                  value={rule}
                  onChange={(e) => handleRuleChange(i, e.target.value)}
                />
                <button
                  type="button"
                  className="themeupdate-btn themeupdate-btn-danger"
                  onClick={() => handleRemoveRule(i)}
                  aria-label={`Remove rule ${i + 1}`}
                >
                  <i className="fa-solid fa-times" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="themeupdate-btn themeupdate-btn-primary themeupdate-add-rule"
              onClick={handleAddRule}
            >
              <i className="fa-solid fa-plus" /> Add rule
            </button>
            <p className="themeupdate-muted">
              <code>
                * Up to {MAX_STAGE_RULES} rules, {MAX_STAGE_RULE_LEN} characters each.
                {onSave ? "" : " Saved with this stage's content."}
              </code>
            </p>
            {onSave ? (
              <div className="stage-heading-save-wrap">
                <button
                  type="button"
                  className="qa-btn qa-btn-primary"
                  onClick={onSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving…" : saveLabel}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
