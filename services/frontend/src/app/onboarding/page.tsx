import { OnboardingFlow } from "@/components/onboarding-flow";

const slides = [
  {
    title: "Daniel Negreanu watches every hand.",
    body: [
      "He is one of poker’s most recognizable champions, and here he is sitting across from you heads-up.",
      "Every hand you play gives him something to notice, question, and teach."
    ]
  },
  {
    title: "Play the hand. Hear the truth.",
    body: [
      "You make the decisions: fold, call, raise, and live with the spot you created.",
      "When the hand ends, Daniel Negreanu breaks down the moment that mattered."
    ]
  },
  {
    title: "He remembers.",
    body: [
      "Your patterns carry across every session, from loose river calls to pressure folds.",
      "Repeat the same leak and Negreanu will call it out by name."
    ]
  }
];

export default function OnboardingPage() {
  return <OnboardingFlow slides={slides} />;
}
