import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Check, Star, Zap } from "lucide-react";
import Link from "next/link";

interface PricingSectionProps {
  id?: string;
}

const PricingSection = ({ id }: PricingSectionProps) => {
  const plans = [
    {
      name: "Free",
      subtitle: "Get Started Free",
      price: "$0",
      period: "forever",
      description: "Perfect for hobby projects and trying it out",
      icon: Star,
      scans: "10 scans / month",
      cta: "Start Free",
      popular: false,
    },
    {
      name: "Pro",
      subtitle: "For Active Developers",
      price: "$7",
      period: "per month",
      description: "More scans, same simple workflow",
      icon: Zap,
      scans: "250 scans / month",
      cta: "Upgrade to Pro",
      popular: true,
    },
  ];

  const sharedFeatures = [
    "Core dependency scanning engine",
    "Supports 4+ languages",
    "GitHub OAuth integration",
    "Private & public repo access",
    "Persistent scan history",
  ];

  return (
    <section
      id={id}
      className="py-20 bg-gradient-to-b from-muted/20 to-background"
    >
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 fade-in-up animate">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Simple, Developer-Friendly
              <span className="block text-primary">Pricing</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Same features. Different scan limits. Upgrade only when you need
              more.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {plans.map((plan, index) => (
              <Card
                key={index}
                className={`card-gradient p-8 border-border/50 hover-lift relative ${
                  plan.popular
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                    : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-full">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <plan.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-muted-foreground mb-4">{plan.subtitle}</p>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">
                      /{plan.period}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="font-medium text-foreground">
                      {plan.scans}
                    </span>
                  </li>
                  {sharedFeatures.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.name === "Free" ? (
                  <Link href="/checks">
                    <Button
                      className={`w-full ${
                        plan.popular ? "btn-hero" : "btn-outline-hero"
                      }`}
                      size="lg"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                ) : (
                  <Link href="/upgrade">
                    <Button
                      className={`w-full ${
                        plan.popular ? "btn-hero" : "btn-outline-hero"
                      }`}
                      size="lg"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
