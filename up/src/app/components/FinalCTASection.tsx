import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import Link from "next/link";
import { Rocket, Users, Clock, Shield } from "lucide-react";

const FinalCTASection = () => {
  return (
    <section className="py-20 bg-gradient-to-br from-primary/10 via-background to-primary-glow/10">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-12 fade-in-up animate">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Ready to Master
              <span className="block bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Dependency Health?
              </span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join 1,000+ developers who've secured, updated, and optimized
              their dependencies.
            </p>
          </div>

          <Card className="card-gradient p-8 mb-8 border-border/50 glow-effect">
            <div className="grid md:grid-cols-4 gap-6 text-center">
              {[
                { icon: Users, number: "1,000+", label: "Happy Developers" },
                {
                  icon: Shield,
                  number: "50,000+",
                  label: "Dependencies Scanned",
                },
                { icon: Clock, number: "10,000+", label: "Hours Saved" },
                { icon: Rocket, number: "4+", label: "Languages Supported" },
              ].map((stat, index) => (
                <div key={index} className="space-y-2">
                  <stat.icon className="w-8 h-8 text-primary mx-auto" />
                  <div className="text-2xl font-bold text-foreground">
                    {stat.number}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-6">
            <Link href="/checks" className="block">
              <Button size="lg" className="btn-hero text-lg px-12 py-6">
                Start Free Scan Now
              </Button>
            </Link>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>No credit card required</span>
              </div>
              <div className="hidden sm:block">•</div>
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                <span>Works with major languages</span>
              </div>
              <div className="hidden sm:block">•</div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Takes less than 30 seconds</span>
              </div>
            </div>
          </div>

          <div className="mt-16 p-6 bg-muted/20 rounded-xl border border-border/50">
            <p className="text-muted-foreground text-lg">
              "Finally, a tool that handles security, updates, and cleanup in
              one scan. Pacgie found critical vulnerabilities AND 20% unused
              dependencies I didn't know existed."
            </p>
            <div className="mt-4 text-sm">
              <span className="font-semibold text-foreground">Sarah Kim</span>
              <span className="text-muted-foreground">
                {" "}
                • Senior Developer at TechCorp
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTASection;
