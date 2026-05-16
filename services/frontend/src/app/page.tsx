import { LandingActions } from "@/components/landing-actions";
import { HeroTypewriterText } from "@/components/hero-typewriter-text";
import { SiteHeader } from "@/components/site-header";

const communityCards = [
  { rank: "A", suit: "♠" },
  { rank: "7", suit: "♣" },
  { rank: "J", suit: "♦" },
  { rank: "4", suit: "♥" },
  { rank: "9", suit: "♣" }
];

const summaryRows = [
  "Your hand: K♥ Q♥",
  "Negreanu’s hand: J♦ 7♥",
  "Board: A♠ 7♣ J♦ 4♥ 9♣",
  "Winner: Negreanu (+560)"
];

const freeFeatures = [
  "5 complete hands",
  "Full Daniel Negreanu coaching after each hand",
  "Mistake pattern tracking",
  "No credit card required"
];

const keyFeatures = [
  "Unlimited hands",
  "Full Daniel Negreanu coaching after each hand",
  "Persistent mistake memory across sessions",
  "Pay Anthropic directly",
  "Remove your key anytime"
];

const userChipColors = ["#1a6b3c", "#C9A84C", "#8B2635", "#1a6b3c", "#C9A84C"];
const negreanuChipColors = ["#8B2635", "#C9A84C", "#1a6b3c", "#8B2635", "#C9A84C"];

const mistakes = [
  {
    severity: "high",
    color: "bg-[color:var(--color-danger)]",
    pattern: "Calling down too wide",
    frequency: "×4",
    description: "Paying off river bets with medium-strength hands when the board and bet sizing suggest strength."
  },
  {
    severity: "medium",
    color: "bg-[color:var(--color-gold-muted)]",
    pattern: "Over-folding to 3-bet pressure",
    frequency: "×2",
    description: "Releasing strong holdings when facing re-raises out of position, particularly with premium hands."
  },
  {
    severity: "low",
    color: "bg-[color:var(--color-success)]",
    pattern: "Turn barrel too thin",
    frequency: "×2",
    description: "Firing continuation bets on the turn without sufficient equity or fold equity against calling ranges."
  }
];

export default function LandingPage() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="overflow-x-hidden bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
        <HeroSection />
        <CoachingSection />
        <MemorySection />
        <PricingSection />
        <ClosingSection />
      </main>
      <Footer />
    </>
  );
}

function HeroSection() {
  return (
    <section id="hero" className="relative min-h-svh px-5 py-[120px] sm:px-8 lg:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_34%,rgb(13_43_29_/_0.38),transparent_34rem)]" aria-hidden="true" />
      <div className="relative mx-auto grid min-h-[calc(100svh-240px)] max-w-[1440px] items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div className="self-center">
          <p className="w-fit rounded-[var(--radius-sm)] border border-[rgb(201_168_76_/_0.2)] bg-[rgb(201_168_76_/_0.1)] px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-[color:var(--color-gold)]">
            Heads-Up No-Limit Hold&rsquo;em
          </p>
          <h1 className="mt-8 font-display text-[48px] font-extrabold leading-[1.05] text-[color:var(--color-text-primary)] [text-wrap:balance] sm:text-[60px] xl:text-[72px]">
            <span className="block">The closest you&rsquo;ll get</span>
            <span className="block text-[color:var(--color-gold)]">to sitting with Negreanu.</span>
          </h1>
          <p className="mt-6 max-w-[480px] text-xl font-normal leading-[1.6] text-[color:var(--color-text-secondary)]">
            Play heads-up with the legend. Make decisions. Hear Daniel Negreanu tell you exactly what you got wrong, and why.
          </p>
          <p className="mt-3 max-w-[480px] text-sm font-normal text-[color:var(--color-text-muted)]">
            Five hands free. No credit card.
            <br />
            Bring your own Anthropic key to keep going.
          </p>
          <LandingActions className="mt-10" />
        </div>

        <HeroProductMock />
      </div>
    </section>
  );
}

function HeroProductMock() {
  return (
    <figure className="grid self-center gap-4 lg:min-h-[560px] lg:grid-cols-[55fr_45fr]" aria-label="Product preview">
      <PokerTablePanel />
      <CoachingPanel
        text={[
          "Come on buddy, that river call was always going to cost you. When I check back the turn and then fire 70% pot on the river, I’m not bluffing. I’m showing you the nuts or close to it. You had second pair. That’s a fold. Every time.",
          "This is the third hand you’ve called off your stack with a medium-strength hand against pressure. We’re going to fix that."
        ]}
        tag="Mistake pattern detected: calling down too wide"
        pulseStatus
        typewriter
      />
    </figure>
  );
}

function PokerTablePanel() {
  return (
    <div className="felt-texture relative min-h-[420px] overflow-hidden rounded-[var(--radius-xl)] border border-[rgb(201_168_76_/_0.14)] p-5 shadow-table sm:min-h-[520px]">
      <div className="absolute inset-6 rounded-[var(--radius-xl)] border border-dashed border-[rgb(201_168_76_/_0.18)]" aria-hidden="true" />
      <div className="absolute left-1/2 top-8 flex -translate-x-1/2 gap-2">
        <CardBack />
        <CardBack />
      </div>

      <div className="absolute left-1/2 top-[40%] flex -translate-x-1/2 -translate-y-1/2 gap-2">
        {communityCards.map((card) => (
          <PlayingCard key={`${card.rank}-${card.suit}`} rank={card.rank} suit={card.suit} />
        ))}
      </div>

      <div className="absolute left-1/2 top-[55%] -translate-x-1/2 rounded-[var(--radius-sm)] bg-[rgb(10_10_10_/_0.72)] px-4 py-2 font-mono text-sm tabular-nums text-[color:var(--color-gold)] shadow-lift">
        Pot 560
      </div>

      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-3">
        <PlayingCard rank="K" suit="♥" lift />
        <PlayingCard rank="Q" suit="♥" lift />
      </div>

      <ChipStack className="bottom-8 left-8" colors={userChipColors} label="975" />
      <ChipStack className="right-8 top-8" colors={negreanuChipColors} label="1025" align="end" />
    </div>
  );
}

function CoachingPanel({
  text,
  tag,
  pulseStatus = false,
  typewriter = false
}: {
  text: string[];
  tag?: string;
  pulseStatus?: boolean;
  typewriter?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-lift">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-full bg-[color:var(--color-gold)] text-sm font-semibold text-[color:var(--color-bg)]">
          N
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Daniel Negreanu</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
            <span className={`size-2 rounded-full bg-[color:var(--color-success)] ${pulseStatus ? "pulse-dot" : ""}`} />
            <span>coaching</span>
          </div>
        </div>
      </div>
      <div className="my-5 h-px bg-[color:var(--color-border)]" />
      {typewriter ? (
        <HeroTypewriterText paragraphs={text} className="text-[15px] font-normal leading-[1.7] text-[color:var(--color-text-primary)]" />
      ) : (
        <div className="space-y-4 text-[15px] font-normal leading-[1.7] text-[color:var(--color-text-primary)]">
          {text.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      )}
      {tag ? (
        <div className="mt-6 w-fit rounded-[var(--radius-sm)] bg-[rgb(139_38_53_/_0.18)] px-3 py-2 text-xs font-medium text-[rgb(196_82_98)]">
          {tag}
        </div>
      ) : null}
    </div>
  );
}

function PlayingCard({ rank, suit, lift = false }: { rank: string; suit: string; lift?: boolean }) {
  const isRed = suit === "♥" || suit === "♦";

  return (
    <div
      className={`grid aspect-[5/7] w-10 place-items-center rounded-[var(--radius-sm)] border border-[#d8d6cc] bg-[color:var(--color-text-primary)] text-[color:var(--color-bg)] shadow-lift sm:w-12 ${
        lift ? "-translate-y-2 rotate-2" : ""
      }`}
    >
      <div className={`font-mono text-base leading-none sm:text-xl ${isRed ? "text-[color:var(--color-danger)]" : ""}`}>
        {rank}
        <span className="block text-sm sm:text-base">{suit}</span>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="aspect-[5/7] w-11 rounded-[var(--radius-sm)] border border-[rgb(201_168_76_/_0.45)] bg-[repeating-linear-gradient(45deg,#5b1724,#5b1724_6px,#2f0c13_6px,#2f0c13_12px)] shadow-lift sm:w-12">
      <div className="m-2 h-[calc(100%-1rem)] rounded-[var(--radius-sm)] border border-[rgb(201_168_76_/_0.35)]" />
    </div>
  );
}

function ChipStack({
  align = "start",
  className,
  colors,
  label
}: {
  align?: "start" | "end";
  className: string;
  colors: string[];
  label: string;
}) {
  return (
    <div className={`absolute flex flex-col ${align === "end" ? "items-end" : "items-start"} ${className}`}>
      <div className="relative h-[92px] w-7" aria-hidden="true">
      {colors.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="absolute left-0 size-7 rounded-full border-[1.5px] border-[rgb(255_255_255_/_0.2)]"
          style={{
            backgroundColor: color,
            bottom: `${index * 16}px`,
            boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.4)"
          }}
        />
      ))}
      </div>
      <p className="mt-1 font-mono text-[11px] tabular-nums text-[color:var(--color-text-muted)]">{label}</p>
    </div>
  );
}

function CoachingSection() {
  return (
    <section id="coaching" className="bg-[color:var(--color-bg)] px-5 py-[120px] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1100px] text-center">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-[color:var(--color-gold)]">How it works</p>
        <h2 className="mx-auto max-w-[700px] font-display text-[36px] font-bold leading-[1.1] text-[color:var(--color-text-primary)] [text-wrap:balance] sm:text-[56px]">
          He coaches you after every hand.
        </h2>
        <p className="mx-auto mt-5 max-w-[580px] text-lg font-normal leading-[1.7] text-[color:var(--color-text-secondary)]">
          Play the hand yourself. Make every decision — fold, call, raise. When the hand ends, Daniel Negreanu breaks down the exact moment that mattered. Not a generic tip. The specific decision, with his reasoning, in his voice.
        </p>

        <div className="mt-[60px] grid gap-8 rounded-[var(--radius-xl)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-left shadow-lift sm:p-10 lg:grid-cols-[40fr_60fr]">
          <div>
            <div className="space-y-3 font-mono text-sm leading-6 text-[color:var(--color-text-secondary)]">
              {summaryRows.map((row) => (
                <p key={row}>{row}</p>
              ))}
            </div>
            <div className="my-7 h-px bg-[color:var(--color-border)]" />
            <p className="text-base font-semibold text-[color:var(--color-text-primary)]">Key decision: River call</p>
          </div>
          <CoachingPanel
            text={[
              "The turn check was actually smart — I was suspicious of your holdings. But the river is where you lost the hand before you even called. When the board pairs and I lead out for that size, your king-high flush draw missed and you know it. That call was hope, not poker.",
              "Next time: when your draw bricks and the board pairs, check your pot odds before reaching for chips."
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function MemorySection() {
  return (
    <section id="memory" className="bg-[color:var(--color-surface)] px-5 py-[120px] sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1100px] items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-[color:var(--color-gold)]">Mistake Memory</p>
          <h2 className="font-display text-[36px] font-bold leading-[1.1] text-[color:var(--color-text-primary)] [text-wrap:balance] sm:text-[56px]">
            He remembers every mistake you make.
          </h2>
          <p className="mt-5 max-w-[480px] text-lg font-normal leading-[1.7] text-[color:var(--color-text-secondary)]">
            Most coaching tools forget you the moment you close the tab. Not this one. Daniel Negreanu tracks your patterns across every session, every hand. When you repeat the same mistake, he calls it out by name. That&rsquo;s how real improvement happens.
          </p>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-8 shadow-lift">
          <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">Negreanu&rsquo;s notes on you</h3>
          <p className="mt-1 text-[13px] font-normal text-[color:var(--color-text-muted)]">3 sessions · 14 hands played</p>
          <div className="mt-7 space-y-4">
            {mistakes.map((mistake) => (
              <div key={mistake.pattern} className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`size-2.5 shrink-0 rounded-full ${mistake.color}`} aria-hidden="true" />
                    <span className="sr-only">{mistake.severity} severity</span>
                    <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{mistake.pattern}</p>
                  </div>
                  <span className="rounded-[var(--radius-sm)] border border-[rgb(201_168_76_/_0.24)] px-2 py-1 font-mono text-xs tabular-nums text-[color:var(--color-gold)]">
                    {mistake.frequency}
                  </span>
                </div>
                <p className="mt-3 text-[13px] font-normal leading-6 text-[color:var(--color-text-secondary)]">{mistake.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="bg-[color:var(--color-bg)] px-5 py-[120px] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[800px] text-center">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-[color:var(--color-gold)]">Pricing</p>
        <h2 className="font-display text-[36px] font-bold leading-[1.1] text-[color:var(--color-text-primary)] [text-wrap:balance] sm:text-[56px]">
          <span className="block">Five hands free.</span>
          <span className="block text-[color:var(--color-gold)]">Then bring your own key.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-[560px] text-lg font-normal leading-[1.7] text-[color:var(--color-text-secondary)]">
          No subscription. No monthly fee. Play five hands completely free. No credit card, no commitment. When you&rsquo;re ready for more, connect your own Anthropic API key.
        </p>

        <div className="mx-auto mt-12 grid max-w-[640px] gap-5 text-left sm:grid-cols-2">
          <PricingCard label="Free" features={freeFeatures} />
          <PricingCard label="Your API Key" features={keyFeatures} highlighted />
        </div>
      </div>
    </section>
  );
}

function PricingCard({ label, features, highlighted = false }: { label: string; features: string[]; highlighted?: boolean }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border bg-[color:var(--color-surface)] p-8 ${
        highlighted ? "border-[rgb(201_168_76_/_0.3)] shadow-[0_0_0_1px_rgb(201_168_76_/_0.2)]" : "border-[color:var(--color-border)]"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${highlighted ? "text-[color:var(--color-gold)]" : "text-[color:var(--color-text-muted)]"}`}>
        {label}
      </p>
      <ul className="mt-6 space-y-4 text-[15px] font-normal leading-6 text-[color:var(--color-text-secondary)]">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span className="text-[color:var(--color-gold)]" aria-hidden="true">
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClosingSection() {
  return (
    <section id="closing" className="bg-[color:var(--color-bg)] px-5 py-[160px] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[900px] text-center">
        <blockquote className="font-display text-[32px] font-bold italic leading-[1.2] text-[color:var(--color-gold)] [text-wrap:balance] sm:text-[48px]">
          The most important thing is to focus on what you can control. You can&rsquo;t control luck or the cards you get dealt, but you can control how you play.
        </blockquote>
        <p className="mt-4 text-base font-normal text-[color:var(--color-text-muted)]">— Daniel Negreanu</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-10 text-center sm:px-8">
      <p className="text-sm font-normal text-[color:var(--color-text-muted)]">Built to think like Daniel. Plays like him too.</p>
      <p className="mt-2 text-xs font-normal text-[color:var(--color-text-muted)]">Kid Poker Second Brain · Not affiliated with Daniel Negreanu</p>
    </footer>
  );
}
