import Link from "next/link";

const proofPoints = [
  { label: "Decision modes", value: "Approve / Warn / Block" },
  { label: "Risk engine", value: "Deterministic signals" },
  { label: "Casper proof", value: "Testnet attestations" },
];

const capabilities = [
  {
    title: "Pre-signature protection",
    body: "Sentinel reads transaction intent before the wallet asks the user to sign, so risky approvals and unknown contracts can be stopped early.",
  },
  {
    title: "Autonomous security reasoning",
    body: "The AI analyst explains observed evidence separately from inferred risk. It never changes the deterministic policy decision.",
  },
  {
    title: "Verifiable audit trail",
    body: "Reports are prepared as compact Casper attestations with hashes for explanation and metadata, then confirmed only from real chain responses.",
  },
];

const workflow = ["Capture unsigned intent", "Score deterministic risk", "Explain the decision", "Queue Casper attestation"];

const faqs = [
  {
    question: "Is Casper Sentinel a wallet?",
    answer: "No. It is a security layer that can sit before wallets, AI agents, DAO tooling, or treasury workflows to evaluate transaction intent before signature.",
  },
  {
    question: "Does the AI decide whether funds move?",
    answer: "No. The deterministic risk engine and policy thresholds produce the final APPROVE, WARN, or BLOCK action. The AI explains the evidence in clear language.",
  },
  {
    question: "What goes on Casper Testnet?",
    answer: "A compact risk report attestation: wallet, optional transaction hash, timestamp, risk score, decision, explanation hash, and metadata hash.",
  },
  {
    question: "Does the demo fake chain success?",
    answer: "No. The app never shows a confirmed Casper transaction unless the publisher receives a real hash and confirmation result.",
  },
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
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          <Link className="navLaunch" href="/app">Launch App</Link>
        </div>
      </nav>

      <section className="landingHero">
        <div className="landingHeroCopy">
          <p className="landingEyebrow">Autonomous security layer for AI agents</p>
          <h1>Casper Sentinel AI</h1>
          <p>
            A professional pre-execution security platform that analyzes Casper transaction intent, explains risk in
            plain language, and prepares verifiable reports before a user or AI agent signs.
          </p>
          <div className="landingActions">
            <Link className="primaryLaunch" href="/app">Launch App</Link>
            <a className="secondaryLaunch" href="#why">Explore the product</a>
          </div>
        </div>

        <img className="heroPreviewImage" src="/sentinel-hero-preview.png" alt="Casper Sentinel command center preview" />
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
          <h2>Wallets ask users to sign. Sentinel thinks first.</h2>
          <p>
            As AI agents begin moving assets and calling contracts, approval prompts are no longer enough. Sentinel gives
            users, teams, and autonomous systems a review layer that can detect risk before execution.
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
          <p className="landingEyebrow">How it works</p>
          <h2>One calm security workflow before every signature.</h2>
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
          <h2>Built for serious demos, not smoke and mirrors.</h2>
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
          <p className="landingEyebrow">Ready for review</p>
          <h2>Open the Sentinel console and run a transaction analysis.</h2>
        </div>
        <Link className="primaryLaunch" href="/app">Launch App</Link>
      </section>
    </main>
  );
}
