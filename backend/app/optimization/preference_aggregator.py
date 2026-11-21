"""
Student Preference Aggregation Module (preference_aggregator.py).
Aggregates closed and admin-approved student polls into normalized, batch-fair soft preferences
for integration into SmartGrid AI timetable optimization algorithms.
"""

from __future__ import annotations

from collections import defaultdict
import json
from typing import Any, Dict, List, Optional, Set

from app.database.supabase import SupabaseQueryError, require_supabase_client

ALLOWED_POLL_CATEGORIES = {
    "preferred_lecture_timing",
    "preferred_free_day",
    "lab_timing_preferences",
    "break_schedule_preference",
    "break_and_daily_schedule_preferences",
    "general_suggestion",
}


def compute_batch_preferences_from_records(
    polls: List[Dict[str, Any]],
    options: List[Dict[str, Any]],
    votes: List[Dict[str, Any]],
    batches: List[Dict[str, Any]],
    weights_influence: float = 0.65,
    low_participation_threshold: float = 25.0,
) -> Dict[str, Any]:
    """
    Pure, deterministic aggregation function that filters closed + admin-approved polls,
    tallies per-batch votes (preventing large batches from drowning out small batches),
    excludes zero-vote batches, dampens low-participation polls, resolves overlapping
    same-category polls, and outputs normalized batch preferences + full audit traceability.
    """
    weights_influence = max(0.0, min(1.0, float(weights_influence)))
    low_participation_threshold = max(1.0, float(low_participation_threshold))

    batch_student_counts = {str(b["id"]): max(1, int(b.get("student_count") or b.get("size") or 60)) for b in batches}
    options_by_poll: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for o in options:
        options_by_poll[str(o["poll_id"])].append(o)

    votes_by_poll: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for v in votes:
        votes_by_poll[str(v["poll_id"])].append(v)

    # Sort deterministically by newest closed_at/updated_at then poll_id
    sorted_polls = sorted(
        polls,
        key=lambda p: (
            str(p.get("closed_at") or p.get("updated_at") or p.get("created_at") or ""),
            str(p.get("id") or ""),
        ),
        reverse=True,
    )

    batch_preferences: Dict[str, Dict[str, Any]] = {}
    traceability: List[Dict[str, Any]] = []
    excluded: List[Dict[str, Any]] = []
    applied_category_best: Dict[tuple, float] = {}

    for poll in sorted_polls:
        p_id = str(poll["id"])
        p_status = str(poll.get("status") or "")
        p_approval = str(poll.get("optimizer_approval_status") or "pending_review")
        p_cat = str(poll.get("poll_category") or "general_suggestion").strip().lower()

        if p_status != "Closed":
            excluded.append({
                "pollId": p_id,
                "pollTitle": poll.get("title", ""),
                "pollCategory": p_cat,
                "reason": f"poll_status_not_closed ({p_status})",
            })
            continue

        if p_approval != "approved_for_optimizer":
            excluded.append({
                "pollId": p_id,
                "pollTitle": poll.get("title", ""),
                "pollCategory": p_cat,
                "reason": f"optimizer_approval_status_not_approved ({p_approval})",
            })
            continue

        if weights_influence <= 0.0:
            excluded.append({
                "pollId": p_id,
                "pollTitle": poll.get("title", ""),
                "pollCategory": p_cat,
                "reason": "voting_influence_disabled (0.0)",
            })
            continue

        target_scope = poll.get("target_scope") or "all_batches"
        target_batch_ids = poll.get("target_batch_ids") or []
        if isinstance(target_batch_ids, str):
            try:
                target_batch_ids = json.loads(target_batch_ids)
            except Exception:
                target_batch_ids = []

        poll_opts = options_by_poll.get(p_id, [])
        poll_votes = votes_by_poll.get(p_id, [])
        if not poll_opts or not poll_votes:
            excluded.append({
                "pollId": p_id,
                "pollTitle": poll.get("title", ""),
                "pollCategory": p_cat,
                "reason": "zero_votes_in_poll" if poll_opts else "missing_options",
            })
            continue

        # Count votes per batch AND globally, deduplicating student ballots defensively
        votes_by_option: Dict[str, int] = defaultdict(int)
        batch_votes: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        batch_participants: Dict[str, Set[str]] = defaultdict(set)
        seen_voters: Set[str] = set()

        for idx, v in enumerate(poll_votes):
            opt_id = str(v["option_id"])
            voter_id = str(v.get("student_user_id") or f"anon-{idx}")
            if v.get("student_user_id") and voter_id in seen_voters:
                continue
            seen_voters.add(voter_id)

            b_id = str(v.get("batch_id") or poll.get("batch_id") or "")
            votes_by_option[opt_id] += 1
            if b_id:
                batch_votes[b_id][opt_id] += 1
                batch_participants[b_id].add(voter_id)

        eligible_bids: List[str] = []
        if target_scope == "submitting_batch" and poll.get("batch_id"):
            eligible_bids = [str(poll["batch_id"])]
        elif target_scope == "selected_batches" and target_batch_ids:
            eligible_bids = [str(x) for x in target_batch_ids]
        else:
            eligible_bids = list(batch_student_counts.keys())

        opt_label_by_id = {str(o["id"]): str(o["label"]) for o in poll_opts}

        for b_id in eligible_bids:
            b_opt_counts = batch_votes.get(b_id, {})
            b_total_votes = sum(b_opt_counts.values())
            if b_total_votes == 0:
                excluded.append({
                    "pollId": p_id,
                    "pollTitle": poll.get("title", ""),
                    "pollCategory": p_cat,
                    "batchId": b_id,
                    "reason": "zero_votes_in_batch",
                })
                continue

            # Per-batch democratic winner (breaks exact ties deterministically by global votes then option id)
            b_win_opt_id = max(
                b_opt_counts.keys(),
                key=lambda oid: (b_opt_counts[oid], votes_by_option.get(oid, 0), oid),
            )
            winning_opt_label = opt_label_by_id.get(b_win_opt_id, "")
            b_win_votes = b_opt_counts[b_win_opt_id]
            win_percentage = round((b_win_votes / b_total_votes) * 100.0, 1)

            st_count = batch_student_counts.get(b_id, 60)
            parts = len(batch_participants.get(b_id, set()))
            part_pct = min(100.0, round((parts / max(1, st_count)) * 100.0, 1))
            is_low = part_pct < low_participation_threshold

            # Monotonic participation confidence: [0.15..1.0], halved when below threshold
            raw_conf = 0.15 + 0.85 * (part_pct / 100.0)
            confidence = round(min(1.0, raw_conf * (0.45 if is_low else 1.0)), 3)
            effective_strength = round(confidence * (win_percentage / 100.0) * weights_influence, 3)

            # Resolve overlapping polls in the same semantic category for the same batch
            norm_cat = "break_schedule_preference" if p_cat == "break_and_daily_schedule_preferences" else p_cat
            prev_strength = applied_category_best.get((b_id, norm_cat))
            if prev_strength is not None and effective_strength <= prev_strength:
                excluded.append({
                    "pollId": p_id,
                    "pollTitle": poll.get("title", ""),
                    "pollCategory": p_cat,
                    "batchId": b_id,
                    "reason": f"superseded_by_stronger_poll ({effective_strength} <= {prev_strength})",
                })
                continue
            applied_category_best[(b_id, norm_cat)] = effective_strength

            b_prefs = batch_preferences.setdefault(
                b_id,
                {
                    "batch_id": b_id,
                    "preferred_time_window": "balanced",
                    "avoid_early_8am": True,
                    "avoid_late_after_4pm": True,
                    "max_acceptable_gap_minutes": 60,
                    "preferred_free_day": None,
                    "preferred_lab_window": "afternoon",
                    "break_schedule_preference": "compact",
                    "preferenceStrength": 0.0,
                    "categoryStrengths": {},
                    "votingPreferenceScore": 100.0,
                    "source": "voting_poll",
                },
            )

            label_lower = winning_opt_label.lower()
            affected_dimension = norm_cat

            if norm_cat == "preferred_lecture_timing":
                if "morning" in label_lower or "9" in label_lower or "8" in label_lower:
                    b_prefs["preferred_time_window"] = "morning"
                    b_prefs["avoid_early_8am"] = False if "8" in label_lower else True
                elif "afternoon" in label_lower or "2" in label_lower or "14" in label_lower:
                    b_prefs["preferred_time_window"] = "afternoon"
                    b_prefs["avoid_late_after_4pm"] = False
                else:
                    b_prefs["preferred_time_window"] = "balanced"
            elif norm_cat == "preferred_free_day":
                for day_code in ("mon", "tue", "wed", "thu", "fri"):
                    if day_code in label_lower:
                        b_prefs["preferred_free_day"] = day_code.capitalize()
                        break
            elif norm_cat == "lab_timing_preferences":
                if "morning" in label_lower:
                    b_prefs["preferred_lab_window"] = "morning"
                elif "continuous" in label_lower or "3-hour" in label_lower:
                    b_prefs["preferred_lab_window"] = "continuous_block"
                elif "afternoon" in label_lower:
                    b_prefs["preferred_lab_window"] = "afternoon"
            elif norm_cat == "break_schedule_preference":
                if "compact" in label_lower or "minimum" in label_lower or "no gap" in label_lower:
                    b_prefs["break_schedule_preference"] = "compact"
                    b_prefs["max_acceptable_gap_minutes"] = 30
                else:
                    b_prefs["break_schedule_preference"] = "balanced"
                    b_prefs["max_acceptable_gap_minutes"] = 60

            b_prefs["categoryStrengths"][norm_cat] = effective_strength
            b_prefs["preferenceStrength"] = round(
                max(b_prefs["preferenceStrength"], effective_strength), 3
            )
            b_prefs["votingPreferenceScore"] = round(100.0 - (b_prefs["preferenceStrength"] * 15.0), 2)

            traceability.append(
                {
                    "pollId": p_id,
                    "pollTitle": poll.get("title", ""),
                    "pollCategory": p_cat,
                    "affectedDimension": affected_dimension,
                    "batchId": b_id,
                    "winningOption": winning_opt_label,
                    "winPercentage": win_percentage,
                    "participationPercentage": part_pct,
                    "participationConfidence": confidence,
                    "preferenceStrength": effective_strength,
                    "normalizedWeight": round(effective_strength, 3),
                    "isLowParticipation": is_low,
                    "votesInBatch": b_total_votes,
                    "enrolledInBatch": st_count,
                }
            )

    return {
        "batchPreferences": batch_preferences,
        "traceability": traceability,
        "excluded": excluded,
    }


