import { Card } from "../components/ui/card";
import { AlertTriangle, Clock, Layers, Shield } from "lucide-react";

const PainPointsSection = () => {
 const painPoints = [
  {
    icon: Clock,
    title: "Time-Consuming Updates",
    description: "Hours spent manually checking package versions across projects.",
  },
  {
    icon: Shield,
    title: "Security Risks",
    description: "Outdated dependencies expose critical vulnerabilities.",
  },
  {
    icon: Layers,
    title: "Multi-Language Hassle",
    description: "Different tools for Node.js, Python, Go, and Rust.",
  },
];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 fade-in-up animate">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Tired of Outdated Dependencies <br />
              <span className="text-primary">Slowing You Down?</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Most developers resign themselves to manual checking or hope their CI/CD catches issues.
              But what if there was a better way?
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {painPoints.map((point, index) => (
              <Card key={index} className="card-gradient p-8 border-border/50 hover-lift">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
                    <point.icon className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{point.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{point.description}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="bg-gradient-to-r from-muted/20 to-muted/10 rounded-2xl p-8 border border-border/50">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">The Hidden Cost of Neglected Dependencies</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Most developers think dependency management has to be tedious and time-consuming. They resign themselves to manual checking or hope their CI/CD catches issues.
                  <span className="text-foreground font-medium"> But what if there was a single tool that understood all your languages and could give you a complete dependency health check in seconds?</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainPointsSection;