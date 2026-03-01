import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import {
  Calendar,
  Clock,
  User,
  ArrowLeft,
  Share2,
  Twitter,
  Linkedin,
  Facebook,
  Link as LinkIcon,
  Tag,
  ChevronRight,
} from 'lucide-react';
import { MarketingLayout } from '../../components/layouts/MarketingLayout';

// Blog posts data (same as index)
const blogPosts = [
  {
    slug: 'future-of-fleet-management-2024',
    title: 'The Future of Fleet Management in 2024',
    excerpt: 'Explore the emerging technologies and trends that are reshaping how businesses manage their vehicle fleets, from AI-powered optimization to electric vehicle integration.',
    content: `
      <p>The fleet management industry is undergoing a dramatic transformation. As we move through 2024, several key technologies and trends are reshaping how businesses manage their vehicle fleets. From artificial intelligence to electric vehicles, the future of fleet management is more connected, efficient, and sustainable than ever before.</p>

      <h2>1. AI-Powered Optimization</h2>
      <p>Artificial intelligence is no longer just a buzzword in fleet management—it's becoming an essential tool. Machine learning algorithms can now analyze vast amounts of data to optimize routes in real-time, predict maintenance needs before breakdowns occur, and even identify the most fuel-efficient driving patterns.</p>
      <p>Fleets that have adopted AI-powered solutions are seeing significant improvements in operational efficiency. Route optimization alone can reduce fuel costs by 15-20%, while predictive maintenance can decrease vehicle downtime by up to 30%.</p>

      <h2>2. The Electric Vehicle Revolution</h2>
      <p>Electric vehicles (EVs) are rapidly becoming a viable option for fleets of all sizes. With improving battery technology, expanding charging infrastructure, and decreasing costs, more fleet managers are considering the switch to electric.</p>
      <p>The benefits extend beyond environmental impact. EVs typically have lower maintenance costs due to fewer moving parts, and electricity is generally cheaper than gasoline or diesel. Many companies are also finding that EVs help with their corporate sustainability goals and can be a powerful marketing tool.</p>

      <h2>3. Advanced Telematics</h2>
      <p>Modern telematics systems do much more than just track vehicle location. Today's solutions provide real-time data on vehicle health, driver behavior, fuel consumption, and more. This wealth of information enables fleet managers to make data-driven decisions that improve efficiency and safety.</p>
      <p>Integration with other business systems, such as ERP and CRM platforms, is also becoming standard. This allows for seamless workflow automation and better coordination between different parts of the business.</p>

      <h2>4. Sustainability Focus</h2>
      <p>Environmental concerns are increasingly driving fleet management decisions. Companies are not only adopting EVs but also optimizing routes to reduce emissions, implementing idle reduction policies, and exploring alternative fuels.</p>
      <p>Regulatory pressure is also increasing, with many cities and countries implementing low-emission zones and other environmental regulations. Fleets that proactively address sustainability will be better positioned for the future.</p>

      <h2>5. Driver Experience</h2>
      <p>As the driver shortage continues to challenge the industry, fleet managers are focusing more on driver experience. This includes better in-cab technology, improved communication tools, and features that make drivers' jobs easier and safer.</p>
      <p>Mobile apps that provide turn-by-turn navigation, digital vehicle inspection reports, and easy communication with dispatch are becoming standard expectations for drivers.</p>

      <h2>Conclusion</h2>
      <p>The future of fleet management is exciting and full of opportunities. While technology is driving much of the change, the fundamental goal remains the same: to run efficient, safe, and profitable operations. Fleet managers who embrace these trends and invest in the right technologies will be well-positioned for success in 2024 and beyond.</p>
    `,
    category: 'fleet-management',
    categoryLabel: 'Fleet Management',
    author: 'Alex Rivera',
    authorRole: 'CEO & Co-Founder',
    date: 'Jan 15, 2024',
    readTime: '8 min read',
    imageColor: 'from-blue-500 to-blue-700',
    tags: ['AI', 'Fleet Management', 'Technology', 'Trends'],
  },
  {
    slug: 'reducing-fuel-costs-data-driven-strategies',
    title: 'Reducing Fuel Costs: 5 Data-Driven Strategies',
    excerpt: 'Learn how leading fleets are using analytics to cut fuel expenses by up to 20% through smarter routing, driver behavior monitoring, and vehicle maintenance.',
    content: `
      <p>Fuel costs represent one of the largest expenses for any fleet operation. With fuel prices fluctuating and environmental regulations tightening, reducing fuel consumption has become a top priority for fleet managers. The good news is that data-driven strategies can lead to significant savings.</p>

      <h2>1. Optimize Routes with Real-Time Data</h2>
      <p>Route optimization isn't just about finding the shortest path—it's about finding the most efficient one. Modern fleet management systems use real-time traffic data, weather conditions, and delivery time windows to calculate the best routes.</p>
      <p>Companies that have implemented advanced route optimization report fuel savings of 10-15% on average. The key is to use a system that can adapt to changing conditions and provide drivers with turn-by-turn navigation.</p>

      <h2>2. Monitor and Improve Driver Behavior</h2>
      <p>Driver behavior has a massive impact on fuel consumption. Aggressive acceleration, excessive idling, and speeding can increase fuel consumption by up to 30%.</p>
      <p>Telematics systems can track these behaviors and provide feedback to drivers. Gamification and incentive programs can encourage better driving habits. One delivery company reduced fuel costs by 12% simply by implementing a driver scoring system and providing training to low-performing drivers.</p>

      <h2>3. Maintain Vehicles Properly</h2>
      <p>Regular maintenance is crucial for fuel efficiency. Underinflated tires, dirty air filters, and misaligned wheels can all increase fuel consumption.</p>
      <p>A predictive maintenance program that uses vehicle data to identify potential issues before they become serious can help maintain optimal fuel efficiency. Regular tire pressure checks alone can improve fuel economy by up to 3%.</p>

      <h2>4. Reduce Idle Time</h2>
      <p>Idling wastes fuel and produces unnecessary emissions. An hour of idling can consume up to a gallon of fuel, depending on the vehicle.</p>
      <p>Implementing idle reduction policies and using technology to track and limit idle time can lead to significant savings. Some fleets have cut fuel costs by 5-8% simply by addressing excessive idling.</p>

      <h2>5. Right-Size Your Fleet</h2>
      <p>Using the right vehicle for the job is essential for fuel efficiency. A large truck delivering small packages is wasting fuel. Conversely, a small van making multiple trips because it can't fit all deliveries is also inefficient.</p>
      <p>Data analysis can help identify the optimal vehicle mix for your operations. Some fleets have found that adding smaller vehicles for urban deliveries while using larger trucks only for longer routes can reduce overall fuel consumption by 15-20%.</p>

      <h2>Conclusion</h2>
      <p>Reducing fuel costs requires a comprehensive approach that combines technology, driver training, and operational changes. The fleets seeing the greatest success are those that use data to identify opportunities and measure results. Start with the strategies that are easiest to implement and build from there.</p>
    `,
    category: 'tips',
    categoryLabel: 'Tips & Tricks',
    author: 'Sarah Chen',
    authorRole: 'CTO & Co-Founder',
    date: 'Jan 10, 2024',
    readTime: '6 min read',
    imageColor: 'from-emerald-500 to-emerald-700',
    tags: ['Fuel', 'Cost Savings', 'Efficiency', 'Analytics'],
  },
  {
    slug: 'electric-vehicles-fleet-transition-guide',
    title: 'The Complete Guide to EV Fleet Transition',
    excerpt: 'Everything you need to know about transitioning to electric vehicles, from infrastructure planning to total cost of ownership analysis.',
    content: `
      <p>The transition to electric vehicles (EVs) is one of the most significant changes facing fleet managers today. While the benefits of electrification are clear—lower operating costs, reduced emissions, and improved public image—the transition process can seem daunting. This guide breaks down everything you need to know.</p>

      <h2>Understanding Total Cost of Ownership</h2>
      <p>When evaluating EVs, it's important to look beyond the purchase price. The total cost of ownership (TCO) includes fuel (electricity), maintenance, insurance, and resale value.</p>
      <p>While EVs typically have higher upfront costs, they often have lower TCO over their lifetime. Electricity is generally cheaper than gasoline or diesel, and EVs require less maintenance because they have fewer moving parts. Studies show that fleet EVs can have TCO savings of 15-25% compared to conventional vehicles.</p>

      <h2>Infrastructure Planning</h2>
      <p>Charging infrastructure is one of the biggest considerations for fleet electrification. You'll need to determine:</p>
      <ul>
        <li>How many charging stations you need</li>
        <li>What charging speed is required (Level 2 vs DC fast charging)</li>
        <li>Whether to install chargers at your depot, drivers' homes, or public locations</li>
        <li>How to manage charging schedules to avoid peak electricity rates</li>
      </ul>
      <p>Many utilities offer incentives for commercial charging infrastructure, and some will even cover part of the installation costs.</p>

      <h2>Range and Duty Cycle Analysis</h2>
      <p>Not all routes are suitable for electric vehicles—yet. Conduct a thorough analysis of your fleet's duty cycles to identify which vehicles can be electrified first.</p>
      <p>Look for routes that:</p>
      <ul>
        <li>Are well within the range of available EVs</li>
        <li>Return to a central depot where charging can occur</li>
        <li>Have predictable daily mileage</li>
        <li>Operate in areas with good charging infrastructure</li>
      </ul>

      <h2>Driver Training</h2>
      <p>Driving an EV is different from driving a conventional vehicle. Drivers need to understand:</p>
      <ul>
        <li>Regenerative braking and one-pedal driving</li>
        <li>How to maximize range through driving style</li>
        <li>Proper charging procedures</li>
        <li>What to do in case of low battery</li>
      </ul>
      <p>Proper training can help drivers get the most out of their EVs and reduce range anxiety.</p>

      <h2>Incentives and Rebates</h2>
      <p>There are numerous incentives available for fleet electrification, including:</p>
      <ul>
        <li>Federal tax credits up to $7,500 per vehicle</li>
        <li>State and local rebates</li>
        <li>Utility incentives for charging infrastructure</li>
        <li>Reduced registration fees in some states</li>
      </ul>
      <p>Research all available incentives in your area, as they can significantly reduce the upfront cost of electrification.</p>

      <h2>Conclusion</h2>
      <p>The transition to electric vehicles is a journey, not a destination. Most successful fleets start with a pilot program, learn from the experience, and gradually expand their EV fleet. With proper planning and the right partners, electrification can deliver significant benefits for your operation.</p>
    `,
    category: 'sustainability',
    categoryLabel: 'Sustainability',
    author: 'Michael Torres',
    authorRole: 'Head of Product',
    date: 'Jan 5, 2024',
    readTime: '12 min read',
    imageColor: 'from-green-500 to-green-700',
    tags: ['Electric Vehicles', 'Sustainability', 'EV Transition', 'Infrastructure'],
  },
  {
    slug: 'ai-route-optimization-explained',
    title: 'AI Route Optimization Explained',
    excerpt: 'A deep dive into how artificial intelligence is revolutionizing route planning, saving time, fuel, and reducing environmental impact.',
    content: `
      <p>Route optimization has come a long way from the days of paper maps and manual planning. Today's AI-powered systems can process millions of data points to create optimal routes in seconds. But how exactly does AI route optimization work, and what benefits can it deliver?</p>

      <h2>How AI Route Optimization Works</h2>
      <p>At its core, AI route optimization uses machine learning algorithms to solve what mathematicians call the "vehicle routing problem." This problem involves finding the most efficient way to visit a set of locations while considering multiple constraints.</p>
      <p>Modern AI systems take into account:</p>
      <ul>
        <li>Real-time traffic conditions</li>
        <li>Historical traffic patterns</li>
        <li>Delivery time windows</li>
        <li>Vehicle capacity constraints</li>
        <li>Driver hours of service regulations</li>
        <li>Customer preferences</li>
        <li>Road restrictions and construction</li>
      </ul>

      <h2>Machine Learning in Action</h2>
      <p>The AI learns from historical data to make better predictions. For example, it might learn that certain routes are consistently slower on Friday afternoons, or that particular customers are often not available during certain hours.</p>
      <p>Over time, the system becomes more accurate and can handle increasingly complex scenarios. Some advanced systems can even predict the likelihood of delivery success based on historical patterns.</p>

      <h2>Dynamic Re-routing</h2>
      <p>One of the most powerful features of AI route optimization is dynamic re-routing. When unexpected events occur—a traffic accident, a customer cancellation, or an urgent delivery request—the system can instantly recalculate routes for all affected vehicles.</p>
      <p>This real-time adaptability ensures that fleets can maintain efficiency even when conditions change unexpectedly.</p>

      <h2>Measurable Benefits</h2>
      <p>Fleets that implement AI route optimization typically see:</p>
      <ul>
        <li>15-25% reduction in fuel costs</li>
        <li>20-30% increase in stops per route</li>
        <li>15-20% reduction in drive time</li>
        <li>Improved on-time delivery rates</li>
        <li>Reduced vehicle wear and tear</li>
        <li>Lower carbon emissions</li>
      </ul>

      <h2>Getting Started</h2>
      <p>Implementing AI route optimization doesn't have to be overwhelming. Start by ensuring you have accurate data about your customers, vehicles, and historical operations. Then work with a provider who can help you configure the system to match your specific business rules and constraints.</p>
      <p>Most importantly, involve your drivers in the process. They need to understand how the system works and trust its recommendations for it to be effective.</p>

      <h2>Conclusion</h2>
      <p>AI route optimization represents a significant leap forward in fleet management technology. By leveraging machine learning and real-time data, fleets can achieve levels of efficiency that were impossible with traditional planning methods.</p>
    `,
    category: 'technology',
    categoryLabel: 'Technology',
    author: 'David Kim',
    authorRole: 'Head of Customer Success',
    date: 'Dec 28, 2023',
    readTime: '7 min read',
    imageColor: 'from-purple-500 to-purple-700',
    tags: ['AI', 'Route Optimization', 'Machine Learning', 'Technology'],
  },
  {
    slug: 'dot-compliance-checklist-2024',
    title: 'DOT Compliance Checklist for 2024',
    excerpt: 'Stay compliant with the latest Department of Transportation regulations. Our comprehensive checklist covers everything you need to know.',
    content: `
      <p>Department of Transportation (DOT) compliance is a critical responsibility for fleet managers. Failure to comply with regulations can result in hefty fines, operational disruptions, and damage to your safety rating. This comprehensive checklist will help ensure your fleet stays compliant in 2024.</p>

      <h2>Driver Qualification Files</h2>
      <p>Every driver must have a complete qualification file that includes:</p>
      <ul>
        <li>Application for employment</li>
        <li> Road test certificate or equivalent</li>
        <li>Medical examiner's certificate</li>
        <li>Annual motor vehicle records (MVR) review</li>
        <li>Annual list of violations</li>
        <li>Entry-level driver training certificate (if applicable)</li>
      </ul>
      <p>Make sure these files are up to date and easily accessible for DOT audits.</p>

      <h2>Hours of Service (HOS) Compliance</h2>
      <p>HOS regulations limit when and how long drivers can operate commercial vehicles. Key requirements include:</p>
      <ul>
        <li>11-hour driving limit after 10 consecutive hours off duty</li>
        <li>14-hour on-duty limit</li>
        <li>30-minute break after 8 hours of driving</li>
        <li>60/70 hour duty limit over 7/8 days</li>
      </ul>
      <p>Electronic Logging Devices (ELDs) are required for most commercial vehicles. Ensure your ELD system is registered with the FMCSA and functioning properly.</p>

      <h2>Vehicle Maintenance</h2>
      <p>Proper vehicle maintenance is both a safety requirement and a DOT compliance issue. You must maintain:</p>
      <ul>
        <li>Systematic inspection, repair, and maintenance records</li>
        <li>Pre-trip and post-trip inspection reports</li>
        <li>Annual vehicle inspection documentation</li>
        <li>Records of repairs for defects noted in inspections</li>
      </ul>

      <h2>Drug and Alcohol Testing Program</h2>
      <p>A DOT-compliant drug and alcohol testing program must include:</p>
      <ul>
        <li>Pre-employment testing</li>
        <li>Random testing (minimum 50% drug, 10% alcohol annually)</li>
        <li>Post-accident testing</li>
        <li>Reasonable suspicion testing</li>
        <li>Return-to-duty and follow-up testing</li>
      </ul>

      <h2>Hazardous Materials (if applicable)</h2>
      <p>If your fleet transports hazardous materials, additional requirements include:</p>
      <ul>
        <li>Hazmat training for drivers and handlers</li>
        <li>Shipping papers and emergency response information</li>
        <li>Proper placarding and labeling</li>
        <li>Security plans and training</li>
      </ul>

      <h2>Record Retention</h2>
      <p>DOT regulations specify how long different records must be kept:</p>
      <ul>
        <li>Driver qualification files: 3 years after employment ends</li>
        <li>Log books/ELD data: 6 months</li>
        <li>Maintenance records: 1 year (or 6 months after vehicle leaves fleet)</li>
        <li>Accident records: 3 years</li>
        <li>Drug and alcohol testing: 5 years</li>
      </ul>

      <h2>Conclusion</h2>
      <p>DOT compliance is an ongoing process, not a one-time task. Regular internal audits can help identify and correct issues before they become violations. Consider using fleet management software that includes compliance features to automate record-keeping and ensure nothing falls through the cracks.</p>
    `,
    category: 'industry',
    categoryLabel: 'Industry Insights',
    author: 'Emily Johnson',
    authorRole: 'VP of Sales',
    date: 'Dec 20, 2023',
    readTime: '10 min read',
    imageColor: 'from-amber-500 to-amber-700',
    tags: ['DOT', 'Compliance', 'Regulations', 'Safety'],
  },
  {
    slug: 'driver-retention-strategies',
    title: 'Proven Driver Retention Strategies',
    excerpt: 'The driver shortage is real. Learn how top fleets are keeping their best drivers happy and reducing turnover by up to 40%.',
    content: `
      <p>The commercial driver shortage is one of the biggest challenges facing the fleet industry today. With an aging workforce and fewer young people entering the profession, retaining your existing drivers has never been more important. Here are proven strategies that leading fleets use to keep their drivers happy and reduce turnover.</p>

      <h2>1. Competitive Compensation</h2>
      <p>Let's start with the obvious: drivers need to be paid well. But it's not just about base salary. The best fleets offer:</p>
      <ul>
        <li>Competitive hourly wages or mileage rates</li>
        <li>Performance bonuses for safety and fuel efficiency</li>
        <li>Sign-on and retention bonuses</li>
        <li>Benefits including health insurance, retirement plans, and paid time off</li>
        <li>Referral bonuses for bringing in new drivers</li>
      </ul>
      <p>Regular compensation reviews ensure your pay remains competitive in your market.</p>

      <h2>2. Respect and Recognition</h2>
      <p>Drivers want to feel valued and respected. Simple gestures can go a long way:</p>
      <ul>
        <li>Recognizing safe driving milestones</li>
        <li>Publicly celebrating top performers</li>
        <li>Soliciting driver feedback and acting on it</li>
        <li>Treating drivers as professionals and key team members</li>
        <li>Having open-door policies with management</li>
      </ul>

      <h2>3. Work-Life Balance</h2>
      <p>Long hours and time away from home are major contributors to driver turnover. Strategies to improve work-life balance include:</p>
      <ul>
        <li>Predictable schedules when possible</li>
        <li>Guaranteed home time</li>
        <li>Local or regional routes for drivers who prefer them</li>
        <li>Flexibility for important family events</li>
        <li>Paid time off that drivers can actually use</li>
      </ul>

      <h2>4. Quality Equipment</h2>
      <p>Drivers spend their entire workday in their vehicles. Providing well-maintained, comfortable, and modern equipment shows you value their comfort and safety. Features drivers appreciate include:</p>
      <ul>
        <li>Comfortable seating and climate control</li>
        <li>Reliable technology and communication systems</li>
        <li>Regular maintenance to prevent breakdowns</li>
        <li>Amenities like refrigerators and comfortable sleeping areas</li>
      </ul>

      <h2>5. Career Development</h2>
      <p>Drivers want to see a future with your company. Offer:</p>
      <ul>
        <li>Clear paths for advancement (driver trainer, dispatcher, management)</li>
        <li>Training and certification opportunities</li>
        <li>Mentorship programs pairing new and experienced drivers</li>
        <li>Tuition reimbursement for further education</li>
      </ul>

      <h2>6. Communication Technology</h2>
      <p>Modern drivers expect modern tools. Mobile apps that provide:</p>
      <ul>
        <li>Clear, accurate route information</li>
        <li>Easy communication with dispatch</li>
        <li>Digital documentation to eliminate paperwork</li>
        <li>Real-time updates and changes</li>
      </ul>
      <p>Good technology makes drivers' jobs easier and shows you're investing in their success.</p>

      <h2>Conclusion</h2>
      <p>Driver retention isn't about any single factor—it's about creating a culture where drivers feel valued, respected, and supported. Fleets that invest in their drivers see significant returns in the form of lower turnover, better safety records, and improved customer service.</p>
    `,
    category: 'fleet-management',
    categoryLabel: 'Fleet Management',
    author: 'Lisa Anderson',
    authorRole: 'Lead Designer',
    date: 'Dec 15, 2023',
    readTime: '9 min read',
    imageColor: 'from-rose-500 to-rose-700',
    tags: ['Drivers', 'Retention', 'HR', 'Fleet Management'],
  },
  {
    slug: 'predictive-maintenance-benefits',
    title: 'The ROI of Predictive Maintenance',
    excerpt: 'Why waiting for something to break is costing you money. Discover how predictive maintenance can reduce downtime and extend vehicle life.',
    content: `
      <p>For too long, fleet maintenance has been a reactive process: wait for something to break, then fix it. But this approach is expensive, disruptive, and risky. Predictive maintenance—using data to predict failures before they happen—is transforming how fleets approach vehicle upkeep.</p>

      <h2>The Cost of Reactive Maintenance</h2>
      <p>When a vehicle breaks down unexpectedly, the costs add up quickly:</p>
      <ul>
        <li>Emergency repair costs (often 2-3x planned maintenance)</li>
        <li>Towing expenses</li>
        <li>Missed deliveries and unhappy customers</li>
        <li>Driver downtime</li>
        <li>Potential secondary damage to other components</li>
        <li>Safety risks</li>
      </ul>
      <p>Studies show that unplanned downtime can cost fleets $500-$1,000 per day per vehicle, not including repair costs.</p>

      <h2>How Predictive Maintenance Works</h2>
      <p>Predictive maintenance uses telematics data, diagnostic trouble codes, and historical maintenance records to identify patterns that precede failures. Modern systems can monitor:</p>
      <ul>
        <li>Engine performance metrics</li>
        <li>Brake wear indicators</li>
        <li>Battery health</li>
        <li>Tire pressure and temperature</li>
        <li>Cooling system performance</li>
        <li>Transmission health</li>
      </ul>

      <h2>Calculating the ROI</h2>
      <p>The return on investment for predictive maintenance comes from multiple sources:</p>

      <h3>Reduced Downtime</h3>
      <p>Fleets using predictive maintenance report 25-35% reductions in unplanned downtime. For a fleet of 50 vehicles, this can translate to hundreds of thousands of dollars in annual savings.</p>

      <h3>Extended Vehicle Life</h3>
      <p>Catching problems early prevents cascading failures that can significantly shorten vehicle lifespan. Well-maintained vehicles can last 20-30% longer, delaying expensive replacement costs.</p>

      <h3>Lower Repair Costs</h3>
      <p>Planned repairs are almost always cheaper than emergency fixes. Shops charge premium rates for urgent work, and parts ordered in advance are often less expensive than rush orders.</p>

      <h3>Improved Fuel Efficiency</h3>
      <p>Poorly maintained vehicles consume more fuel. Keeping engines, tires, and other components in optimal condition can improve fuel economy by 5-10%.</p>

      <h2>Implementation Strategy</h2>
      <p>Starting a predictive maintenance program doesn't require a massive upfront investment. Begin with:</p>
      <ol>
        <li><strong>Data collection:</strong> Ensure your telematics system is capturing diagnostic data</li>
        <li><strong>Baseline analysis:</strong> Understand your current maintenance costs and patterns</li>
        <li><strong>Pilot program:</strong> Start with a subset of your fleet to refine the process</li>
        <li><strong>Gradual rollout:</strong> Expand the program as you demonstrate success</li>
      </ol>

      <h2>Conclusion</h2>
      <p>The question isn't whether you can afford predictive maintenance—it's whether you can afford to continue without it. The combination of cost savings, improved safety, and operational efficiency makes predictive maintenance one of the smartest investments a fleet can make.</p>
    `,
    category: 'technology',
    categoryLabel: 'Technology',
    author: 'Sarah Chen',
    authorRole: 'CTO & Co-Founder',
    date: 'Dec 10, 2023',
    readTime: '8 min read',
    imageColor: 'from-cyan-500 to-cyan-700',
    tags: ['Maintenance', 'Predictive', 'ROI', 'Technology'],
  },
  {
    slug: 'sustainable-fleet-best-practices',
    title: 'Building a Sustainable Fleet: Best Practices',
    excerpt: 'Environmental responsibility meets cost savings. Learn practical strategies for reducing your fleet\'s carbon footprint while improving the bottom line.',
    content: `
      <p>Sustainability is no longer just a corporate social responsibility initiative—it's becoming a business imperative. Customers, investors, and regulators are all demanding environmental accountability. The good news is that many sustainability improvements also reduce operating costs.</p>

      <h2>Start with Measurement</h2>
      <p>You can't improve what you don't measure. Begin by establishing baseline metrics for:</p>
      <ul>
        <li>Total fuel consumption</li>
        <li>Carbon emissions ( Scope 1 and Scope 2)</li>
        <li>Miles per gallon across your fleet</li>
        <li>Idle time</li>
        <li>Empty miles</li>
      </ul>
      <p>Modern fleet management software can automate much of this tracking.</p>

      <h2>Route Optimization</h2>
      <p>Every unnecessary mile driven creates emissions and costs money. Route optimization software can typically reduce total miles driven by 10-15%, with corresponding reductions in fuel consumption and emissions.</p>
      <p>Look for opportunities to:</p>
      <ul>
        <li>Combine deliveries</li>
        <li>Reduce backtracking</li>
        <li>Avoid congested areas</li>
        <li>Match vehicle size to load</li>
      </ul>

      <h2>Driver Behavior</h2>
      <p>How drivers operate vehicles has a major impact on emissions. Aggressive acceleration, speeding, and excessive idling all increase fuel consumption and emissions.</p>
      <p>Telematics systems can track these behaviors and provide feedback. Many fleets have seen 10-15% improvements in fuel efficiency simply by addressing driving behavior.</p>

      <h2>Vehicle Right-Sizing</h2>
      <p>Using a large truck for a small delivery is inefficient. Analyze your typical loads and routes to ensure you're using the most appropriate vehicle for each job. Some fleets have found that adding smaller vehicles for urban deliveries allows them to use larger, more efficient trucks only when truly needed.</p>

      <h2>Alternative Fuels and Electrification</h2>
      <p>Electric vehicles produce zero tailpipe emissions and are becoming increasingly viable for many fleet applications. Even if full electrification isn't feasible yet, consider:</p>
      <ul>
        <li>Hybrid vehicles for appropriate routes</li>
        <li>Natural gas or propane for heavy-duty applications</li>
        <li>Biodiesel blends</li>
        <li>Renewable diesel</li>
      </ul>

      <h2>Maintenance Best Practices</h2>
      <p>Well-maintained vehicles are more efficient and produce fewer emissions. Key practices include:</p>
      <ul>
        <li>Regular engine tuning</li>
        <li>Proper tire inflation</li>
        <li>Clean air filters</li>
        <li>Correct wheel alignment</li>
        <li>Timely oil changes</li>
      </ul>

      <h2>Carbon Offsetting</h2>
      <p>While reducing emissions should be the priority, some emissions are unavoidable. High-quality carbon offset programs can help neutralize remaining emissions while you work toward longer-term reductions.</p>

      <h2>Reporting and Communication</h2>
      <p>Share your sustainability progress with stakeholders. Many customers now request emissions data as part of their supplier evaluation process. Being able to demonstrate improvement can be a competitive advantage.</p>

      <h2>Conclusion</h2>
      <p>Building a sustainable fleet is a journey that requires ongoing commitment. Start with the changes that are easiest to implement and offer the quickest returns, then progressively tackle more ambitious initiatives. The combination of cost savings, regulatory compliance, and improved public image makes sustainability a win-win for fleets.</p>
    `,
    category: 'sustainability',
    categoryLabel: 'Sustainability',
    author: 'Michael Torres',
    authorRole: 'Head of Product',
    date: 'Dec 5, 2023',
    readTime: '7 min read',
    imageColor: 'from-teal-500 to-teal-700',
    tags: ['Sustainability', 'Green Fleet', 'Carbon Footprint', 'Environment'],
  },
];

