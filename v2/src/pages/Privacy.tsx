import { Link } from 'react-router-dom'

// LEGAL_REVIEW_STATUS: pending-owner-identity-and-contact
export default function Privacy() {
  return (
    <div className="page legal-page">
      <header className="legal-header">
        <Link to="/settings" className="pill pill-ghost press">Back</Link>
        <p className="eyebrow">DEVELOPMENT PILOT · JULY 14, 2026</p>
        <h1 className="t-display">Privacy policy</h1>
        <p className="t-body">this.is is built around explicit audiences: private means you, and group-visible means the current members of the group you chose.</p>
      </header>

      <article className="legal-card">
        <section>
          <h2>1. Scope and operator</h2>
          <p>This policy covers the canonical this.is development pilot. The project owner operates the pilot using Google Firebase and Google Maps Platform. A reviewed public launch still requires the owner’s legal identity and durable privacy contact to be published here.</p>
        </section>

        <section>
          <h2>2. Information we process</h2>
          <ul>
            <li><strong>Account:</strong> Firebase user ID, sign-in provider, email, account name, and authentication timestamps.</li>
            <li><strong>Profile:</strong> the display name and avatar color your groups see.</li>
            <li><strong>Place memory:</strong> Want, Tried, or Loved; optional note; optional bounded yes/no useful details; visibility; opaque place ID; and the personal label and broad category you explicitly confirm.</li>
            <li><strong>Groups and decisions:</strong> membership, invitations, explicit group-sharing choices, optional non-sensitive Quick start hints, attendee selections, attributed draft passes, Picks, and closure outcomes.</li>
            <li><strong>Minimal product events:</strong> bounded action names and counts used to evaluate the pilot. Event payloads exclude names, notes, search text, place IDs, invitation tokens, and other-person identifiers.</li>
          </ul>
        </section>

        <section>
          <h2>3. No device-location profile</h2>
          <p>this.is does not request, collect, or store your device location, and it does not create a home-area or location-targeting profile. Place search is global: geography comes only from words you deliberately type, such as a city or neighborhood.</p>
        </section>

        <section>
          <h2>4. Google-powered place search</h2>
          <p>Discover orders Food, Coffee, Things to do, and Drinks prompts in your browser using only your private Want/Loved category counts; Tried remains neutral. The ordering and temporary area are not stored as a profile. Tapping one prompt sends its visible category-and-area query to Google. No search occurs merely because the page opened.</p>
          <p>When you type in the explicit “Add with Google Maps” flow, your query and a random autocomplete session token are sent from your browser to Google Places API. Selecting a suggestion sends its Google place ID to retrieve a minimal set of place facts. An exact long Google Maps place link is instead parsed in your browser and opens user confirmation without a Places request; an opaque Google short link is expanded only after your explicit action through the authenticated Google-host-only resolver. Opening an otherwise unknown place may request current details. If budgeted photos are enabled, an explicit saved-place closeup or a visible final group candidate may request one live photo through the authenticated proxy. The proxy verifies your canonical save or current group evidence first; its monthly allowance stores only a month and aggregate count, not a user, group, or place history. Keep and search grids do not request Google photos. Google processes this activity under the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.</p>
          <p>this.is stores the opaque Google place ID plus the personal label and broad category you explicitly confirm. Current Google place facts and photos may be displayed live, but are not added to your durable place memory; Google photo resource names are not stored by this.is. Existing legacy rows still require an owner-reviewed cleanup before public cutover.</p>
        </section>

        <section>
          <h2>5. Who can see what</h2>
          <p>Private signals, notes, and useful details are readable only by you. A group receives exact-place evidence only after you explicitly share that signal; notes and useful details each require their own inclusion choice. Shared useful details keep the member attribution and explicit yes or no, so disagreement is not turned into a rating. Optional Quick start hints reveal the broad categories you selected to the shown group audience, never become Wants or Loves, and lock that audience before influencing results. Group invitation previews require the exact opaque token and cannot be listed as a collection. A signed-in member can recover only the active links they created for a group they still belong to, through a bounded server check. Group recommendations use only current members’ current-version evidence. An explicitly confirmed Pick may retain its bounded area and one practical need after the server revalidates both; they do not become taste defaults. The private group record carries one bounded current-Pick pointer and may retain one replaceable last-visited pointer so attendees can add their own outcome. A group outcome changes no personal save; each person’s Tried or Loved remains their own explicit Keep action. A new Pick replaces the last pointer, dismissal creates none, and membership change removes both. Public Pick receipts are optional, contain no member identities, notes, useful details, private Pick constraints, or personal outcomes, use an opaque link, and can be revoked.</p>
          <p>Before a Pick, an attributed pass is visible to current members for that exact draft. Only the person who made it can undo it. The temporary area text is represented only inside an opaque draft hash, and the pass never becomes taste or a permanent dislike.</p>
        </section>

        <section>
          <h2>6. Service providers and disclosures</h2>
          <p>Google Firebase provides authentication, database, Functions, and hosting infrastructure; its handling is described in <a href="https://firebase.google.com/support/privacy">Firebase Privacy and Security</a>. Google Maps Platform provides place search, place content, and the outbound Maps handoff. Information may also be disclosed when required by law or necessary to protect users and the service. this.is does not sell personal information or use it for advertising.</p>
        </section>

        <section>
          <h2>7. Retention</h2>
          <ul>
            <li>Raw product events carry a 30-day expiry.</li>
            <li>Group invitation links stop working after seven days. Their records are scheduled for deletion through Firebase TTL after expiry; provider processing may take about a day.</li>
            <li>Attributed draft passes stop affecting the group after six hours and are scheduled for deletion through Firebase TTL; permission or evidence changes make an older draft unreadable sooner.</li>
            <li>An account-deletion completion record retains only a hash-derived operation ID, completion timestamps, and status for up to seven days. The deleting account ID is removed from that record after cleanup and authentication removal finish.</li>
            <li>Public Pick receipts expire after 30 days and are revoked sooner on dismissal, membership change, group closure, account deletion, or manual revocation.</li>
            <li>Profile, signals, notes, useful details, Quick start hints, groups, and Picks remain until you delete them, leave the applicable audience, or delete your account, subject to security logs and provider backup cycles.</li>
            <li>A versioned app-shell cache stores only this.is code, styles, the icon, and the web manifest so an installed build can open offline. It does not cache Google photos, public Pick receipts, API responses, or personal or group documents. Firebase separately keeps an offline data cache on your device; browser storage also holds theme, haptics, a small photo-budget counter, and—only while an account deletion is unconfirmed—an account-scoped random deletion-operation key.</li>
          </ul>
        </section>

        <section>
          <h2>8. Your choices and rights</h2>
          <p>You can edit or clear useful details, choose whether to include them with each exact group share, change signal visibility, stop sharing with a group, decline, edit, or remove Quick start hints, revoke an unused group invite you created, leave a group, revoke a receipt, export your canonical data including useful details and Quick start choices, and permanently delete your canonical v2 account data from Settings. Removing a hint stops its influence on later results but does not reopen a membership audience that was already fixed. Account deletion requires recent authentication, removes the authentication account last, and keeps an account-scoped random browser-held operation key until the server confirms that exact deletion.</p>
          <p>Your export includes attributed draft passes you made; account deletion removes them. You can also undo your own pass while that draft is current.</p>
        </section>

        <section>
          <h2>9. Security, children, and international processing</h2>
          <p>The service uses authenticated access rules, server-owned group projections, bounded schemas, and audience-version revocation, but no online service is perfectly secure. The pilot is not directed to children under 13. Google may process information in countries other than your own under its applicable safeguards.</p>
        </section>

        <section>
          <h2>10. Contact and changes</h2>
          <p>For pilot privacy questions, contact the organizer privately through the invitation channel. Use Settings for export or deletion. The owner identity and durable contact must be added before public cutover. Material changes will update the date above.</p>
          <p>Read the <Link to="/terms">Terms of use</Link>.</p>
        </section>
      </article>
    </div>
  )
}
