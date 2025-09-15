import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import Link from "next/link";
import {
  Upload,
  Search,
  CheckCircle,
  Github,
  Shield,
  Users,
  BarChart3,
  Zap,
  Link as LucideLink,
} from "lucide-react";

interface ProductIntroSectionProps {
  id?: string;
}

const ProductIntroSection = ({ id }: ProductIntroSectionProps) => {
  const features = [
    {
      icon: Github,
      title: "GitHub/GitLab Integration",
      desc: "Seamless repo scanning",
    },
    {
      icon: Shield,
      title: "Security Scanning",
      desc: "Vulnerability detection",
    },
    { icon: BarChart3, title: "Bulk Analysis", desc: "Multiple repositories" },
    { icon: Zap, title: "Automated PRs", desc: "Smart update suggestions" },
    { icon: CheckCircle, title: "4+ Languages", desc: "More coming soon" },
  ];

  return (
    <section id={id} className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          {/* Product Name & Description */}
          <div className="text-center mb-16 fade-in-up animate">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Pacgie - Dependecy Manager
              </span>
            </h2>
            <p className="text-2xl text-muted-foreground mb-8">
              The multi-language dependency scanner that keeps your apps secure,
              up-to-date, and optimized.
            </p>
          </div>

          {/* 3-Step Process */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {[
              {
                icon: Upload,
                step: "1",
                title: "Upload",
                desc: "Drop your dependency file (package.json, requirements.txt, etc.)",
              },
              {
                icon: Search,
                step: "2",
                title: "Analyze",
                desc: "We scan for outdated packages, security vulnerabilities, and unused dependencies",
              },
              {
                icon: CheckCircle,
                step: "3",
                title: "Act",
                desc: "Get actionable insights: security fixes, updates, and cleanup opportunities",
              },
            ].map((step, index) => (
              <Card
                key={index}
                className="card-gradient p-8 border-border/50 hover-lift text-center"
              >
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="text-sm font-bold text-primary mb-2">
                  STEP {step.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </Card>
            ))}
          </div>

          {/* Founder Message */}
          <div className="bg-gradient-to-r from-muted/20 to-muted/10 rounded-2xl p-8 mb-16 border border-border/50">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  From a Developer, For Developers
                </h3>
                <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                  "As a developer, I was tired of juggling outdated
                  dependencies, security alerts, and bloated package files. I
                  built pacgie because I needed one tool that could scan for
                  vulnerabilities, find updates, and identify unused
                  dependencies across all my projects - Node.js, Python, Go - in
                  one place."
                </p>
                <p className="text-sm text-muted-foreground">
                  — Allan, Founder
                </p>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="card-gradient p-6 border-border/50 hover-lift"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {feature.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Link href="/checks" className="block">
              <Button size="lg" className="btn-hero">
                Start Your Free Analysis
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductIntroSection;
