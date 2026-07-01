import Link from "next/link";

const proofPoints = [
  { label: "Before signature", value: "Intent is screened before approval" },
  { label: "Policy decides", value: "Deterministic approve, warn, or block" },
  { label: "Casper verifies", value: "Reports can be anchored as attestations" },
];

const capabilities = [
  {
    title: "Policy control for autonomous agents",
    body: "Autonomous agents can call contracts faster than teams can review prompts. Sentinel adds a policy checkpoint before a transaction reaches signature.",
  },
  {
    title: "AI explanation, policy enforcement",
    body: "The analyst view separates observed evidence from inferred risk, while deterministic thresholds keep the final decision auditable.",
  },
  {
    title: "Casper-backed review evidence",
    body: "Risk reports are prepared with compact hashes for intent, explanation, and metadata so teams can prove what was reviewed without exposing the full payload.",
  },
];

const workflow = [
  "Capture unsigned intent",
  "Score policy risk",
  "Separate facts from inference",
  "Prepare Casper evidence",
];

const faqs = [
  {
    question: "Where does Sentinel sit in a transaction flow?",
    answer:
      "Before signature. It can screen intent from a wallet, agent, DAO workflow, or treasury tool before the approval prompt appears.",
  },
  {
    question: "Can the AI override a policy decision?",
    answer:
      "No. AI produces the human-readable explanation. The approve, warn, or block outcome comes from deterministic policy and detector output.",
  },
  {
    question: "What is recorded on Casper?",
    answer:
      "A compact attestation payload: wallet, optional transaction hash, timestamp, score, decision, explanation hash, and metadata hash.",
  },
  {
    question: "How does the demo avoid fake proof?",
    answer:
      "The interface does not claim a confirmed Casper transaction unless the publisher receives a real hash and confirmation result.",
  },
];

const heroEvents = [
  { label: "Unsigned approval", value: "Captured", tone: "info" },
  { label: "Policy denylist", value: "Matched", tone: "danger" },
  { label: "Agent action", value: "Blocked", tone: "danger" },
  { label: "Casper report", value: "Ready", tone: "secure" },
];

export default function LandingPage() {
  return (
    <main className="landingShell">
      <nav className="landingNav" aria-label="Site navigation">
        <Link className="landingBrand" href="/">
          <span aria-hidden="true" />
          Casper Sentinel AI
        </Link>
        <div>
          <a href="#why">Why</a>
          <a href="#how">Workflow</a>
          <a href="#faq">FAQ</a>
          <Link className="navLaunch" href="/app">
            Launch console
          </Link>
        </div>
      </nav>

      <section className="landingHero">
        <div className="landingHeroCopy">
          <p className="landingEyebrow">Autonomous security for Casper transactions</p>
          <h1>Security review before agent transactions are signed.</h1>
          <p>
            Casper Sentinel AI screens unsigned transaction intent, applies deterministic policy, explains risk in
            defensible language, and prepares verifiable Casper attestations for the review trail.
          </p>
          <div className="landingActions">
            <Link className="primaryLaunch" href="/app">
              Launch console
            </Link>
            <a className="secondaryLaunch" href="#why">
              See why it matters
            </a>
          </div>
        </div>

        <div className="heroProductFrame" aria-label="Casper Sentinel live security interface preview">
          <div className="heroFrameTop">
            <span />
            <strong>Sentinel console</strong>
            <em>Preview</em>
          </div>
          <div className="heroDecision">
            <div>
              <span>Risk decision</span>
              <strong>BLOCK</strong>
            </div>
            <b>94</b>
          </div>
          <div className="heroSignalGrid">
            {heroEvents.map((event) => (
              <div key={event.label} className={event.tone}>
                <span>{event.label}</span>
                <strong>{event.value}</strong>
              </div>
            ))}
          </div>
          <div className="heroTrace">
            <span>Intent captured</span>
            <span>Risk scored</span>
            <span>Explanation hashed</span>
            <span>Casper packet ready</span>
          </div>
        </div>
      </section>

      <section className="proofStrip" aria-label="Product proof points">
        {proofPoints.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </section>

      <section className="landingSection" id="why">
        <div className="sectionIntro">
          <p className="landingEyebrow">Why it matters</p>
          <h2>Autonomous agents need security review before execution.</h2>
          <p>
            A wallet prompt assumes a human has time, context, and discipline. Agent systems weaken that assumption.
            Sentinel creates a policy-governed checkpoint where intent is interpreted, risk is scored, and the decision
            can be defended before assets move.
          </p>
        </div>
        <div className="capabilityGrid">
          {capabilities.map((capability) => (
            <article key={capability.title}>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingSection workflowSection" id="how">
        <div className="sectionIntro">
          <p className="landingEyebrow">Workflow</p>
          <h2>A controlled path from intent to evidence.</h2>
        </div>
        <div className="workflowRail">
          {workflow.map((step, index) => (
            <div key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="landingSection faqSection" id="faq">
        <div className="sectionIntro">
          <p className="landingEyebrow">FAQ</p>
          <h2>Questions security reviewers ask.</h2>
        </div>
        <div className="faqGrid">
          {faqs.map((faq) => (
            <article key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingCta">
        <div>
          <p className="landingEyebrow">Console</p>
          <h2>Run a transaction through Sentinel and inspect the evidence packet.</h2>
        </div>
        <Link className="primaryLaunch" href="/app">
          Launch console
        </Link>
      </section>
    </main>
  );
}

