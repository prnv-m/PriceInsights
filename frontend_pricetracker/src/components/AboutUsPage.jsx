import React, { useState, useEffect } from 'react';
import TopBar from './TopBar';
import { Info, Target, BarChart2 } from 'lucide-react';

export default function AboutUsPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const sectionBaseClasses = 'transition-all duration-700 ease-out';
  const sectionInitialClasses = 'opacity-0 transform translate-y-5';
  const sectionLoadedClasses = 'opacity-100 transform translate-y-0';

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <div className="container mx-auto px-4 py-12">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className={`flex items-center gap-4 mb-6 ${sectionBaseClasses} ${isLoaded ? sectionLoadedClasses : sectionInitialClasses}`}>
            <img src="/assets/shopmetrics.png" alt="ShopMetrics Logo" className="h-16 w-16 rounded-lg" />
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">About ShopMetrics</h1>
          </div>

          <section className={`mb-8 ${sectionBaseClasses} ${isLoaded ? sectionLoadedClasses : sectionInitialClasses} delay-100`}>
            <h2 className="text-2xl font-semibold text-gray-800 mb-3 flex items-center gap-2"><Info className="text-blue-600" /> Our Mission</h2>
            <p className="text-gray-700 leading-relaxed">
              At ShopMetrics, our mission is to empower consumers with transparent and comprehensive pricing information. 
              We believe that everyone deserves access to historical price data to make informed purchasing decisions, 
              ensuring they get the best value for their money. We track prices across various online retailers 
              to provide insights into price fluctuations and trends.
            </p>
          </section>

          <section className={`mb-8 ${sectionBaseClasses} ${isLoaded ? sectionLoadedClasses : sectionInitialClasses} delay-200`}>
            <h2 className="text-2xl font-semibold text-gray-800 mb-3 flex items-center gap-2"><Target className="text-green-600" /> What We Do</h2>
            <p className="text-gray-700 leading-relaxed mb-2">
              We meticulously monitor product prices listed on major e-commerce platforms. Our system captures price changes,
              discount availability, and stock status over time. This data is then processed and presented in an easy-to-understand format,
              allowing users to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>View detailed price history charts for individual products.</li>
              <li>Compare current prices against historical highs and lows.</li>
              <li>Discover trending products based on price volatility.</li>
              <li>Find the latest deals and significant price drops.</li>
              <li>Search and filter products across various categories.</li>
            </ul>
          </section>

          <section className={`${sectionBaseClasses} ${isLoaded ? sectionLoadedClasses : sectionInitialClasses} delay-300`}>
            <h2 className="text-2xl font-semibold text-gray-800 mb-3 flex items-center gap-2"><BarChart2 className="text-purple-600" /> Why Choose Us?</h2>
            <p className="text-gray-700 leading-relaxed">
              ShopMetrics provides a reliable and user-friendly platform dedicated solely to price tracking and analysis.
              We are committed to data accuracy and providing valuable insights without overwhelming our users.
              Whether you're a casual shopper or a dedicated bargain hunter, ShopMetrics is your go-to resource for 
              navigating the dynamic world of online pricing.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              Thank you for using ShopMetrics!
            </p>
          </section>

          <div className={`mt-10 text-center text-gray-500 text-sm ${sectionBaseClasses} ${isLoaded ? sectionLoadedClasses : sectionInitialClasses} delay-400`}>
            <p>ShopMetrics is an independent price tracking service and is not affiliated with any retailer.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 