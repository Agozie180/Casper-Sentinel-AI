import Link from "next/link";

import { ThemeToggle } from "../features/theme-toggle";

const proofPoints = [
  { label: "Before signature", value: "Agent intent is screened before it can be approved" },
  { label: "Policy decides", value: "Deterministic APPROVE, WARN, or BLOCK — never the model" },
  { label: "Casper verifies", value: "Each decision is prepared for on-chain attestation" },
];

const capabilities = [
  {
    title: "Guardrails for autonomous agents",
    body: "AI agents sign and call contracts faster than any human can review them. Sentinel inserts a policy checkpoint between an agent's intent and the wallet signature, so nothing executes unreviewed.",
  },
  {
    title: "Explained by AI, decided by policy",
    body: "The model turns raw signals into a readable rationale and separates observed evidence from inference. The APPROVE / WARN / BLOCK outcome comes only from deterministic thresholds, so every decision is auditable.",
  },
  {
    title: "Evidence anchored on Casper",
    body: "Each review is packaged with compact hashes for intent, explanation, and metadata, then prepared for publication to the risk registry contract on Casper — provable without exposing the payload.",
  },
];

const workflow = [
  "Capture unsigned intent",
  "Score risk against policy",
  "Separate facts from inference",
  "Prepare Casper attestation",
];

const faqs = [
  {
    question: "Where does Sentinel sit in a transaction flow?",
    answer:
      "Directly before signature. It screens intent from a wallet, an autonomous agent, a DAO workflow, or a treasury tool before the approval prompt ever appears.",
  },
  {
    question: "Can the AI override a policy decision?",
    answer:
      "No. The AI only writes the human-readable explanation. The APPROVE, WARN, or BLOCK outcome is produced by deterministic policy thresholds and detector output.",
  },
  {
    question: "What gets recorded on Casper?",
    answer:
      "A compact attestation: wallet, optional transaction hash, timestamp, risk score, decision, and hashes of the explanation and metadata — published to the risk report registry contract on Testnet.",
  },
  {
    question: "How does the demo avoid faking on-chain proof?",
    answer:
      "The interface never claims a confirmed Casper transaction unless the publisher receives a real transaction hash and a confirmation result from the network.",
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
          <ThemeToggle />
          <Link className="navLaunch" href="/app">
            Launch console
          </Link>
        </div>
      </nav>

      <section className="landingHero">
        <div className="landingHeroCopy">
          <p className="landingEyebrow">Autonomous security layer</p>
          <h1>Security for AI agents and Casper transactions, enforced before signing.</h1>
          <p>
            Casper Sentinel AI is an autonomous security layer for AI agents and Casper
            transactions. It screens unsigned intent, enforces deterministic policy, explains the
            risk in defensible language, and prepares a verifiable Casper attestation for the review
            trail.
          </p>
          <div className="landingActions">
            <Link className="primaryLaunch" href="/app">
              Launch console
            </Link>
            <a className="secondaryLaunch" href="#why">
              See how it works
            </a>
          </div>
        </div>

        <div
          className="heroProductFrame"
          aria-label="Casper Sentinel live security interface preview"
        >
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
          <h2>Autonomous agents act faster than humans can review.</h2>
          <p>
            A wallet prompt assumes a person has the time, context, and discipline to judge every
            transaction. Agent systems break that assumption. Sentinel restores control with a
            policy-governed checkpoint where intent is interpreted, risk is scored, and the decision
            can be defended before any assets move.
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
          <h2>A controlled path from intent to on-chain evidence.</h2>
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
          <h2>What security reviewers ask first.</h2>
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

      <footer className="siteFooter">
        Built for Casper Buildathon by <b>chiagozie50</b>
      </footer>
    </main>
  );
}
