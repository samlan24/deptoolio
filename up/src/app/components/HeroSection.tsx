"use client";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import Link from "next/link";
import { Upload, CheckCircle, FileCode, Zap, ArrowRight, Play } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen hero-gradient flex items-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: `url(/hero-bg.jpg)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

      <div className="container mx-auto px-6 py-20 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 fade-in-up animate">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Stop Fighting <br />
              <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Dependency Hell
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto mb-8 leading-relaxed">
              Upload your package.json, requirements.txt, or any dependency file and instantly see which packages need updating.
              Works with Node.js, Python, Go, Rust, and more.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12">
              {[
                { icon: CheckCircle, text: "Multi-language support" },
                { icon: FileCode, text: "Security vulnerability detection" },
                { icon: Zap, text: "GitHub integration" },
                { icon: Upload, text: "No registration required" }
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <feature.icon className="w-4 h-4 text-primary" />
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="card-gradient p-8 border-border/50">
              <div className="text-center space-y-6">
                <div className="space-y-4">
                  <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <FileCode className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">Ready to Analyze?</h3>
                    <p className="text-muted-foreground">
                      Get detailed dependency analysis with security alerts, update recommendations, and compatibility insights.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link href="/checks" className="block">
                    <Button
                      size="lg"
                      className="btn-hero w-full group"
                    >
                      Start Free Analysis
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>

                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-6 text-center">
                Supports: package.json, requirements.txt, go.mod, Cargo.toml, composer.json, and more
              </p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;