def aggregate_approved_voting_preferences(
    institution_id: str,
    weights_influence: float = 0.65,
    low_participation_threshold: float = 25.0,
) -> Dict[str, Any]:
    """
    Fetches institution polls, computes participation confidence, option vote shares,
    and translates closed admin-approved polls into normalized batch preferences + traceability.
    """
    if not institution_id:
        return {"batchPreferences": {}, "traceability": [], "excluded": []}

    client = require_supabase_client()
    try:
        polls = client.select(
            "polls",
            filters={"institution_id": f"eq.{institution_id}"},
        )
        if not polls:
            return {"batchPreferences": {}, "traceability": [], "excluded": []}

        if any("optimizer_approval_status" not in p for p in polls):
            meta_rows = client.select(
                "feedback",
                filters={"institution_id": f"eq.{institution_id}", "category": "like.poll_meta:%"},
                order="created_at.desc",
            )
            meta_by_poll: Dict[str, Dict[str, Any]] = {}
            for mr in meta_rows:
                cat = str(mr.get("category") or "")
                pid = cat.split("poll_meta:", 1)[1] if cat.startswith("poll_meta:") else ""
                try:
                    parsed = json.loads(mr.get("comment") or "")
                except Exception:
                    parsed = None
                if pid and isinstance(parsed, dict) and pid not in meta_by_poll:
                    meta_by_poll[pid] = parsed
            for p in polls:
                m = meta_by_poll.get(p["id"])
                if m:
                    for k in ("poll_category", "target_batch_ids", "optimizer_approval_status", "optimizer_rejection_reason"):
                        if p.get(k) is None and m.get(k) is not None:
                            p[k] = m[k]

        approved_closed_ids = [
            p["id"]
            for p in polls
            if p.get("status") == "Closed" and p.get("optimizer_approval_status") == "approved_for_optimizer"
        ]
        if not approved_closed_ids:
            return compute_batch_preferences_from_records(
                polls=polls,
                options=[],
                votes=[],
                batches=[],
                weights_influence=weights_influence,
                low_participation_threshold=low_participation_threshold,
            )

        poll_ids_filter = f"in.({','.join(approved_closed_ids)})"
        options = client.select(
            "poll_options",
            filters={"poll_id": poll_ids_filter},
            select="id,poll_id,label,sort_order",
        )
        votes = client.select(
            "poll_votes",
            filters={"poll_id": poll_ids_filter},
            select="poll_id,option_id,student_user_id,batch_id",
        )
        batches = client.select(
            "batches",
            filters={"institution_id": f"eq.{institution_id}"},
            select="id,code,student_count",
        )
    except SupabaseQueryError:
        return {"batchPreferences": {}, "traceability": [], "excluded": []}

    return compute_batch_preferences_from_records(
        polls=polls,
        options=options,
        votes=votes,
        batches=batches,
        weights_influence=weights_influence,
        low_participation_threshold=low_participation_threshold,
    )

