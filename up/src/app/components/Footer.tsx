import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Github, Twitter, Mail, Heart } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-b from-background to-muted/20 border-t border-border/50">
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto">

          {/* Footer Links */}
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-bold text-lg text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="/#features" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="/#pricing" className="hover:text-primary transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg text-foreground mb-4">Resources</h4>
              <ul className="space-y-2 text-muted-foreground">

                <li><a href="/#" className="hover:text-primary transition-colors">Guides</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="/about" className="hover:text-primary transition-colors">About</a></li>
                <li><a href="/privacy" className="hover:text-primary transition-colors">Privacy</a></li>
                <li><a href="/terms" className="hover:text-primary transition-colors">Terms</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg text-foreground mb-4">Community</h4>
              <ul className="space-y-2 text-muted-foreground">


                <li><a href="#" className="hover:text-primary transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">LinkedIn</a></li>
                <li> email: hello@pacgie.com</li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-4 md:mb-0">
              <span>© 2025 pacgie. Made with</span>
              <Heart className="w-4 h-4 text-primary" />
              <span>for developers</span>
            </div>

            <div className="flex items-center gap-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="w-5 h-5" />
              </a>

            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;