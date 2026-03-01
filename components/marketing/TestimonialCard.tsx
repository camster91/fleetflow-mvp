import { Star, Quote } from 'lucide-react';

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  company: string;
  rating?: number;
  avatarUrl?: string;
}

export function TestimonialCard({
  quote,
  author,
  role,
  company,
  rating = 5,
  avatarUrl,
}: TestimonialCardProps) {
  return (
    <div className="relative p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-soft transition-all duration-300">
      {/* Quote Icon */}
      <div className="absolute top-4 right-4">
        <Quote className="h-8 w-8 text-blue-100" />
      </div>

      {/* Rating */}
      <div className="flex items-center space-x-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Quote Text */}
      <blockquote className="text-slate-700 mb-6 leading-relaxed">
        "{quote}"
      </blockquote>

      {/* Author */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium">
          {avatarUrl ? (
            <img src={avatarUrl} alt={author} className="w-full h-full rounded-full object-cover" />
          ) : (
            author.split(' ').map(n => n[0]).join('')
          )}
        </div>
        <div>
          <div className="font-semibold text-slate-900">{author}</div>
          <div className="text-sm text-slate-500">
            {role}, {company}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TestimonialCardHorizontal({
  quote,
  author,
  role,
  company,
  rating = 5,
  avatarUrl,
}: TestimonialCardProps) {
  return (
    <div className="flex flex-col md:flex-row gap-6 p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-soft transition-all duration-300">
      {/* Quote Icon */}
      <div className="flex-shrink-0">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <Quote className="h-8 w-8 text-blue-600" />
        </div>
      </div>

      <div className="flex-1">
        {/* Rating */}
        <div className="flex items-center space-x-1 mb-3">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Quote Text */}
        <blockquote className="text-slate-700 mb-4 leading-relaxed">
          "{quote}"
        </blockquote>

        {/* Author */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt={author} className="w-full h-full rounded-full object-cover" />
            ) : (
              author.split(' ').map(n => n[0]).join('')
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{author}</div>
            <div className="text-sm text-slate-500">
              {role}, {company}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