// Related posts helper
function getRelatedPosts(currentSlug: string, category: string) {
  return blogPosts
    .filter((post) => post.slug !== currentSlug && post.category === category)
    .slice(0, 2);
}

export default function BlogPostPage() {
  const router = useRouter();
  const { slug } = router.query;

  const post = blogPosts.find((p) => p.slug === slug);
  const relatedPosts = post ? getRelatedPosts(post.slug, post.category) : [];

  if (!post) {
    return (
      <MarketingLayout>
        <div className="pt-32 pb-20 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Article not found</h1>
          <Link href="/blog" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to blog
          </Link>
        </div>
      </MarketingLayout>
    );
  }

  const handleShare = (platform: string) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = encodeURIComponent(post.title);
    
    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    };

    if (platform === 'copy') {
      navigator.clipboard.writeText(url);
    } else if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
  };

  return (
    <MarketingLayout
      title={`${post.title} - FleetFlow Blog`}
      description={post.excerpt}
    >
      {/* Article Header */}
      <section className="pt-32 pb-12 bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 mb-8"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to all articles
          </Link>

          <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">
            {post.categoryLabel}
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-6">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center space-x-1">
              <User className="h-4 w-4" />
              <span>{post.author}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>{post.date}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>{post.readTime}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Featured Image */}
      <section className="pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`aspect-[21/9] rounded-2xl bg-gradient-to-br ${post.imageColor} flex items-center justify-center overflow-hidden`}>
            <div className="text-center text-white p-8">
              <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                <Tag className="h-12 w-12 text-white" />
              </div>
              <span className="text-white/80">Featured Image</span>
            </div>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr,200px] gap-12">
            {/* Main Content */}
            <article>
              <div
                className="prose prose-lg prose-slate max-w-none
                  prose-headings:font-bold prose-headings:text-slate-900
                  prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                  prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                  prose-p:text-slate-600 prose-p:leading-relaxed
                  prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                  prose-ul:list-disc prose-ul:pl-5 prose-ul:space-y-2
                  prose-ol:list-decimal prose-ol:pl-5 prose-ol:space-y-2
                  prose-li:text-slate-600
                  prose-strong:text-slate-900"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* Tags */}
              <div className="mt-10 pt-8 border-t border-slate-200">
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Share */}
              <div className="mt-8 flex items-center space-x-4">
                <span className="text-sm font-medium text-slate-600">Share:</span>
                <button
                  onClick={() => handleShare('twitter')}
                  className="p-2 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-500 transition-colors"
                  aria-label="Share on Twitter"
                >
                  <Twitter className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleShare('linkedin')}
                  className="p-2 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition-colors"
                  aria-label="Share on LinkedIn"
                >
                  <Linkedin className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleShare('facebook')}
                  className="p-2 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 transition-colors"
                  aria-label="Share on Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleShare('copy')}
                  className="p-2 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 transition-colors"
                  aria-label="Copy link"
                >
                  <LinkIcon className="h-4 w-4" />
                </button>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-32 space-y-8">
                {/* Author Card */}
                <div className="p-6 rounded-xl bg-slate-50">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
                    {post.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <h3 className="text-center font-semibold text-slate-900">{post.author}</h3>
                  <p className="text-center text-sm text-slate-500">{post.authorRole}</p>
                </div>

                {/* Newsletter */}
                <div className="p-6 rounded-xl bg-blue-50">
                  <h3 className="font-semibold text-slate-900 mb-2">Subscribe</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Get fleet management tips delivered to your inbox.
                  </p>
                  <input
                    type="email"
                    placeholder="Your email"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm mb-2"
                  />
                  <button className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    Subscribe
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Related Articles</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {relatedPosts.map((relatedPost) => (
                <Link key={relatedPost.slug} href={`/blog/${relatedPost.slug}`}>
                  <article className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-blue-300 hover:shadow-soft transition-all">
                    <div className={`h-48 bg-gradient-to-br ${relatedPost.imageColor} flex items-center justify-center`}>
                      <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Tag className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="p-6">
                      <span className="text-sm text-blue-600 font-medium">
                        {relatedPost.categoryLabel}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-2 group-hover:text-blue-600 transition-colors">
                        {relatedPost.title}
                      </h3>
                      <p className="text-slate-600 text-sm mt-2 line-clamp-2">
                        {relatedPost.excerpt}
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </MarketingLayout>
  );
}
