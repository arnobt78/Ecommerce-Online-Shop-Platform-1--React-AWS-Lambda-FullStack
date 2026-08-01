import { Accordion } from "./Accordion";

export const Faq = () => {
  const faqs = [
    {
      id: 1,
      question: "Why should I use CodeBook?",
      answer:
        "Every book on CodeBook is written and reviewed by working engineers, organized around real projects rather than just reference material, and covers the languages and frameworks teams actually hire for — React, Python, Django, backend architecture, Git, and more. You also get a support ticket system and a dashboard that tracks every purchase, so you're never left without help.",
    },
    {
      id: 2,
      question: "Can I access my eBook on mobile?",
      answer:
        "Yes — your library lives on your Dashboard and is available from any browser, on any device, as soon as your payment is confirmed. There's nothing to install; just log in and continue reading where you left off.",
    },
    {
      id: 3,
      question: "Do you offer refunds?",
      answer:
        "Yes. If a purchase isn't right for you, open a support ticket from your Dashboard within a reasonable window of the order and our team will process a refund to your original payment method.",
    },
    {
      id: 4,
      question: "Do you support international payments?",
      answer:
        "Yes — checkout is powered by Stripe, which accepts major debit and credit cards from customers worldwide, all processed securely without CodeBook ever seeing your card details.",
    },
  ];

  return (
    <section className="my-10 p-7 border rounded dark:border-slate-700 shadow-sm">
      <h1 className="text-2xl text-center font-medium dark:text-slate-100 mb-3 underline underline-offset-8">
        Question in mind?
      </h1>
      <div
        className=""
        id="accordion-flush"
        data-accordion="collapse"
        data-active-classes="bg-white dark:bg-gray-900 text-gray-700 dark:text-white"
        data-inactive-classes="text-gray-500 dark:text-gray-400"
      >
        {faqs.map((faq) => (
          <Accordion key={faq.id} faq={faq} />
        ))}
      </div>
    </section>
  );
};
