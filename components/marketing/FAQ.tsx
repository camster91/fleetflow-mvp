import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items: FAQItem[];
  title?: string;
  subtitle?: string;
}

export function FAQ({ items, title, subtitle }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {(title || subtitle) && (
        <div className="text-center mb-12">
          {title && (
            <div className="flex items-center justify-center space-x-2 mb-4">
              <HelpCircle className="h-6 w-6 text-blue-600" />
              <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
            </div>
          )}
          {subtitle && (
            <p className="text-lg text-slate-600">{subtitle}</p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className={`rounded-xl border transition-all duration-200 ${
              openIndex === index
                ? 'border-blue-300 bg-blue-50/30 shadow-soft'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <button
              onClick={() => toggleFAQ(index)}
              className="w-full flex items-center justify-between p-5 text-left"
              aria-expanded={openIndex === index}
            >
              <span className="font-semibold text-slate-900 pr-4">{item.question}</span>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 flex-shrink-0 transition-transform duration-200 ${
                  openIndex === index ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                openIndex === index ? 'max-h-96' : 'max-h-0'
              }`}
            >
              <div className="px-5 pb-5 text-slate-600 leading-relaxed">
                {item.answer}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FAQSimple({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="border-b border-slate-200 last:border-0"
        >
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full flex items-center justify-between py-4 text-left"
          >
            <span className="font-medium text-slate-900">{item.question}</span>
            <ChevronDown
              className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${
                openIndex === index ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className={`overflow-hidden transition-all duration-200 ${
              openIndex === index ? 'max-h-48 pb-4' : 'max-h-0'
            }`}
          >
            <p className="text-slate-600 text-sm">{item.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
