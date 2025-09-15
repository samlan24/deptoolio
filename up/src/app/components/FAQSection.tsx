import React from "react";

const faqs = [
  {
    question: "What does Pacgie do?",
    answer:
      "Pacgie scans your repositories or dependency files for three key issues: security vulnerabilities, outdated packages, and unused dependencies. This helps keep your projects secure, up-to-date, and optimized.",
  },
  {
    question: "How do I use Pacgie?",
    answer:
      "Simply connect your GitHub repository or upload dependency files directly (package.json, requirements.txt, etc.) and start scanning. You can track your scan history and manage your credits from your dashboard.",
  },
  {
    question: "What types of issues does Pacgie detect?",
    answer:
      "Pacgie identifies three main dependency issues: 1) Security vulnerabilities in your packages, 2) Outdated dependencies that need updates, and 3) Unused dependencies that can be safely removed to reduce bundle size and attack surface.",
  },
  {
    question: "Is my code safe with Pacgie?",
    answer:
      "Yes. Pacgie is built with privacy in mind. We only collect essential information and do not share your code or data with third parties.",
  },
  {
    question: "How does the credit system work?",
    answer:
      "You can purchase credits to perform scans. Credits are valid for one month and can be repurchased at any time. Free scans are also available with some limitations.",
  },
  {
    question: "Which languages and package managers are supported?",
    answer:
      "Pacgie supports popular languages and package managers including JavaScript (npm/yarn), Python (pip), PHP (composer), Go (modules), .NET (nuget), and Rust (cargo).",
  },
];

const FAQSection = () => (
  <section className="max-w-3xl mx-auto px-6 py-16">
    <h2 className="text-2xl font-bold mb-8 text-center">
      Frequently Asked Questions
    </h2>
    <div className="space-y-6">
      {faqs.map((faq, idx) => (
        <div key={idx} className="border-b border-muted pb-4">
          <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
          <p className="text-muted-foreground">{faq.answer}</p>
        </div>
      ))}
    </div>
  </section>
);

export default FAQSection;
