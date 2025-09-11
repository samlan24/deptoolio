import React from "react";

const faqs = [
  {
    question: "What does Pacgie do?",
    answer:
      "Pacgie scans your code or repositories for vulnerabilities and outdated dependencies, helping you keep your projects secure and up to date.",
  },
  {
    question: "How do I use Pacgie?",
    answer:
      "Simply register an account, upload your code or connect a repository, and start scanning. You can track your scan history and manage your credits from your dashboard.",
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
    <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
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
