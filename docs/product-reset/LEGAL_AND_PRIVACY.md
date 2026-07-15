# Public legal and privacy surface

**Status:** implemented for the closed development pilot; public cutover remains blocked on owner identity, durable contact details, and legal review.  
**Last reviewed against provider documentation:** July 12, 2026.

## Implemented pages

- `/terms` describes the development-stage service, explicit group consent, user contributions,
  Google-powered place content, acceptable use, account deletion, and pilot availability.
- `/privacy` describes every canonical personal-data class, exact audiences, providers, local
  persistence, retention, export, deletion, and the absence of device-location targeting.
- Settings links both pages and uses the current `Google Maps` text attribution.
- Live Google photos use a legible author/source overlay linked to the returned photo-specific
  `photos.googleMapsUri`; requesting that nested photo field remains in the IDs-only Details tier.

These pages are intentionally accurate about incomplete work. The privacy page discloses that
bounded Google-derived place facts are still stored with a person's place memory and that public
launch remains blocked until the durable catalog/retention design changes.

## Location correction

The compliance review found a mismatch between the approved product law and the client: the app
requested browser geolocation after startup, cached coordinates for 24 hours, wrote a coarse
`homeCity`, biased Places autocomplete, and exposed a `Near me` sort. All of those behaviors are
removed. Search now adapts only to the query a person deliberately types. This is both simpler and
consistent with `GROUP_DIRECTION.md`: geography may be explicit logistics, never a taste profile.

`status:cutover` now proves that canonical App, Places, and onboarding source contains no
geolocation request, cached coordinate, Places location bias, or home-city write.

## Provider requirements checked

- [Places API policies and attribution](https://developers.google.com/maps/documentation/places/web-service/policies)
  require public Terms and Privacy pages, incorporation of Google's terms/privacy policy,
  compliant attribution, and restricted caching. Place IDs are exempt from caching restrictions.
- [Google Maps/Google Earth Additional Terms](https://maps.google.com/help/terms_maps/) are linked
  directly from the user terms.
- [Google Privacy Policy](https://policies.google.com/privacy) is incorporated into the privacy page.
- [Firebase Privacy and Security](https://firebase.google.com/support/privacy) is linked as the
  infrastructure-provider disclosure.

## Required owner review before public cutover

1. Publish the legal name of the operator/controller.
2. Publish a durable private contact for privacy, account, and legal requests.
3. Confirm intended age eligibility and jurisdictions with counsel.
4. Review warranty, liability, suspension, and dispute language for the actual operator.
5. Reconcile legacy v1 data, processor backup/log retention, and any production analytics.
6. Complete the owned/open catalog and Google-content retention redesign.
7. Replace both `LEGAL_REVIEW_STATUS: pending-owner-identity-and-contact` markers only after the
   reviewed values are actually present.

The deployment gate treats either pending marker as a blocker. File existence alone is not accepted
as legal readiness.
