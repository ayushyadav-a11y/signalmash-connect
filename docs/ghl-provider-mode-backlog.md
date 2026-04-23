# GHL Provider Mode Backlog

## Current Decision

As of 2026-04-18, the active delivery path for the Signalmash GHL integration is:

- Embedded Signalmash experience inside GHL custom pages
- OAuth install and account linking
- Brand, campaign, number, settings, and operational management from the embedded app

The native GHL SMS provider replacement path is deferred, not cancelled.

## Why It Was Deferred

The current GHL marketplace app installs correctly through OAuth, but Signalmash does not appear in agency or sub-account phone or conversation provider settings.

Observed validation results:

- Marketplace app category is `SMS`
- Sub-account `IPLIink` is installed and connected
- Sub-account phone settings do not expose Signalmash as a selectable SMS provider
- Agency phone integrations do not show a Signalmash provider entry

This strongly suggests the current app is configured as a marketplace OAuth/custom-pages app, not yet as a provider-class integration inside GHL.

## What Must Be Resolved Before Resuming Provider Mode

1. Confirm with GHL whether the existing app can be upgraded into:
   - a custom conversation provider
   - a telephony/SMS provider
   - or another provider-specific marketplace app type
2. Obtain the provider-specific contract from GHL:
   - provider registration requirements
   - required app settings
   - webhook contract
   - review/approval steps
   - where the provider should appear in agency and sub-account settings
3. Validate that Signalmash appears in GHL provider settings before resuming code work.

## Deferred Implementation Track

When provider mode is resumed, continue from this order:

1. Capture live GHL outbound payloads from native Conversations
2. Verify signature behavior:
   - `X-GHL-Signature`
   - legacy `X-WH-Signature`
3. Confirm sender selection rules from real provider payloads
4. Validate outbound send from native GHL Conversations through Signalmash
5. Validate inbound message posting back into GHL
6. Validate status sync back into GHL
7. Confirm mobile and workflow behavior under provider mode

## Existing Code To Reuse Later

The repo already contains provider-oriented groundwork that should be reused when this resumes:

- outbound queue ingestion from GHL provider-style webhooks
- incoming inbound/status event queues
- idempotent message persistence
- sender profile routing
- provider activation and installation readiness scaffolding
- GHL signature header compatibility handling

These pieces should be treated as dormant groundwork until GHL provider registration is confirmed.

## Active Delivery Path For Now

Until provider mode is enabled in GHL, the product should continue as:

- embedded onboarding inside GHL
- embedded brand registration
- embedded campaign registration
- embedded phone number purchase and management
- embedded compliance, billing, and ops visibility

Native provider replacement should not be presented as currently available.
