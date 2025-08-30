import { Card } from "../components/ui/card";
import { Eye, Globe, Bot, Sparkles } from "lucide-react";

const DesiredOutcomeSection = () => {
  const outcomes = [
    {
      icon: Eye,
      title: "Clear Overview",
      description: "See exactly what needs updating with priority levels.",
    },
    {
      icon: Globe,
      title: "All Languages",
      description: "Works with Node.js, Python, Go, Rust, and more.",
    },
    {
      icon: Bot,
      title: "Auto Scan",
      description: "GitHub integration with automated scanning.",
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 fade-in-up animate">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Imagine Having Complete <br />
              <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Dependency Visibility
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Transform your dependency management from reactive chaos to
              proactive control
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {outcomes.map((outcome, index) => (
              <Card
                key={index}
                className="card-gradient p-8 border-border/50 hover-lift glow-effect"
              >
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                    <outcome.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {outcome.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {outcome.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          <div className="bg-gradient-to-r from-primary/10 to-primary-glow/10 rounded-2xl p-8 border border-primary/20">
            <div className="flex items-start gap-4">
              <Sparkles className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  A New Paradigm for Dependency Management
                </h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  What if dependency management wasn't about remembering to
                  check different package managers, but about having
                  <span className="text-primary font-medium">
                    {" "}
                    one intelligent assistant that monitors everything for you?
                  </span>
                  Instead of reactive firefighting, you get proactive insights
                  that keep your projects healthy and secure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DesiredOutcomeSection;
