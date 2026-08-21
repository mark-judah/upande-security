// TEMPORARY: kaitet-group.upande.com production doesn't have the Visitor
// Badge feature rolled out yet, so gating visitor check-in on "badge issued"
// (added for the badge feature) blocks every visitor there. Flip this back
// to `true` and publish an OTA update once badges are ready on production —
// that's the only change needed to re-enable the feature.
export const VISITOR_BADGE_ENABLED = false;
