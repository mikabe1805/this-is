import { Link } from 'react-router-dom'

// LEGAL_REVIEW_STATUS: pending-owner-identity-and-contact
export default function Terms() {
  return (
    <div className="page legal-page">
      <header className="legal-header">
        <Link to="/settings" className="pill pill-ghost press">Back</Link>
        <p className="eyebrow">DEVELOPMENT PILOT · JULY 12, 2026</p>
        <h1 className="t-display">Terms of use</h1>
        <p className="t-body">The short version: use this.is with people you trust, share only what is yours to share, and verify real-world place details before relying on them.</p>
      </header>

      <article className="legal-card">
        <section>
          <h2>1. The service</h2>
          <p>this.is is a development-stage place-decision tool for recurring groups of two to six people. People can keep a place as Want, Tried, or Loved; optionally give a group bounded broad Quick start hints; choose whether an exact signal is private or shared with a group; and make a small group Pick. Quick start is optional and does not claim you Want or Love a place.</p>
          <p>The pilot may change, pause, or end while the product is being validated. It is not an emergency, safety, booking, transportation, or navigation service.</p>
        </section>

        <section>
          <h2>2. Your account and groups</h2>
          <p>You are responsible for activity under your account and for inviting only people you intend to include. A group invitation does not silently connect anyone: the recipient must accept it. Leaving a group ends future access to that group’s evidence.</p>
        </section>

        <section>
          <h2>3. Your contributions</h2>
          <p>You keep ownership of the notes and choices you enter. You give this.is permission to store, process, and display them only as needed to operate the service and honor the visibility you selected. Do not submit unlawful content, sensitive information about another person, or material you do not have permission to share.</p>
        </section>

        <section>
          <h2>4. Google Maps and place information</h2>
          <p>Place search, place facts, photos, and the routing handoff may use Google Maps Platform. Google-provided content belongs to Google or its licensors and may be incomplete, outdated, or unavailable. Verify hours, accessibility, price, safety, and directions in Google Maps or with the venue.</p>
          <p>By using Google-powered place features, you also agree to the <a href="https://maps.google.com/help/terms_maps/">Google Maps/Google Earth Additional Terms</a> and the applicable <a href="https://cloud.google.com/maps-platform/terms">Google Maps Platform terms</a>.</p>
        </section>

        <section>
          <h2>5. Acceptable use</h2>
          <p>Do not probe or bypass access controls, scrape or bulk-export place content, automate abusive traffic, impersonate another person, expose invitation or receipt links outside their intended audience, or use the service to harass or track someone.</p>
        </section>

        <section>
          <h2>6. No guarantee</h2>
          <p>The development pilot is provided as available. Recommendations are deterministic explanations of group evidence, not professional advice or guarantees that a place will be suitable. To the extent permitted by applicable law, the project owner is not responsible for indirect loss arising from pilot use.</p>
        </section>

        <section>
          <h2>7. Ending use and changes</h2>
          <p>You can export or delete your canonical account data in Settings. Access may be suspended for abuse or security reasons. Material changes to these terms will be dated here before a reviewed public launch.</p>
        </section>

        <section>
          <h2>8. Contact</h2>
          <p>During the closed development pilot, contact the organizer privately through the same channel that provided your invitation. Do not place private account or deletion information in a public issue.</p>
          <p>Read the <Link to="/privacy">Privacy policy</Link>.</p>
        </section>
      </article>
    </div>
  )
}
